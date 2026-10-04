from langgraph.graph import END, START, StateGraph

from src.agents.copilot.nodes import (
    MAX_RETRIES,
    abstain_node,
    dual_retrieval_node,
    evidence_gate_node,
    generate_node,
    rrf_fusion_node,
    validate_response_node,
)
from src.agents.copilot.state import CopilotState


def route_after_evidence_gate(state: CopilotState) -> str:
    """Conditional Edge 1: Route to generation if evidence is sufficient, else abstain directly."""
    if state.get("evidence_status") == "sufficient":
        return "generate"
    return "abstain"


def route_after_validation(state: CopilotState) -> str:
    """Conditional Edge 2: Complete if valid, retry once if invalid, or fail closed to abstain."""
    if state.get("validation_status") == "valid":
        return "end"
    if state.get("retry_count", 0) <= MAX_RETRIES:
        return "retry"
    return "abstain"


def build_copilot_graph() -> StateGraph:
    """Compile the six-node baseline with at most one generation retry."""
    graph = StateGraph(CopilotState)

    # 1. Add Nodes
    graph.add_node("dual_retrieval", dual_retrieval_node)
    graph.add_node("rrf_fusion", rrf_fusion_node)
    graph.add_node("evidence_gate", evidence_gate_node)
    graph.add_node("generate", generate_node)
    graph.add_node("validate_response", validate_response_node)
    graph.add_node("abstain", abstain_node)

    # 2. Add Edges & Conditional Edges
    graph.add_edge(START, "dual_retrieval")
    graph.add_edge("dual_retrieval", "rrf_fusion")
    graph.add_edge("rrf_fusion", "evidence_gate")

    graph.add_conditional_edges(
        "evidence_gate",
        route_after_evidence_gate,
        {
            "generate": "generate",
            "abstain": "abstain",
        },
    )

    graph.add_edge("generate", "validate_response")

    graph.add_conditional_edges(
        "validate_response",
        route_after_validation,
        {
            "end": END,
            "retry": "generate",
            "abstain": "abstain",
        },
    )

    graph.add_edge("abstain", END)

    return graph.compile()


copilot_agent = build_copilot_graph()
