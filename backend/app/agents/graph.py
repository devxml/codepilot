"""
backend/app/agents/graph.py
Builds and compiles the LangGraph multi-agent state graph.

Graph topology:
    START
      ↓
    retrieval          ← always runs first to fetch context
      ↓
    planner            ← decides which analysis agents to run
      ↓
    code_analysis      ← runs if planner chose it (else passes through)
      ↓
    security           ← runs if planner chose it (else passes through)
      ↓
    report             ← always runs to compose final answer
      ↓
    END
"""
from langgraph.graph import StateGraph, START, END
from backend.app.agents.state import AgentState
from backend.app.agents.retrieval import retrieval_node
from backend.app.agents.planner import planner_node
from backend.app.agents.code_analysis import code_analysis_node
from backend.app.agents.security import security_node
from backend.app.agents.report import report_node


def build_graph():
    graph = StateGraph(AgentState)

    # Register nodes
    graph.add_node("retrieval", retrieval_node)
    graph.add_node("planner", planner_node)
    graph.add_node("code_analysis_agent", code_analysis_node)
    graph.add_node("security", security_node)
    graph.add_node("report", report_node)

    # Wire edges (linear for now; agents self-skip if not chosen by planner)
    graph.add_edge(START, "retrieval")
    graph.add_edge("retrieval", "planner")
    graph.add_edge("planner", "code_analysis_agent")
    graph.add_edge("code_analysis_agent", "security")
    graph.add_edge("security", "report")
    graph.add_edge("report", END)

    return graph.compile()


# Compile once at import time and reuse
compiled_graph = build_graph()
