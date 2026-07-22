import json
import asyncio
import uuid
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import AsyncGenerator

from backend.app.db.session import get_db
from backend.app.db.models import Project, Conversation
from backend.app.agents.graph import compiled_graph
from backend.app.agents.state import AgentState
from backend.app.core.config import get_settings
from backend.app.services.repository_context import representative_chunks

router = APIRouter(prefix="/api/chat", tags=["chat"])
settings = get_settings()

class ChatRequest(BaseModel):
    project_id: str
    question: str


async def event_stream(
    project_id: str,
    question: str,
    db: AsyncSession,
) -> AsyncGenerator[str, None]:
    
    def sse(event_type: str, payload: dict) -> str:
        return f"data: {json.dumps({'type': event_type, **payload})}\n\n"

    # Send headers and a heartbeat immediately. The analysis graph can take tens
    # of seconds on its first embedding/model call; without this, the Express
    # proxy and browser may time out before FastAPI starts the SSE response.
    yield sse("status", {"message": "Preparing repository context..."})

    try:
       project_uuid = uuid.UUID(project_id)
    except ValueError:
       yield sse("error", {"message": "Invalid project id"})
       return
    """
    Runs the full agent graph and yields Server-Sent Events.
    Event format:  data: <json>\n\n
    Event types:
        status  — agent progress update
        chunk   — streaming token from final answer
        done    — signals completion
        error   — error message
    """
    

    # Validate project exists
    result = await db.execute(
    select(Project).where(Project.id == project_uuid)
    )
    project = result.scalar_one_or_none()
    if not project or project.status != "ready":
        yield sse("error", {"message": "Project not found or not ready."})
        return

    # Load conversation history
    conv_result = await db.execute(
     select(Conversation)
     .where(Conversation.project_id == project_uuid)
        .order_by(Conversation.created_at.desc())
        .limit(settings.CONVERSATION_HISTORY_LIMIT)
    )
    past_convs = list(reversed(conv_result.scalars().all()))
    history = []
    for conv in past_convs:
        history.append({"role": "user", "content": conv.question})
        history.append({"role": "assistant", "content": conv.answer})

    broad_terms = ("architecture", "overview", "overall", "structure", "folder", "repository", "tech stack", "api inventory")
    seeded_chunks = []
    if any(term in question.lower() for term in broad_terms):
        try:
            seeded_chunks = await representative_chunks(project_uuid, db)
        except Exception as exc:
            # A fallback must never prevent the SSE response from starting.
            yield sse("status", {"message": f"Repository-wide context was unavailable; using semantic search. ({exc})"})

    # Initial state
    initial_state: AgentState = {
        "query": question,
        "project_id": project_id,
        "conversation_history": history,
        "retrieved_chunks": seeded_chunks,
        "planner_decision": None,
        "code_analysis": None,
        "security_analysis": None,
        "final_answer": None,
        "status_updates": [],
        "agents_used": [],
    }

    # Run graph (sync call in threadpool to not block event loop)
    loop = asyncio.get_event_loop()

    def run_graph():
        return compiled_graph.invoke(initial_state)

    try:
        final_state: AgentState = await loop.run_in_executor(None, run_graph)
    except Exception as e:
        message = str(e)
        status_code = getattr(e, "status_code", None)

        if status_code in (413, 429) or "rate_limit" in message.lower() or "too large" in message.lower():
            message = (
                "The request hit Gemini's token or rate limit. "
                "Please try a smaller query or reduce the code context, then retry."
            )

        yield sse("error", {"message": message})
        return

    # Stream status updates first
    for update in final_state.get("status_updates", []):
        yield sse("status", {"message": update})
        await asyncio.sleep(0.05)

    # Stream final answer word-by-word
    final_answer = final_state.get("final_answer", "No answer generated.")
    words = final_answer.split(" ")
    for word in words:
        yield sse("chunk", {"token": word + " "})
        await asyncio.sleep(0.01)

    # Save conversation to DB
    conv = Conversation(
      project_id=project_uuid,
        question=question,
        answer=final_answer,
        retrieved_chunks=[
            {"filepath": c["filepath"], "score": c.get("score")}
            for c in final_state.get("retrieved_chunks", [])
        ],
        agents_used=final_state.get("agents_used", []),
    )
    db.add(conv)
    await db.commit()

    yield sse("done", {"agents_used": final_state.get("agents_used", [])})


@router.post("/stream")
async def chat_stream(
    request: ChatRequest,
    db: AsyncSession = Depends(get_db),
):
    """SSE endpoint — streams agent progress and the final answer token by token."""
    return StreamingResponse(
        event_stream(request.project_id, request.question, db),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/history/{project_id}")
async def get_history(project_id: str, db: AsyncSession = Depends(get_db)):
    """Return the last 20 conversation turns for a project."""
    try:
        project_uuid = uuid.UUID(project_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid project id")
    result = await db.execute(
        select(Conversation)
        .where(Conversation.project_id == project_uuid)
        .order_by(Conversation.created_at.asc())
        .limit(20)
    )
    convs = result.scalars().all()
    return [
        {
            "id": str(c.id),
            "question": c.question,
            "answer": c.answer,
            "agents_used": c.agents_used,
            "created_at": c.created_at.isoformat(),
        }
        for c in convs
    ]
