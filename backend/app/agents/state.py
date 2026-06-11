from typing import TypedDict, List, Optional


class AgentState(TypedDict):
    # Inputs
    query: str
    project_id: str
    conversation_history: List[dict]   # [{"role": "user"|"assistant", "content": "..."}]

    # Retrieved context
    retrieved_chunks: List[dict]        # from Pinecone

    # Agent outputs
    planner_decision: Optional[str]     # which agents to run (comma-separated)
    code_analysis: Optional[str]        # output of Code Analysis agent
    security_analysis: Optional[str]    # output of Security agent
    final_answer: Optional[str]         # composed by Report agent

    # Streaming / UI
    status_updates: List[str]           # e.g. ["Planning...", "Retrieving..."]
    agents_used: List[str]
