from types import SimpleNamespace

import pytest
from langchain_openai import OpenAIEmbeddings

from src.services import llm


def test_openrouter_embeddings_use_openrouter_key_and_endpoint(monkeypatch):
    monkeypatch.setattr(
        llm,
        "get_settings",
        lambda: SimpleNamespace(
            embedding_provider="openrouter",
            embedding_model_name="openai/text-embedding-3-small",
            openrouter_api_key="test-openrouter-key",
            retrieval_timeout_seconds=20.0,
        ),
    )

    embeddings = llm.get_embeddings()

    assert isinstance(embeddings, OpenAIEmbeddings)
    assert embeddings.model == "openai/text-embedding-3-small"
    assert embeddings.openai_api_base == "https://openrouter.ai/api/v1"
    assert embeddings.openai_api_key.get_secret_value() == "test-openrouter-key"
    assert embeddings.check_embedding_ctx_length is False


def test_openrouter_embeddings_require_key_instead_of_silent_hash_fallback(monkeypatch):
    monkeypatch.setattr(
        llm,
        "get_settings",
        lambda: SimpleNamespace(embedding_provider="openrouter", openrouter_api_key=""),
    )

    with pytest.raises(ValueError, match="OPENROUTER_API_KEY"):
        llm.get_embeddings()


def test_hash_embeddings_are_explicit_test_mode(monkeypatch):
    monkeypatch.setattr(llm, "get_settings", lambda: SimpleNamespace(embedding_provider="hash"))

    assert isinstance(llm.get_embeddings(), llm.DeterministicHashEmbeddings)
