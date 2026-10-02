import logging

from langchain_core.embeddings import Embeddings

from src.knowledge.schemas import KnowledgeChunk
from src.services.llm import get_embeddings

logger = logging.getLogger(__name__)


class KnowledgeEmbeddingService:
    """Service tạo vector embedding cho corpus và truy vấn."""

    def __init__(self, embeddings: Embeddings | None = None):
        self.embeddings = embeddings or get_embeddings()

    @property
    def model_name(self) -> str:
        """Tên và thông số mô hình embedding đang sử dụng."""
        if hasattr(self.embeddings, "model"):
            return f"OpenRouter ({getattr(self.embeddings, 'model')})"
        if hasattr(self.embeddings, "model_name"):
            return f"OpenRouter ({getattr(self.embeddings, 'model_name')})"
        if hasattr(self.embeddings, "dimension"):
            from src.config import get_settings

            target = get_settings().embedding_model_name
            return f"DeterministicHashEmbeddings (target: {target}, dim: {getattr(self.embeddings, 'dimension')})"
        return self.embeddings.__class__.__name__

    def embed_chunks(self, chunks: list[KnowledgeChunk]) -> list[list[float]]:
        """Mã hóa toàn bộ danh sách chunks thành vector embedding."""
        if not chunks:
            return []
        texts = [c.content for c in chunks]
        return self.embeddings.embed_documents(texts)

    def embed_query(self, query: str) -> list[float]:
        """Mã hóa câu hỏi truy vấn của người dùng thành vector."""
        return self.embeddings.embed_query(query)

    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        """Mã hóa danh sách chuỗi văn bản thành vector."""
        if not texts:
            return []
        return self.embeddings.embed_documents(texts)
