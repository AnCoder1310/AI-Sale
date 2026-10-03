from pathlib import Path

import pytest

from src.agents.roleplay.evaluator import (
    EvaluationError,
    KnowledgeEvidence,
    RoleplayEvaluator,
)
from src.agents.roleplay.prompts import EVALUATOR_PROMPT_VERSION, EVALUATOR_SYSTEM_PROMPT
from src.agents.roleplay.scenario_loader import ScenarioRepository
from src.agents.roleplay.state import AdvisorFactualClaim, RoleplayMessage, RoleplayState, TerminationStatus
from src.models.evaluation import CriterionType, ReviewStatus

SCENARIOS = Path("data/scenarios/scenarios.json")


class CapturingEvaluationModel:
    def __init__(self, output):
        self.output = output
        self.calls = []

    async def evaluate(self, *, system_prompt, context):
        self.calls.append({"system_prompt": system_prompt, "context": context})
        return self.output


@pytest.fixture
def scenario():
    return ScenarioRepository(SCENARIOS).get("SCENARIO_01_VF5_TAXI")


@pytest.fixture
def completed_state(scenario):
    state = RoleplayState.from_scenario("session-1", scenario)
    state.messages = [
        RoleplayMessage(message_id="customer-1", role="customer", content="Anh lo chi phí sử dụng."),
        RoleplayMessage(
            message_id="advisor-1",
            role="advisor",
            content="Mỗi ngày anh thường chạy khoảng bao nhiêu km?",
        ),
        RoleplayMessage(message_id="customer-2", role="customer", content="Khoảng 180 km mỗi ngày."),
        RoleplayMessage(
            message_id="advisor-2",
            role="advisor",
            content="Chính sách A đang áp dụng cho trường hợp này.",
        ),
    ]
    state.factual_claims = [
        AdvisorFactualClaim(
            message_id="advisor-2",
            text="Chính sách A đang áp dụng",
            category="policy",
        )
    ]
    state.termination_status = TerminationStatus.ADVISOR_ENDED
    return state


def evaluation_output():
    evaluations = [
        {
            "criterion": CriterionType.NEED_DISCOVERY.value,
            "status": "assessed",
            "score": 4,
            "evidence": [
                {
                    "message_id": "advisor-1",
                    "quote": "Mỗi ngày anh thường chạy khoảng bao nhiêu km?",
                }
            ],
            "reason": "Advisor asked about daily usage.",
            "improvement_suggestion": "Ask a follow-up about charging access.",
        }
    ]
    for criterion in CriterionType:
        if criterion is CriterionType.NEED_DISCOVERY:
            continue
        evaluations.append(
            {
                "criterion": criterion.value,
                "status": "not_observed",
                "score": None,
                "evidence": [],
                "reason": "No fair opportunity occurred.",
            }
        )
    return {
        "evaluations": evaluations,
        "factual_findings": [
            {
                "claim": "Chính sách A đang áp dụng",
                "message_id": "advisor-2",
                "status": "supported",
                "source_references": [
                    {
                        "source_id": "policy-a",
                        "version": "2026.1",
                        "quote": "Chính sách A đang áp dụng",
                    }
                ],
                "severity": "info",
                "reason": "Approved policy evidence supports the claim.",
            }
        ],
        "summary_strengths": ["Asked a relevant usage question."],
        "summary_weaknesses": ["Could ask one deeper follow-up."],
        "recommended_next_practice": {
            "type": "scenario",
            "target_id": "SCENARIO_03_VF6_APARTMENT",
            "reason": "Practice deeper discovery.",
        },
    }


def approved_evidence():
    return [
        KnowledgeEvidence(
            source_id="policy-a",
            version="2026.1",
            content="Theo tài liệu được duyệt, Chính sách A đang áp dụng cho trường hợp này.",
        )
    ]


@pytest.mark.asyncio
async def test_evaluator_validates_evidence_and_computes_aggregate(scenario, completed_state):
    model = CapturingEvaluationModel(evaluation_output())
    evaluator = RoleplayEvaluator(model)

    result = await evaluator.evaluate(scenario, completed_state, approved_evidence())

    assert result.assessed_criteria_count == 1
    assert result.overall_score == 4.0
    assert result.review_status is ReviewStatus.AI_DRAFT
    assert result.factual_findings[0].source_ids == ["policy-a"]
    assert model.calls[0]["system_prompt"] == EVALUATOR_SYSTEM_PROMPT
    assert model.calls[0]["context"]["prompt_version"] == EVALUATOR_PROMPT_VERSION


@pytest.mark.asyncio
async def test_evaluator_rejects_non_exact_transcript_quote(scenario, completed_state):
    output = evaluation_output()
    output["evaluations"][0]["evidence"][0]["quote"] = "A quote that was never said"
    evaluator = RoleplayEvaluator(CapturingEvaluationModel(output))

    with pytest.raises(EvaluationError, match="quote is not exact"):
        await evaluator.evaluate(scenario, completed_state, approved_evidence())


@pytest.mark.asyncio
async def test_evaluator_rejects_unsupported_factual_source(scenario, completed_state):
    output = evaluation_output()
    output["factual_findings"][0]["source_references"][0]["source_id"] = "unknown"
    evaluator = RoleplayEvaluator(CapturingEvaluationModel(output))

    with pytest.raises(EvaluationError, match="unknown source_id"):
        await evaluator.evaluate(scenario, completed_state, approved_evidence())


@pytest.mark.asyncio
async def test_evaluator_rejects_model_supplied_aggregate(scenario, completed_state):
    output = evaluation_output()
    output["overall_score"] = 5
    evaluator = RoleplayEvaluator(CapturingEvaluationModel(output))

    with pytest.raises(EvaluationError, match="invalid evaluation output"):
        await evaluator.evaluate(scenario, completed_state, approved_evidence())


@pytest.mark.asyncio
async def test_evaluator_rejects_missing_recorded_factual_claim(scenario, completed_state):
    output = evaluation_output()
    output["factual_findings"] = []
    evaluator = RoleplayEvaluator(CapturingEvaluationModel(output))

    with pytest.raises(EvaluationError, match="omitted recorded factual claims"):
        await evaluator.evaluate(scenario, completed_state, approved_evidence())


@pytest.mark.asyncio
async def test_evaluator_rejects_duplicate_factual_finding(scenario, completed_state):
    output = evaluation_output()
    output["factual_findings"].append(output["factual_findings"][0].copy())
    evaluator = RoleplayEvaluator(CapturingEvaluationModel(output))

    with pytest.raises(EvaluationError, match="duplicate claims"):
        await evaluator.evaluate(scenario, completed_state, approved_evidence())


@pytest.mark.asyncio
async def test_active_session_cannot_be_evaluated(scenario, completed_state):
    completed_state.termination_status = TerminationStatus.ACTIVE
    evaluator = RoleplayEvaluator(CapturingEvaluationModel(evaluation_output()))

    with pytest.raises(EvaluationError, match="active role-play"):
        await evaluator.evaluate(scenario, completed_state, approved_evidence())
