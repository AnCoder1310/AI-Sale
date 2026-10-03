"""Regression checks for failure reporting, citations and source validity."""

import json
from datetime import date
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from src.agents.copilot import nodes
from src.agents.copilot.nodes import CopilotDependencyError
from src.api.copilot import CopilotQueryRequest, query_copilot, router
from src.knowledge.schemas import ChunkMetadata
from src.knowledge.validity import is_document_retrievable

EVIDENCE = {
    "chunk_id": "price-1",
    "document_id": "price-list",
    "content": "Giá VF 8 trong bảng giá.",
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
    "native_score": 5.0,
    "rank": 1,
    "dense_score": None,
    "bm25_score": 5.0,
    "rrf_score": 0.016,
}


@pytest.mark.asyncio
async def test_retrieval_failure_is_not_an_empty_knowledge_result(monkeypatch):
    class BrokenSearch:
        def search(self, **kwargs):
            raise TimeoutError("provider unavailable")

    async def inline_call(function, **kwargs):
        return function(**kwargs)

    monkeypatch.setattr(nodes.asyncio, "to_thread", inline_call)
    monkeypatch.setattr(nodes, "get_dense_search_engine", lambda: BrokenSearch())
    monkeypatch.setattr(nodes, "get_bm25_search_engine", lambda: BrokenSearch())
    monkeypatch.setattr(nodes, "get_settings", lambda: SimpleNamespace(retrieval_timeout_seconds=5))
    with pytest.raises(CopilotDependencyError, match="retrieval unavailable"):
        await nodes.dual_retrieval_node({"query": "Giá VF 8"})


@pytest.mark.asyncio
async def test_generation_failure_is_not_abstention(monkeypatch):
    class BrokenModel:
        async def ainvoke(self, messages):
            raise TimeoutError("provider unavailable")

    monkeypatch.setattr(nodes, "get_llm", lambda: BrokenModel())
    monkeypatch.setattr(nodes, "get_settings", lambda: SimpleNamespace(llm_timeout_seconds=5))
    with pytest.raises(CopilotDependencyError, match="generation unavailable"):
        await nodes.generate_node({"query": "Giá VF 8", "selected_evidence": [EVIDENCE]})


@pytest.mark.asyncio
async def test_retry_does_not_attach_citation_to_unsupported_claim(monkeypatch):
    class Model:
        async def ainvoke(self, messages):
            return SimpleNamespace(
                content=json.dumps({"status": "answered", "answer": "Giảm giá 50%.", "citation_ids": ["C1"]})
            )

    monkeypatch.setattr(nodes, "get_llm", lambda: Model())
    monkeypatch.setattr(nodes, "get_settings", lambda: SimpleNamespace(llm_timeout_seconds=5))
    result = await nodes.generate_node(
        {"query": "Giá VF 8", "selected_evidence": [EVIDENCE], "validation_error": "missing citation"}
    )
    assert result["draft_response"] is None
    assert "citation" in result["validation_error"]


@pytest.mark.asyncio
async def test_api_reports_dependency_failure_for_retry(monkeypatch):
    async def broken_graph(state):
        raise CopilotDependencyError("generation unavailable")

    monkeypatch.setattr("src.api.copilot.copilot_agent.ainvoke", broken_graph)
    with pytest.raises(HTTPException) as exc:
        await query_copilot(CopilotQueryRequest(query="Giá VF 8"))
    assert exc.value.status_code == 503


def test_current_lookup_excludes_expired_or_out_of_date_documents():
    metadata = ChunkMetadata(
        chunk_id="c1",
        document_id="p1",
        title="Chính sách",
        document_type="policy",
        product_model="VF 8",
        effective_date=date(2025, 1, 1),
        expiry_date=date(2025, 12, 31),
        status="active",
        source="https://example.com",
        version="1",
    )
    assert not is_document_retrievable(metadata, date(2026, 1, 1))
    metadata.status = "expired"
    assert not is_document_retrievable(metadata)
    assert is_document_retrievable(metadata, date(2025, 6, 1))


def test_public_ingest_endpoint_is_not_registered():
    assert not any(getattr(route, "path", "") == "/copilot/ingest" for route in router.routes)
