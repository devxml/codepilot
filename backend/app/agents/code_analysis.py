from backend.app.agents.state import AgentState
from backend.app.agents.retrieval import _format_chunks_for_prompt
from backend.app.services.llm import generate_text

CODE_ANALYSIS_PROMPT = """\
You are an expert software engineer performing a code analysis task.

USER QUERY:
{query}

CONVERSATION HISTORY:
{history}

RELEVANT CODE CHUNKS (retrieved from codebase):
{chunks}

TASK:
Answer the user's query using the code chunks above as your primary source of truth.
- Explain code logic, architecture, or data flow clearly.
- Reference specific file names and line numbers when relevant.
- Use markdown formatting in your response.
- If the retrieved chunks don't fully answer the question, say so honestly.

Provide a thorough, well-structured code analysis response:
"""


def code_analysis_node(state: AgentState) -> AgentState:
    agents_to_run = state.get("planner_decision", "code_analysis").split(",")
    if "code_analysis" not in agents_to_run:
        return state

    status_updates = state.get("status_updates", [])
    status_updates.append("💻 Running Code Analysis agent...")

    history_text = "\n".join(
        f"{msg['role'].upper()}: {msg['content']}"
        for msg in state.get("conversation_history", [])
    ) or "None"

    chunks_text = _format_chunks_for_prompt(state.get("retrieved_chunks", []))

    analysis = generate_text(
        CODE_ANALYSIS_PROMPT.format(
            query=state["query"],
            history=history_text,
            chunks=chunks_text,
        ),
        max_tokens=900,
        temperature=0.2,
    )

    state["code_analysis"] = analysis
    state["status_updates"] = status_updates
    return state
