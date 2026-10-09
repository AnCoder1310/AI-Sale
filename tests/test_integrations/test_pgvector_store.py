"""Run against a disposable pgvector database via PGVECTOR_TEST_DATABASE_URL."""

import os
from uuid import uuid4

import pytest

from src.knowledge.pgvector_store import PgVectorStore
from src.knowledge.schemas import ChunkMetadata, KnowledgeChunk


def make_chunk(chunk_id: str, model: str) -> KnowledgeChunk:
    return KnowledgeChunk(
        chunk_id=chunk_id,
        document_id=f"doc-{chunk_id}",
        content=f"Details for {model}",
        metadata=ChunkMetadata(
            chunk_id=chunk_id,
            document_id=f"doc-{chunk_id}",
            title=f"{model} test",
            document_type="product_specs",
            product_model=model,
            effective_date="2026-01-01",
            source="integration-test",
        ),
    )


def test_pgvector_store_upsert_filter_and_collection_isolation() -> None:
    database_url = os.getenv("PGVECTOR_TEST_DATABASE_URL")
    if not database_url:
        pytest.skip("Set PGVECTOR_TEST_DATABASE_URL to a disposable pgvector database")

    collection = f"test-{uuid4()}"
    store = PgVectorStore(database_url, collection)
    other = PgVectorStore(database_url, f"{collection}-other")
    try:
        store.upsert_chunks(
            [make_chunk("vf3", "VF 3"), make_chunk("vf5", "VF 5")],
            [[1.0, 0.0, 0.0], [0.0, 1.0, 0.0]],
        )
        assert store.count() == 2
        assert other.count() == 0
        assert store.get_by_id("vf3").metadata.product_model == "VF 3"
        assert store.similarity_search([1.0, 0.0, 0.0], top_k=1)[0].chunk_id == "vf3"
        assert [
            chunk.chunk_id
            for chunk in store.similarity_search([1.0, 0.0, 0.0], where={"product_model": {"$in": ["VF 5"]}})
        ] == ["vf5"]
        store.upsert_chunks([make_chunk("vf3", "VF 3")], [[0.0, 0.0, 1.0]])
        assert store.count() == 2
    finally:
        store.reset()
        other.reset()
    assert store.count() == 0
