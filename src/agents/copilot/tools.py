"""Dense/sparse retrieval adapters, rank fusion and evidence formatting."""

import logging
import re
import unicodedata
from datetime import date
from pathlib import Path
from typing import Literal

from rank_bm25 import BM25Okapi

from src.agents.copilot.state import Citation, FusedHit, RetrievalHit
from src.knowledge.chunking import load_and_chunk_corpus
from src.knowledge.retrieval_service import get_retrieval_service
from src.knowledge.schemas import KnowledgeChunk
from src.knowledge.validity import is_document_retrievable

logger = logging.getLogger(__name__)
TOKEN_PATTERN = re.compile(r"(?u)(?i:VF[\s-]*\d+)\b|\d+(?:[.,]\d+)*|[\w]+(?:-[\w]+)*")
STOP_WORDS = {
    "hôm",
    "nay",
    "thời",
    "tiết",
    "thế",
    "nào",
    "bạn",
    "ơi",
    "gì",
    "sao",
    "và",
    "của",
    "cho",
    "các",
    "những",
    "để",
    "với",
    "thì",
    "mà",
    "là",
    "có",
    "được",
    "tôi",
    "anh",
    "chị",
    "em",
    "này",
    "đó",
    "ở",
    "tại",
    "một",
    "vào",
    "không",
    "nhé",
    "ạ",
}


def tokenize_text(text: str) -> list[str]:
    tokens = TOKEN_PATTERN.findall(unicodedata.normalize("NFKC", text))
    return [re.sub(r"^vf[\s-]*(\d+)$", r"vf-\1", token.casefold()) for token in tokens]


def _make_hit(chunk: KnowledgeChunk, score: float, rank: int, method: Literal["dense", "bm25"]) -> RetrievalHit:
    meta = chunk.metadata
    return {
        "chunk_id": chunk.chunk_id,
        "document_id": chunk.document_id,
        "content": chunk.content,
        "title": meta.title,
        "section": None,
        "page": None,
        "source_uri": meta.source,
        "effective_from": str(meta.effective_date),
        "effective_to": str(meta.expiry_date) if meta.expiry_date else None,
        "status": meta.status,
        "version": meta.version,
        "product_model": meta.product_model,
        "retrieval_method": method,
        "native_score": float(score),
        "rank": rank,
    }


class BM25SearchEngine:
    def __init__(self, corpus_path: str | Path = "data/knowledge/corpus.json"):
        self.corpus_path = Path(corpus_path)
        self._chunks: list[KnowledgeChunk] = []
        self._bm25: BM25Okapi | None = None
        self.reindex()

    def reindex(self, corpus_path: str | Path | None = None) -> None:
        """Build in local variables so a failed reload preserves the previous index."""
        path = Path(corpus_path) if corpus_path is not None else self.corpus_path
        chunks = load_and_chunk_corpus(path)
        tokenized = [
            tokenize_text(
                f"{chunk.metadata.title}\n{chunk.metadata.product_model}\n{chunk.document_id}\n{chunk.content}"
            )
            for chunk in chunks
        ]
        bm25 = BM25Okapi(tokenized) if tokenized and any(tokenized) else None
        self.corpus_path, self._chunks, self._bm25 = path, chunks, bm25
        logger.info("BM25 indexed %d chunks", len(chunks))

    def search(self, query: str, top_k: int = 10, target_date: date | None = None) -> list[RetrievalHit]:
        if self._bm25 is None or top_k <= 0:
            return []
        tokens = [token for token in tokenize_text(query) if token not in STOP_WORDS]
        if not tokens:
            return []
        scored = sorted(zip(self._bm25.get_scores(tokens), self._chunks), key=lambda pair: pair[0], reverse=True)
        hits = []
        for score, chunk in scored:
            if score > 0 and is_document_retrievable(chunk.metadata, target_date):
                hits.append(_make_hit(chunk, score, len(hits) + 1, "bm25"))
                if len(hits) >= top_k:
                    break
        return hits


class DenseSearchEngine:
    def __init__(self):
        self.retrieval_service = get_retrieval_service()

    def search(self, query: str, top_k: int = 10, target_date: date | None = None) -> list[RetrievalHit]:
        results = self.retrieval_service.retrieve_with_scores(query=query, top_k=top_k, target_date=target_date)
        return [_make_hit(chunk, score, rank, "dense") for rank, (chunk, score) in enumerate(results, start=1)]


def reciprocal_rank_fusion(
    dense_hits: list[RetrievalHit],
    sparse_hits: list[RetrievalHit],
    rrf_k: int = 60,
    top_k: int = 8,
    target_date: date | None = None,
) -> list[FusedHit]:
    fused: dict[str, FusedHit] = {}
    for hits, score_key in ((dense_hits, "dense_score"), (sparse_hits, "bm25_score")):
        seen = set()
        for hit in hits:
            cid = hit["chunk_id"]
            if cid in seen:
                continue
            seen.add(cid)
            if cid not in fused:
                fused[cid] = {**hit, "dense_score": None, "bm25_score": None, "rrf_score": 0.0}
            fused[cid][score_key] = hit["native_score"]
            fused[cid]["rrf_score"] += 1.0 / (rrf_k + hit["rank"])

    def sort_key(hit: FusedHit) -> float:
        base = hit["rrf_score"]
        if target_date is None and hit.get("status") == "active":
            return base + 0.002
        return base

    ranked = sorted(fused.values(), key=sort_key, reverse=True)[:top_k]
    return [{**hit, "rank": rank} for rank, hit in enumerate(ranked, start=1)]


def build_evidence_context(hits: list[RetrievalHit]) -> tuple[str, list[Citation]]:
    blocks, citations = [], []
    for idx, hit in enumerate(hits, start=1):
        cid = f"C{idx}"
        blocks.append(
            f"[{cid}]\n"
            f"document_id: {hit['document_id']}\n"
            f"title: {hit['title']}\n"
            f"product_model: {hit['product_model']}\n"
            f"status: {hit['status']}\n"
            f"version: {hit['version']}\n"
            f"effective_from: {hit['effective_from'] or 'Chưa xác định'}\n"
            f"effective_to: {hit['effective_to'] or 'Chưa xác định'}\n"
            f"source: {hit['source_uri'] or hit['document_id']}\n"
            f"content:\n{hit['content']}"
        )
        citations.append(
            Citation(
                citation_id=cid,
                chunk_id=hit["chunk_id"],
                document_id=hit["document_id"],
                title=hit["title"],
                section=hit["section"],
                page=hit["page"],
                effective_from=hit["effective_from"],
                effective_to=hit["effective_to"],
                source_uri=hit["source_uri"],
            )
        )
    return "\n\n---\n\n".join(blocks), citations


_bm25_instance: BM25SearchEngine | None = None
_dense_instance: DenseSearchEngine | None = None


def get_bm25_search_engine() -> BM25SearchEngine:
    global _bm25_instance
    if _bm25_instance is None:
        _bm25_instance = BM25SearchEngine()
    return _bm25_instance


def get_dense_search_engine() -> DenseSearchEngine:
    global _dense_instance
    if _dense_instance is None:
        _dense_instance = DenseSearchEngine()
    return _dense_instance
