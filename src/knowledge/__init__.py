from typing import TYPE_CHECKING

from src.knowledge.chunking import chunk_document, load_and_chunk_corpus
from src.knowledge.embedding import KnowledgeEmbeddingService
from src.knowledge.retrieval_service import RetrievalService, get_retrieval_service
from src.knowledge.schemas import (
    ChunkMetadata,
    DocumentStatus,
    DocumentType,
    KnowledgeChunk,
    KnowledgeDocument,
)
from src.knowledge.vector_store import (
    BaseVectorStore,
    ChromaVectorStore,
    InMemoryVectorStore,
    get_vector_store,
)

if TYPE_CHECKING:
    from src.knowledge.ingestion import KnowledgeIngestionPipeline

__all__ = [
    "DocumentType",
    "DocumentStatus",
    "KnowledgeDocument",
    "ChunkMetadata",
    "KnowledgeChunk",
    "chunk_document",
    "load_and_chunk_corpus",
    "KnowledgeEmbeddingService",
    "BaseVectorStore",
    "InMemoryVectorStore",
    "ChromaVectorStore",
    "get_vector_store",
    "KnowledgeIngestionPipeline",
    "RetrievalService",
    "get_retrieval_service",
]


def __getattr__(name: str):
    if name == "KnowledgeIngestionPipeline":
        from src.knowledge.ingestion import KnowledgeIngestionPipeline

        return KnowledgeIngestionPipeline
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
