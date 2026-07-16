from backend.app.agents.state import AgentState
from backend.app.services.llm import generate_text

REPORT_PROMPT = """\
You are a technical writing agent. Combine the analysis results below into a single,
clean, well-structured markdown response for the user.

USER QUERY:
{query}

CODE ANALYSIS OUTPUT:
{code_analysis}

SECURITY ANALYSIS OUTPUT:
{security_analysis}

INSTRUCTIONS:
- Merge the outputs naturally. Don't repeat information.
- If only one analysis was performed, just clean and present that one.
- Use clear headers, bullet points, and code blocks where appropriate.
- End with a short summary paragraph.
- Do NOT say "Code Analysis agent said..." — just present the findings as your own.
"""


def report_node(state: AgentState) -> AgentState:
    status_updates = state.get("status_updates", [])
    status_updates.append("📝 Composing final report...")

    code_analysis = state.get("code_analysis") or "N/A"
    security_analysis = state.get("security_analysis") or "N/A"

    if code_analysis == "N/A" and security_analysis != "N/A":
        state["final_answer"] = security_analysis
        state["status_updates"] = status_updates
        return state

    if security_analysis == "N/A" and code_analysis != "N/A":
        state["final_answer"] = code_analysis
        state["status_updates"] = status_updates
        return state

    final_answer = generate_text(
        REPORT_PROMPT.format(
            query=state["query"],
            code_analysis=code_analysis,
            security_analysis=security_analysis,
        ),
        max_tokens=1200,
        temperature=0.2,
    )

    state["final_answer"] = final_answer
    state["status_updates"] = status_updates
    return state
