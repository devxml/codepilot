from backend.app.agents.state import AgentState

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

    # Routing is deterministic, so do not spend a model request deciding
    # which agent to use. This removes a full network round trip per question.
    security_terms = (
        "security", "vulnerab", "secret", "api key", "password", "token",
        "injection", "authentication", "authorization", "idor", "cors",
    )
    query_lower = query.lower()
    asks_for_security = any(term in query_lower for term in security_terms)
    asks_for_analysis = any(
        term in query_lower
        for term in (
            "explain", "architecture", "database", "flow", "how", "what",
            "where", "describe", "document",
        )
    )

    if asks_for_security and asks_for_analysis:
        chosen = ["code_analysis", "security"]
    elif asks_for_security:
        chosen = ["security"]
    else:
        chosen = ["code_analysis"]

    state["planner_decision"] = ",".join(chosen)
    state["agents_used"] = chosen
    state["status_updates"] = status_updates
    return state
