"""
backend/app/agents/retrieval.py
Retrieval Agent — embeds the query and fetches top-k chunks from Pinecone.
"""
from backend.app.agents.state import AgentState
from backend.app.services.embedder import embed_query
from backend.app.services.vector_store import query_index
from backend.app.core.config import get_settings

settings = get_settings()


def retrieval_node(state: AgentState) -> AgentState:
    query = state["query"]
    project_id = state["project_id"]
    status_updates = state.get("status_updates", [])

    status_updates.append(f"🔍 Retrieving top {settings.RETRIEVAL_TOP_K} relevant code chunks...")

    query_vector = embed_query(query)
    chunks = query_index(
        query_vector=query_vector,
        project_id=project_id,
        top_k=settings.RETRIEVAL_TOP_K,
    )

    status_updates.append(f"✅ Retrieved {len(chunks)} chunks from {len(set(c['filepath'] for c in chunks))} files.")
    state["retrieved_chunks"] = chunks
    state["status_updates"] = status_updates
    return state


def _format_chunks_for_prompt(chunks: list[dict]) -> str:
    parts = []
    for i, chunk in enumerate(chunks, 1):
        parts.append(
            f"--- Chunk {i} | {chunk['filepath']} (lines {chunk['start_line']}–{chunk['end_line']}) ---\n"
            f"{chunk['text']}\n"
        )
    return "\n".join(parts)
