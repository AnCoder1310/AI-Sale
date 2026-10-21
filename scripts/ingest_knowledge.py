"""Ingest corpus into configured vector store and verify readiness.

Usage:
    python scripts/ingest_knowledge.py
    python scripts/ingest_knowledge.py --reset
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.config import get_settings  # noqa: E402
from src.knowledge.index_readiness import check_copilot_index  # noqa: E402
from src.knowledge.retrieval_service import get_retrieval_service  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest knowledge corpus and verify readiness.")
    parser.add_argument("--reset", action="store_true", default=True, help="Reset vector store before ingesting (default: True)")
    parser.add_argument("--corpus", default="data/knowledge/corpus.json", help="Path to corpus.json")
    args = parser.parse_args()

    settings = get_settings()
    print("==================================================")
    print("      VINFAST COPILOT - KNOWLEDGE INGESTION       ")
    print("==================================================")
    print(f"Backend: {settings.vector_store_type}")
    print(f"Collection: {settings.chroma_collection_name}")
    print(f"Embedding Provider: {settings.embedding_provider}")
    print(f"Embedding Model: {settings.embedding_model_name}")
    print(f"Corpus Path: {args.corpus}")
    print("Ingesting corpus...")

    service = get_retrieval_service()
    total_chunks = service.ingest_corpus(corpus_path=args.corpus, reset=args.reset)
    print(f"✓ Successfully embedded and stored {total_chunks} chunks!")

    print("\nVerifying index readiness...")
    try:
        snapshot = check_copilot_index()
        print(f"✓ Index is READY! Document count: {len(snapshot.documents)}, Chunk count: {len(snapshot.chunks)}")
    except Exception as exc:
        print(f"✗ Index verification failed: {exc}")
        sys.exit(1)

    print("\n==================================================")
    print("Knowledge Ingestion & Verification Complete!")
    print("==================================================")


if __name__ == "__main__":
    main()
