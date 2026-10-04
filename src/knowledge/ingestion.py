"""Validate and embed the complete corpus before any destructive index reset."""

import json
import logging
import sys
import time
from pathlib import Path
from typing import Any

# Ensure project root is on sys.path when executed directly as a script
ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.knowledge.chunking import chunk_document  # noqa: E402
from src.knowledge.embedding import KnowledgeEmbeddingService  # noqa: E402
from src.knowledge.schemas import KnowledgeDocument  # noqa: E402
from src.knowledge.vector_store import BaseVectorStore, get_vector_store  # noqa: E402

logger = logging.getLogger(__name__)


class KnowledgeIngestionPipeline:
    def __init__(
        self,
        vector_store: BaseVectorStore | None = None,
        embedding_service: KnowledgeEmbeddingService | None = None,
        chunk_size: int = 1000,
        chunk_overlap: int = 100,
    ):
        self.vector_store = vector_store if vector_store is not None else get_vector_store()
        self.embedding_service = embedding_service if embedding_service is not None else KnowledgeEmbeddingService()
        self.chunk_size, self.chunk_overlap = chunk_size, chunk_overlap

    def run(self, corpus_path: str | Path = "data/knowledge/corpus.json", reset: bool = False) -> dict[str, Any]:
        start = time.perf_counter()
        raw = json.loads(Path(corpus_path).read_text(encoding="utf-8"))
        if not isinstance(raw, list) or not raw:
            raise ValueError("Corpus must be a non-empty document list")
        documents = [KnowledgeDocument.model_validate(item) for item in raw]
        if len({doc.document_id for doc in documents}) != len(documents):
            raise ValueError("Corpus contains duplicate document IDs")
        chunks = [
            chunk
            for doc in documents
            for chunk in chunk_document(doc, chunk_size=self.chunk_size, chunk_overlap=self.chunk_overlap)
        ]
        if not chunks or any(not doc.content.strip() for doc in documents):
            raise ValueError("Corpus contains empty document content")
        vectors = self.embedding_service.embed_chunks(chunks)
        if len(vectors) != len(chunks) or not vectors or not vectors[0]:
            raise ValueError("Embedding output does not match the corpus chunks")
        if any(len(vector) != len(vectors[0]) for vector in vectors):
            raise ValueError("Embedding output contains inconsistent vector dimensions")
        if reset:
            self.vector_store.reset()
        try:
            self.vector_store.upsert_chunks(chunks, vectors)
        except Exception as exc:
            logger.error("Failed to upsert chunks into vector store: %s", exc)
            raise RuntimeError(f"Failed to upsert chunks into vector store: {exc}") from exc
        return {
            "status": "success",
            "documents": len(documents),
            "chunks": len(chunks),
            "chunking_strategy": f"RecursiveCharacterTextSplitter (chunk_size={self.chunk_size}, chunk_overlap={self.chunk_overlap})",
            "embedding_model": self.embedding_service.model_name,
            "vector_store": self.vector_store.__class__.__name__,
            "elapsed_seconds": round(time.perf_counter() - start, 3),
            "errors": [],
        }


if __name__ == "__main__":
    import argparse

    from src.agents.copilot.tools import get_bm25_search_engine
    from src.knowledge.retrieval_service import get_retrieval_service

    parser = argparse.ArgumentParser(description="Ingest corpus without resetting existing data by default")
    parser.add_argument("--corpus", default="data/knowledge/corpus.json")
    parser.add_argument("--reset", action="store_true", help="Explicitly replace all existing vectors")
    args = parser.parse_args()

    retriever = get_retrieval_service()
    pipeline = KnowledgeIngestionPipeline(retriever.vector_store, retriever.embedding_service)
    result = pipeline.run(args.corpus, reset=args.reset)
    get_bm25_search_engine().reindex(args.corpus)

    print("=" * 65)
    print("KNOWLEDGE INGESTION PIPELINE")
    print("=" * 65)
    print(f"* Status            : {result['status'].upper()}")
    print(f"* Total Documents   : {result['documents']}")
    print(f"* Total Chunks      : {result['chunks']}")
    print(f"* Embedding Model   : {result['embedding_model']}")
    print(f"* Vector Store      : {result['vector_store']}")
    print(f"* Chunking Strategy : {result['chunking_strategy']}")
    print(f"* Reset Existing DB : {args.reset}")
    print(f"* Execution Time    : {result['elapsed_seconds']}s")
    print("=" * 65)
