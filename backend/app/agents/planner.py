from backend.app.agents.state import AgentState
from backend.app.services.llm import generate_text

PLANNER_PROMPT = """\
You are a planning agent for an AI code analysis system.
Given a user query about a codebase, decide which specialized agents to invoke.

Available agents:
- code_analysis: Explain code, describe architecture, generate documentation, trace flows
- security: Find vulnerabilities (SQL injection, hardcoded secrets, insecure auth, exposed endpoints)

Rules:
- Always include at least one agent.
- Return ONLY the agent names as a comma-separated list. No other text.
- Examples:
  Query: "explain the authentication flow" → code_analysis
  Query: "find security vulnerabilities" → security
  Query: "explain and check for issues" → code_analysis,security
  Query: "document the API endpoints" → code_analysis
  Query: "any hardcoded secrets?" → security

User query: {query}
"""


def planner_node(state: AgentState) -> AgentState:
    query = state["query"]
    status_updates = state.get("status_updates", [])
    status_updates.append("🧠 Planning which agents to run...")

    decision = generate_text(
        PLANNER_PROMPT.format(query=query),
        max_tokens=32,
        temperature=0.0,
    ).lower()

    valid_agents = {"code_analysis", "security"}
    chosen = [a.strip() for a in decision.split(",") if a.strip() in valid_agents]
    if not chosen:
        chosen = ["code_analysis"]

    state["planner_decision"] = ",".join(chosen)
    state["agents_used"] = chosen
    state["status_updates"] = status_updates
    return state
