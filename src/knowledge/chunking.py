import json
from pathlib import Path

from langchain_text_splitters import RecursiveCharacterTextSplitter

from src.knowledge.schemas import ChunkMetadata, KnowledgeChunk, KnowledgeDocument


def chunk_document(
    doc: KnowledgeDocument,
    chunk_size: int = 1000,
    chunk_overlap: int = 100,
) -> list[KnowledgeChunk]:
    """Split a KnowledgeDocument into one or more KnowledgeChunks using RecursiveCharacterTextSplitter."""
    content = doc.content.strip()
    if not content:
        return []

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        separators=["\n\n", "\n", ". ", " ", ""],
    )
    splits = splitter.split_text(content)

    chunks: list[KnowledgeChunk] = []
    for idx, text in enumerate(splits):
        chunk_id = f"{doc.document_id}_{idx}"
        metadata = ChunkMetadata(
            chunk_id=chunk_id,
            document_id=doc.document_id,
            title=doc.title,
            document_type=doc.document_type.value if hasattr(doc.document_type, "value") else str(doc.document_type),
            product_model=doc.product_model,
            competitor_model=doc.competitor_model,
            policy_type=doc.policy_type,
            effective_date=doc.effective_date,
            expiry_date=doc.expiry_date,
            status=doc.status.value if hasattr(doc.status, "value") else str(doc.status),
            source=doc.source,
            version=doc.version,
            chunk_index=idx,
        )
        chunks.append(
            KnowledgeChunk(
                chunk_id=chunk_id,
                document_id=doc.document_id,
                content=text,
                metadata=metadata,
            )
        )

    return chunks


def load_and_chunk_corpus(
    corpus_path: str | Path = "data/knowledge/corpus.json",
    chunk_size: int = 1000,
    chunk_overlap: int = 100,
) -> list[KnowledgeChunk]:
    """Load JSON corpus and chunk all valid normalized documents."""
    path = Path(corpus_path)
    if not path.exists():
        raise FileNotFoundError(f"Corpus file not found: {path}")

    raw_items = json.loads(path.read_text(encoding="utf-8"))
    all_chunks: list[KnowledgeChunk] = []

    for item in raw_items:
        doc = KnowledgeDocument.model_validate(item)
        chunks = chunk_document(doc, chunk_size=chunk_size, chunk_overlap=chunk_overlap)
        all_chunks.extend(chunks)

    return all_chunks
