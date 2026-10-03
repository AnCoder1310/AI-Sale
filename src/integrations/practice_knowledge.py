"""Ground role-play factual claims with the shared knowledge retrieval service."""

from __future__ import annotations

import re
from typing import Protocol

from src.agents.roleplay.contracts import ScenarioContract
from src.agents.roleplay.evaluator import KnowledgeEvidence
from src.agents.roleplay.state import RoleplayState
from src.knowledge.schemas import DocumentType, KnowledgeChunk


class KnowledgeRetriever(Protocol):
    def retrieve(
        self,
        query: str,
        *,
        top_k: int = 4,
        product_model: str | None = None,
        document_type: str | None = None,
    ) -> list[KnowledgeChunk]: ...


class RetrievalKnowledgeEvidenceProvider:
    """Retrieve bounded, deduplicated evidence for exact advisor claims."""

    def __init__(
        self,
        retrieval_service: KnowledgeRetriever,
        *,
        top_k_per_claim: int = 3,
        max_claims: int = 12,
    ) -> None:
        if top_k_per_claim < 1:
            raise ValueError("top_k_per_claim must be positive")
        if max_claims < 1:
            raise ValueError("max_claims must be positive")
        self._retrieval_service = retrieval_service
        self._top_k_per_claim = top_k_per_claim
        self._max_claims = max_claims

    async def for_session(
        self,
        scenario: ScenarioContract,
        state: RoleplayState,
    ) -> list[KnowledgeEvidence]:
        if scenario.scenario_id != state.scenario_id:
            raise ValueError("state and scenario identifiers do not match")

        unique_claims = list({claim.text: claim for claim in state.factual_claims}.values())[: self._max_claims]
        chunks_by_id: dict[str, KnowledgeChunk] = {}
        for claim in unique_claims:
            model_match = re.search(
                r"\bVF\s*[3-9]\b", f"{claim.text} {scenario.title} {scenario.visible_context}", re.I
            )
            product_model = re.sub(r"\s+", " ", model_match.group(0).upper()) if model_match else None
            document_type = None
            top_k = self._top_k_per_claim
            if product_model and claim.category == "price":
                document_type = DocumentType.PRICE_LIST.value
                top_k = 24  # The MSRP table is one small chunk in a long official PDF.
            elif product_model and (
                claim.category == "product"
                or (claim.category == "battery_charging" and re.search(r"\bkm\b|quãng đường|đi được", claim.text, re.I))
            ):
                document_type = DocumentType.PRODUCT_SPECS.value

            candidates = self._retrieval_service.retrieve(
                claim.text,
                top_k=top_k,
                product_model=product_model,
                document_type=document_type,
            )
            if document_type == DocumentType.PRICE_LIST.value:
                candidates = [
                    chunk
                    for chunk in candidates
                    if product_model in chunk.content and "Giá bán bán lẻ đề xuất" in chunk.content
                ]
            chunks = candidates[: self._top_k_per_claim]
            for chunk in chunks:
                chunks_by_id.setdefault(chunk.chunk_id, chunk)

        return [
            KnowledgeEvidence(
                source_id=chunk.chunk_id,
                version=chunk.metadata.version,
                content=chunk.content,
            )
            for chunk in chunks_by_id.values()
        ]
