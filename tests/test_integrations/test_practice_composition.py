import json
from collections import defaultdict
from datetime import date
from pathlib import Path

import pytest

from src.agents.roleplay.customer_agent import CustomerModelOutput
from src.agents.roleplay.evaluator import EvaluationDraft, FactualFindingsDraft
from src.agents.roleplay.turn_analyzer import TurnAnalysis
from src.config import Settings
from src.integrations.practice_runtime import build_practice_service
from src.knowledge.schemas import ChunkMetadata, KnowledgeChunk


class SchemaQueueRunnable:
    def __init__(self, owner: "SchemaQueueModel", schema: type) -> None:
        self.owner = owner
        self.schema = schema

    async def ainvoke(self, messages):
        self.owner.calls.append((self.schema, messages))
        output = self.owner.outputs[self.schema].pop(0)
        return output(messages) if callable(output) else output


class SchemaQueueModel:
    def __init__(self) -> None:
        self.outputs = defaultdict(list)
        self.calls = []

    def with_structured_output(self, schema):
        return SchemaQueueRunnable(self, schema)


class RecordingRetriever:
    def __init__(self) -> None:
        self.queries: list[str] = []

    def retrieve(
        self,
        query: str,
        *,
        top_k: int = 4,
        product_model: str | None = None,
        document_type: str | None = None,
    ):
        self.queries.append(query)
        return [
            KnowledgeChunk(
                chunk_id="warranty-1",
                document_id="FAQ_VF5_20260922",
                content="VF 5 áp dụng chính sách bảo hành theo điều kiện công bố.",
                metadata=ChunkMetadata(
                    chunk_id="warranty-1",
                    document_id="FAQ_VF5_20260922",
                    title="Chính sách bảo hành",
                    document_type="policy",
                    product_model="VF 5",
                    effective_date=date(2026, 1, 1),
                    source="https://example.test/warranty",
                    version="2026.1",
                ),
            )
        ]


@pytest.mark.asyncio
async def test_composed_service_runs_practice_through_draft_evaluation(tmp_path: Path):
    model = SchemaQueueModel()
    model.outputs[CustomerModelOutput] = [
        {"reply": "Anh đang cân nhắc VF 5."},
        {"reply": "Điều kiện bảo hành cụ thể thế nào em?"},
    ]
    model.outputs[TurnAnalysis] = [
        {
            "factual_claims": [
                {"text": "VF 5 có chính sách bảo hành", "category": "warranty"},
            ]
        }
    ]

    def evaluation_output(messages):
        return {
            "evaluations": [
                {
                    "criterion": criterion,
                    "status": "assessed" if criterion == "policy_accuracy" else "unassessed",
                    "score": 1 if criterion == "policy_accuracy" else None,
                    "evidence": [
                        {
                            "message_id": json.loads(messages[1].content.removeprefix("CONTEXT_JSON:\n"))["transcript"][
                                1
                            ]["message_id"],
                            "quote": "VF 5 có chính sách bảo hành",
                        }
                    ]
                    if criterion == "policy_accuracy"
                    else [],
                    "reason": "Chưa đủ cơ hội quan sát trong transcript ngắn.",
                }
                for criterion in (
                    "need_discovery",
                    "product_knowledge",
                    "objection_handling",
                    "policy_accuracy",
                    "closing_next_step",
                )
            ],
            "factual_findings": [],
        }

    def factual_output(messages):
        context = json.loads(messages[1].content.removeprefix("CONTEXT_JSON:\n"))
        claim = context["factual_claims"][0]
        return {
            "factual_findings": [
                {
                    "claim": claim["text"],
                    "message_id": claim["message_id"],
                    "status": "supported",
                    "source_references": [
                        {
                            "source_id": "warranty-1",
                            "version": "2026.1",
                            "quote": "VF 5 áp dụng chính sách bảo hành",
                        }
                    ],
                    "reason": "Nguồn được duyệt xác nhận có chính sách bảo hành.",
                }
            ],
        }

    judge = SchemaQueueModel()
    judge.outputs[EvaluationDraft] = [evaluation_output]
    judge.outputs[FactualFindingsDraft] = [factual_output]
    retriever = RecordingRetriever()
    service = build_practice_service(
        settings=Settings(database_url=f"sqlite:///{tmp_path / 'practice.db'}"),
        model_factory=lambda: model,
        judge_model_factory=lambda: judge,
        retrieval_service=retriever,
    )

    started = await service.start_session("SCENARIO_01_VF5_TAXI")
    continued = await service.send_message(started.session_id, "VF 5 có chính sách bảo hành đúng không anh?")
    result = await service.finish_session(started.session_id)

    assert continued.turn_count == 1
    assert retriever.queries == ["VF 5 có chính sách bảo hành"]
    assert result.evaluation_status == "complete"
    assert result.result is not None
    assert result.result.review_status == "ai_draft"
    assert [schema for schema, _ in model.calls] == [
        CustomerModelOutput,
        TurnAnalysis,
        CustomerModelOutput,
    ]
    assert [schema for schema, _ in judge.calls] == [EvaluationDraft, FactualFindingsDraft]
    assert result.result.judge_model == "google/gemini-3.8-flash"


def test_default_judge_factory_uses_configured_provider_model(monkeypatch, tmp_path):
    from src.integrations import practice_runtime

    calls = []
    judge = SchemaQueueModel()

    def get_judge(**kwargs):
        calls.append(kwargs)
        return judge

    monkeypatch.setattr(practice_runtime, "get_llm", get_judge)
    settings = Settings(
        database_url=f"sqlite:///{tmp_path / 'judge.db'}",
        practice_judge_provider="openrouter",
        practice_judge_model="google/gemini-3.8-flash",
    )
    service = build_practice_service(
        settings=settings, model_factory=SchemaQueueModel, retrieval_service=RecordingRetriever()
    )
    assert calls == []
    assert service._evaluator._model._invoker._model_factory() is judge
    assert calls == [{"provider": "openrouter", "model": "google/gemini-3.8-flash", "temperature": 0}]


def test_default_judge_rejects_generator_model(tmp_path):
    settings = Settings(
        database_url=f"sqlite:///{tmp_path / 'same.db'}",
        practice_judge_provider="openrouter",
        practice_judge_model="same-model",
        llm_provider="openrouter",
        model_name="same-model",
    )
    with pytest.raises(ValueError, match="must differ"):
        build_practice_service(settings=settings, retrieval_service=RecordingRetriever())


def test_practice_judge_environment_settings(monkeypatch):
    monkeypatch.setenv("PRACTICE_JUDGE_PROVIDER", "gemini")
    monkeypatch.setenv("PRACTICE_JUDGE_MODEL", "configured-judge")
    settings = Settings(_env_file=None)
    assert settings.practice_judge_provider == "gemini"
    assert settings.practice_judge_model == "configured-judge"
