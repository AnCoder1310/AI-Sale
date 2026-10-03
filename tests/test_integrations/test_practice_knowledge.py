from datetime import date
from pathlib import Path

import pytest

from src.agents.roleplay.scenario_loader import ScenarioRepository
from src.agents.roleplay.state import AdvisorFactualClaim, RoleplayState
from src.integrations.practice_knowledge import RetrievalKnowledgeEvidenceProvider
from src.knowledge.schemas import ChunkMetadata, KnowledgeChunk

SCENARIOS = Path("data/scenarios/scenarios.json")


def knowledge_chunk(chunk_id: str, content: str) -> KnowledgeChunk:
    return KnowledgeChunk(
        chunk_id=chunk_id,
        document_id=f"doc-{chunk_id}",
        content=content,
        metadata=ChunkMetadata(
            chunk_id=chunk_id,
            document_id=f"doc-{chunk_id}",
            title="Nguồn VinFast",
            document_type="policy",
            product_model="VF 5",
            effective_date=date(2026, 1, 1),
            source="https://example.test/vinfast",
            version="2026.1",
        ),
    )


class RecordingRetriever:
    def __init__(self) -> None:
        self.calls: list[tuple[str, int, str | None, str | None]] = []

    def retrieve(
        self,
        query: str,
        *,
        top_k: int = 4,
        product_model: str | None = None,
        document_type: str | None = None,
    ) -> list[KnowledgeChunk]:
        self.calls.append((query, top_k, product_model, document_type))
        return [
            knowledge_chunk("chunk-shared", "Nội dung chính sách đã phê duyệt."),
            knowledge_chunk(f"chunk-{len(self.calls)}", f"Evidence cho {query}"),
        ]


def scenario_and_state():
    scenario = ScenarioRepository(SCENARIOS).get("SCENARIO_01_VF5_TAXI")
    state = RoleplayState.from_scenario("session-1", scenario)
    state.factual_claims = [
        AdvisorFactualClaim(message_id="m1", text="VF 5 có chính sách bảo hành", category="warranty"),
        AdvisorFactualClaim(message_id="m2", text="VF 5 có ưu đãi", category="promotion"),
        AdvisorFactualClaim(message_id="m3", text="VF 5 có ưu đãi", category="promotion"),
    ]
    return scenario, state


@pytest.mark.asyncio
async def test_provider_retrieves_each_unique_claim_and_deduplicates_chunks():
    scenario, state = scenario_and_state()
    retriever = RecordingRetriever()
    provider = RetrievalKnowledgeEvidenceProvider(retriever, top_k_per_claim=2)

    evidence = await provider.for_session(scenario, state)

    assert retriever.calls == [
        ("VF 5 có chính sách bảo hành", 2, "VF 5", None),
        ("VF 5 có ưu đãi", 2, "VF 5", None),
    ]
    assert [item.source_id for item in evidence] == ["chunk-shared", "chunk-1", "chunk-2"]
    assert all(item.version == "2026.1" for item in evidence)


@pytest.mark.asyncio
async def test_provider_returns_no_evidence_when_advisor_made_no_factual_claims():
    scenario, state = scenario_and_state()
    state.factual_claims = []
    retriever = RecordingRetriever()

    evidence = await RetrievalKnowledgeEvidenceProvider(retriever).for_session(scenario, state)

    assert evidence == []
    assert retriever.calls == []


@pytest.mark.asyncio
async def test_provider_uses_model_and_msrp_table_for_price_claim():
    scenario, state = scenario_and_state()
    state.factual_claims = [AdvisorFactualClaim(message_id="m1", text="VF 5 Plus giá 100 triệu", category="price")]

    class PriceRetriever(RecordingRetriever):
        def retrieve(self, query, *, top_k=4, product_model=None, document_type=None):
            self.calls.append((query, top_k, product_model, document_type))
            return [
                knowledge_chunk("charger", "VF 5 bộ sạc 11.000.000 VNĐ"),
                knowledge_chunk("msrp", "Giá bán bán lẻ đề xuất\nVF 5 | Plus | 496.000.000 VNĐ"),
            ]

    retriever = PriceRetriever()
    evidence = await RetrievalKnowledgeEvidenceProvider(retriever).for_session(scenario, state)

    assert retriever.calls == [("VF 5 Plus giá 100 triệu", 24, "VF 5", "price_list")]
    assert [item.source_id for item in evidence] == ["msrp"]


@pytest.mark.asyncio
async def test_range_per_charge_claim_uses_product_specs_even_when_labeled_charging():
    scenario, state = scenario_and_state()
    state.factual_claims = [
        AdvisorFactualClaim(message_id="m1", text="đi được 1.000 km mỗi lần sạc", category="battery_charging")
    ]
    retriever = RecordingRetriever()

    await RetrievalKnowledgeEvidenceProvider(retriever).for_session(scenario, state)

    assert retriever.calls == [("đi được 1.000 km mỗi lần sạc", 3, "VF 5", "product_specs")]


@pytest.mark.asyncio
async def test_provider_rejects_mismatched_scenario():
    _, state = scenario_and_state()
    other_scenario = ScenarioRepository(SCENARIOS).get("SCENARIO_02_VF7_VS_CX5")

    with pytest.raises(ValueError, match="identifiers do not match"):
        await RetrievalKnowledgeEvidenceProvider(RecordingRetriever()).for_session(other_scenario, state)
