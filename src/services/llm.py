import hashlib
import math

from langchain_core.embeddings import Embeddings
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_openai import ChatOpenAI, OpenAIEmbeddings

from src.config import get_settings


class DeterministicHashEmbeddings(Embeddings):
    """Deterministic local embeddings generator for testing and offline development.

    Generates normalized 1536-dimensional vectors using SHA-256 tokens,
    ensuring semantic consistency across test runs without external API calls.
    """

    def __init__(self, dimension: int = 1536):
        self.dimension = dimension

    def _embed_text(self, text: str) -> list[float]:
        tokens = text.lower().split()
        vector = [0.0] * self.dimension
        if not tokens:
            return vector

        for token in tokens:
            h = int(hashlib.sha256(token.encode("utf-8")).hexdigest(), 16)
            for i in range(min(16, self.dimension)):
                idx = (h + i * 37) % self.dimension
                val = ((h >> (i * 4)) & 0xFF) / 255.0 - 0.5
                vector[idx] += val

        # Normalize L2
        norm = math.sqrt(sum(x * x for x in vector))
        if norm > 0:
            vector = [x / norm for x in vector]
        return vector

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return [self._embed_text(text) for text in texts]

    def embed_query(self, text: str) -> list[float]:
        return self._embed_text(text)

    async def aembed_documents(self, texts: list[str]) -> list[list[float]]:
        return self.embed_documents(texts)

    async def aembed_query(self, text: str) -> list[float]:
        return self.embed_query(text)


def get_llm(
    provider: str | None = None,
    model: str | None = None,
    temperature: float | None = None,
) -> BaseChatModel:
    """Factory creating LLM clients for multi-provider environments.

    Supports:
    - openai: Standard OpenAI API
    - openrouter: OpenRouter unified gateway (base_url: https://openrouter.ai/api/v1)
    - gemini: Google Gemini via OpenAI-compatible endpoint
    - grok: xAI Grok (base_url: https://api.x.ai/v1)
    - deepseek: DeepSeek (base_url: https://api.deepseek.com/v1)
    """
    settings = get_settings()
    prov = (provider or settings.llm_provider).lower()
    temp = settings.llm_temperature if temperature is None else temperature

    # Auto-detect OpenRouter if default is OpenAI but user configured OpenRouter
    if provider is None and prov == "openai" and not settings.openai_api_key and settings.openrouter_api_key:
        prov = "openrouter"

    if prov == "openrouter":
        api_key = settings.openrouter_api_key
        if not api_key:
            raise RuntimeError("OPENROUTER_API_KEY is required when LLM_PROVIDER=openrouter")
        model_name = model or settings.openrouter_model_name
        return ChatOpenAI(
            model=model_name,
            api_key=api_key,
            base_url="https://openrouter.ai/api/v1",
            temperature=temp,
        )

    if prov == "gemini":
        api_key = settings.gemini_api_key or "dummy-gemini-key"
        model_name = model or "gemini-1.5-flash"
        return ChatOpenAI(
            model=model_name,
            api_key=api_key,
            base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
            temperature=temp,
        )

    if prov == "grok":
        api_key = settings.grok_api_key or "dummy-grok-key"
        model_name = model or "grok-beta"
        return ChatOpenAI(
            model=model_name,
            api_key=api_key,
            base_url="https://api.x.ai/v1",
            temperature=temp,
        )

    if prov == "deepseek":
        api_key = settings.deepseek_api_key or "dummy-deepseek-key"
        model_name = model or "deepseek-chat"
        return ChatOpenAI(
            model=model_name,
            api_key=api_key,
            base_url="https://api.deepseek.com/v1",
            temperature=temp,
        )

    # Default: openai
    api_key = settings.openai_api_key or "sk-dummy-key"
    model_name = model or settings.model_name
    return ChatOpenAI(
        model=model_name,
        api_key=api_key,
        temperature=temp,
    )


def get_embeddings() -> Embeddings:
    """Use OpenRouter for knowledge embeddings; hash is an explicit test mode."""
    settings = get_settings()
    if settings.embedding_provider == "hash":
        return DeterministicHashEmbeddings(dimension=1536)
    if not settings.openrouter_api_key:
        raise RuntimeError("OPENROUTER_API_KEY is required for knowledge embeddings")
    return OpenAIEmbeddings(
        model=settings.embedding_model_name,
        api_key=settings.openrouter_api_key,
        base_url="https://openrouter.ai/api/v1",
        # Corpus chunks are already bounded; avoid fetching a tokenizer for the
        # OpenRouter-prefixed model name before the first embedding request.
        check_embedding_ctx_length=False,
    )
