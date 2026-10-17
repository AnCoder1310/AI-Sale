"""Date-aware scenario policy resolution, shared by runtime and offline checks."""

from __future__ import annotations

import json
import re
from datetime import date
from pathlib import Path
from typing import Literal, Protocol

from pydantic import BaseModel, Field

from src.agents.roleplay.contracts import ScenarioContract
from src.agents.roleplay.contracts import policy_prompt_context as policy_prompt_context
from src.knowledge.schemas import ChunkMetadata, KnowledgeChunk
from src.knowledge.validity import is_document_retrievable, parse_target_date


class PolicyRetriever(Protocol):
    def retrieve(
        self,
        query: str,
        *,
        product_model: str | None = None,
        document_type: str | None = None,
        top_k: int = 3,
        target_date: date | None = None,
    ) -> list[KnowledgeChunk]: ...


class ResolvedPolicySource(BaseModel):
    document_id: str
    version: str
    effective_date: date | None = None
    expiry_date: date | None = None
    valid_until: date | None = None
    quote: str


class ResolvedPolicy(BaseModel):
    policy_id: str
    level: Literal["expected", "bonus"]
    topic: str
    status: Literal["found", "not_applicable"]
    sources: list[ResolvedPolicySource] = Field(default_factory=list)


def application_section(text: str, anchor: str | None = None) -> str:
    """Return the numbered programme section containing an exact lookup anchor."""
    if not anchor:
        return text
    match = re.search(re.escape(anchor), text, re.I)
    if match is None:
        return text
    headings = list(re.finditer(r"^\s*\d+\.\s*\|", text, re.M))
    preceding = [heading for heading in headings if heading.start() <= match.start()]
    if not preceding:
        return text
    start = preceding[-1].start()
    end = next((heading.start() for heading in headings if heading.start() > match.start()), len(text))
    return text[start:end].strip()


def application_window(text: str, anchor: str | None = None) -> tuple[date | None, date | None]:
    """Apply only one unambiguous period, scoped to the lookup's programme."""
    section = application_section(text, anchor)
    matches = re.finditer(
        r"thời\s+gian\s+áp\s+dụng\s*[:：]?\s*(?:từ\s*)?(?:ngày\s*)?"
        r"(\d{1,2}/\d{1,2}/\d{4})\s*(?:đến|tới|[-–—])\s*(?:hết\s*)?(?:ngày\s*)?"
        r"(\d{1,2}/\d{1,2}/\d{4})",
        section,
        re.I,
    )
    windows: list[tuple[date, date]] = []
    for match in matches:
        try:
            start, end = (date(*map(int, value.split("/")[::-1])) for value in match.groups())
        except ValueError:
            continue
        windows.append((start, end))
    return windows[0] if len(windows) == 1 else (None, None)


def valid_policy_chunk(chunk: KnowledgeChunk, target_date: date, anchor: str | None = None) -> bool:
    start, end = application_window(chunk.content, anchor)
    return (
        is_document_retrievable(chunk.metadata, target_date)
        and (start is None or start <= target_date)
        and (end is None or target_date <= end)
    )


class ScenarioPolicyResolver:
    def __init__(self, retriever: PolicyRetriever) -> None:
        self.retriever = retriever

    def resolve(self, scenario: ScenarioContract, target_date: date) -> list[ResolvedPolicy]:
        policies = []
        for expectation in scenario.policy_expectations:
            lookup = expectation.lookup
            chunks = self.retriever.retrieve(
                lookup.query,
                product_model=lookup.product_model,
                document_type=lookup.document_type,
                top_k=3,
                target_date=target_date,
            )
            sources = []
            seen = set()
            for chunk in chunks:
                if lookup.policy_type and chunk.metadata.policy_type != lookup.policy_type:
                    continue
                if not valid_policy_chunk(chunk, target_date, lookup.query):
                    continue
                key = (chunk.document_id, chunk.metadata.version, chunk.content)
                if key in seen:
                    continue
                seen.add(key)
                end = application_window(chunk.content, lookup.query)[1]
                expiry = parse_target_date(chunk.metadata.expiry_date)
                sources.append(
                    ResolvedPolicySource(
                        document_id=chunk.document_id,
                        version=chunk.metadata.version,
                        effective_date=parse_target_date(chunk.metadata.effective_date),
                        expiry_date=expiry,
                        valid_until=min(value for value in (end, expiry) if value is not None)
                        if end or expiry
                        else None,
                        quote=application_section(chunk.content, lookup.query),
                    )
                )
            policies.append(
                ResolvedPolicy(
                    policy_id=expectation.policy_id,
                    level=expectation.level,
                    topic=expectation.topic,
                    status="found" if sources else "not_applicable",
                    sources=sources,
                )
            )
        return policies


class OfflinePolicyRetriever:
    """Small keyword index over complete documents; no model or network dependency."""

    def __init__(self, paths: list[Path]) -> None:
        self.chunks: list[KnowledgeChunk] = []
        for path in paths:
            documents = json.loads(path.read_text(encoding="utf-8"))
            for doc in documents:
                metadata = ChunkMetadata.model_validate(
                    {**doc, "chunk_id": doc["document_id"], "source": doc.get("source", str(path))}
                )
                self.chunks.append(
                    KnowledgeChunk(
                        chunk_id=doc["document_id"],
                        document_id=doc["document_id"],
                        content=doc["content"],
                        metadata=metadata,
                    )
                )

    def matching(self, query: str, *, product_model: str | None, document_type: str | None) -> list[KnowledgeChunk]:
        tokens = set(re.findall(r"\w+", query.casefold())) - {
            "cho",
            "của",
            "và",
            "xe",
            "chính",
            "sách",
            "vf",
            "tại",
            "nhà",
        }
        ranked = []
        for chunk in self.chunks:
            meta = chunk.metadata
            if document_type and meta.document_type != document_type:
                continue
            if product_model and meta.product_model not in {product_model, "ALL"}:
                continue
            text = f"{meta.title} {chunk.content}".casefold()
            words = set(re.findall(r"\w+", text))
            score = len(tokens & words)
            # Promotion names must share a phrase, not isolated words or digits
            # scattered through an unrelated promotion (e.g. VinClub tables).
            query_words = re.findall(r"\w+", query.casefold())
            normalized_text = " ".join(re.findall(r"\w+", text))
            phrase_match = any(
                " ".join(query_words[index : index + 3]) in normalized_text for index in range(len(query_words) - 2)
            )
            if document_type == "promotion" and len(query_words) >= 3 and not phrase_match:
                continue
            if tokens and score / len(tokens) >= 0.8:
                ranked.append((score, chunk))
        ranked.sort(key=lambda item: item[0], reverse=True)
        return [chunk for _, chunk in ranked]

    def retrieve(
        self,
        query: str,
        *,
        product_model: str | None = None,
        document_type: str | None = None,
        top_k: int = 3,
        target_date: date | None = None,
    ) -> list[KnowledgeChunk]:
        chunks = self.matching(query, product_model=product_model, document_type=document_type)
        return [chunk for chunk in chunks if is_document_retrievable(chunk.metadata, target_date)][:top_k]
