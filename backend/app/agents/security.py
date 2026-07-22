from backend.app.agents.state import AgentState
from backend.app.agents.retrieval import _format_chunks_for_prompt
from backend.app.services.llm import generate_text

SECURITY_PROMPT = """\
You are an expert application security engineer performing a security audit.

USER QUERY:
{query}

RELEVANT CODE CHUNKS (retrieved from codebase):
{chunks}

TASK:
Analyze the code chunks above for security vulnerabilities. Look for:
1. SQL Injection — string-concatenated queries, unsanitised user input in DB calls
2. Hardcoded Secrets — API keys, passwords, tokens embedded in source code
3. Insecure Authentication — weak JWT handling, missing auth middleware, plain-text passwords
4. Exposed Sensitive Endpoints — admin routes without auth, debug endpoints in production
5. CORS Misconfiguration — wildcard origins on sensitive routes
6. Insecure Direct Object References (IDOR) — accessing resources without ownership checks
7. Command Injection — subprocess calls with user-controlled input
8. Dependency Issues — obviously outdated or insecure imports (if visible)

Format your response as:
## Security Analysis

### 🔴 Critical Issues
(list if any)

### 🟡 Medium Issues
(list if any)

### 🟢 Low / Informational
(list if any)

### ✅ Observations
(anything that looks secure or well-handled)

For each issue: state the file + line range, describe the vulnerability, and suggest a fix.
If no issues are found in the retrieved chunks, say so clearly.
"""


def security_node(state: AgentState) -> AgentState:
    agents_to_run = state.get("planner_decision", "").split(",")
    if "security" not in agents_to_run:
        return state

    status_updates = state.get("status_updates", [])
    status_updates.append("🔒 Running Security Analysis agent...")

    chunks_text = _format_chunks_for_prompt(state.get("retrieved_chunks", []))

    analysis = generate_text(
        SECURITY_PROMPT.format(
            query=state["query"],
            chunks=chunks_text,
        ),
        max_tokens=1400,
        temperature=0.1,
    )

    state["security_analysis"] = analysis
    state["status_updates"] = status_updates
    return state
