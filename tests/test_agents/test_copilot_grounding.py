"""Regression checks after integrating the baseline Copilot graph."""

from datetime import date

import pytest

from src.agents.copilot.graph import copilot_agent
from src.agents.copilot.nodes import evidence_gate_node, validate_response_node
from src.agents.copilot.state import Citation, CopilotResponse


def _hit(document_id: str, chunk_id: str, score: float) -> dict:
    return {
        "chunk_id": chunk_id,
        "document_id": document_id,
        "content": "VF 8 có trong bảng giá.",
        "title": "Bảng giá",
        "section": None,
        "page": None,
        "source_uri": "https://example.com/price.pdf",
        "effective_from": "2026-01-01",
        "effective_to": None,
        "status": "active",
        "version": "1",
        "product_model": "VF 8",
        "retrieval_method": "bm25",
        "native_score": score,
        "rank": 1,
        "dense_score": None,
        "bm25_score": score,
        "rrf_score": 0.016,
    }


def test_integrated_graph_uses_hybrid_retrieval():
    names = set(copilot_agent.get_graph().nodes)
    assert {"dual_retrieval", "rrf_fusion", "evidence_gate", "generate", "validate_response"} <= names


@pytest.mark.asyncio
async def test_price_evidence_can_pass_gate_without_dense_match():
    result = await evidence_gate_node({"fused_hits": [_hit("PRICE_LIST", "price-1", 3.0)]})
    assert result["evidence_status"] == "sufficient"
    assert [item["document_id"] for item in result["selected_evidence"]] == ["PRICE_LIST"]


@pytest.mark.asyncio
async def test_citation_from_other_document_is_rejected():
    evidence = _hit("PRICE_LIST", "price-1", 3.0)
    draft = CopilotResponse(
        status="answered",
        answer="VF 8 có trong bảng giá [C1].",
        citations=[
            Citation(
                citation_id="C1",
                chunk_id="price-1",
                document_id="WRONG_DOCUMENT",
                title="Bảng giá",
                effective_from=date(2026, 1, 1).isoformat(),
            )
        ],
    )
    result = await validate_response_node({"selected_evidence": [evidence], "draft_response": draft})
    assert result["validation_status"] == "invalid"
