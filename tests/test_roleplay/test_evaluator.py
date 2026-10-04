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
            "score": 2,
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
                "status": "unassessed",
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
    assert result.overall_score == 2.0
    assert result.review_status is ReviewStatus.AI_DRAFT
    assert result.factual_findings[0].source_ids == ["policy-a"]
    assert model.calls[0]["system_prompt"] == EVALUATOR_SYSTEM_PROMPT
    assert model.calls[0]["context"]["prompt_version"] == EVALUATOR_PROMPT_VERSION
    assert "factual_claims" not in model.calls[0]["context"]["final_state"]
    assert "messages" not in model.calls[0]["context"]["final_state"]
    assert "hidden_facts" not in model.calls[0]["context"]["scenario"]


@pytest.mark.asyncio
async def test_evaluator_rejects_non_exact_transcript_quote(scenario, completed_state):
    output = evaluation_output()
    output["evaluations"][0]["evidence"][0]["quote"] = "A quote that was never said"
    evaluator = RoleplayEvaluator(CapturingEvaluationModel(output))

    with pytest.raises(EvaluationError, match="quote is not exact"):
        await evaluator.evaluate(scenario, completed_state, approved_evidence())

    assert len(evaluator._model.calls) == 2
    assert "correction_required" in evaluator._model.calls[1]["context"]


@pytest.mark.asyncio
async def test_evaluator_accepts_corrected_exact_quote(scenario, completed_state):
    invalid = evaluation_output()
    invalid["evaluations"][0]["evidence"][0]["quote"] = "A paraphrase"

    class CorrectingModel(CapturingEvaluationModel):
        async def evaluate(self, *, system_prompt, context):
            self.calls.append({"system_prompt": system_prompt, "context": context.copy()})
            return invalid if len(self.calls) == 1 else evaluation_output()

    model = CorrectingModel(None)
    result = await RoleplayEvaluator(model).evaluate(scenario, completed_state, approved_evidence())
    assert result.overall_score == 2
    assert len(model.calls) == 2


@pytest.mark.asyncio
async def test_evaluator_cites_real_message_when_model_quote_has_small_edit(scenario, completed_state):
    output = evaluation_output()
    output["evaluations"][0]["evidence"][0]["quote"] = "Mỗi ngày anh thường chạy bao nhiêu km?"
    model = CapturingEvaluationModel(output)

    result = await RoleplayEvaluator(model).evaluate(scenario, completed_state, approved_evidence())

    assert result.evaluations[0].evidence[0].quote == "Mỗi ngày anh thường chạy khoảng bao nhiêu km?"
    assert len(model.calls) == 1


@pytest.mark.asyncio
async def test_evaluator_rejects_out_of_range_v3_score(scenario, completed_state):
    output = evaluation_output()
    output["evaluations"][0]["score"] = 4
    evaluator = RoleplayEvaluator(CapturingEvaluationModel(output))

    with pytest.raises(EvaluationError, match="invalid evaluation output"):
        await evaluator.evaluate(scenario, completed_state, approved_evidence())


@pytest.mark.asyncio
async def test_score_three_requires_customer_and_advisor_turns(scenario, completed_state):
    output = evaluation_output()
    output["evaluations"][0]["score"] = 3
    evaluator = RoleplayEvaluator(CapturingEvaluationModel(output))

    with pytest.raises(EvaluationError, match="customer context evidence"):
        await evaluator.evaluate(scenario, completed_state, approved_evidence())

    output["evaluations"][0]["evidence"].append({"message_id": "customer-2", "quote": "Khoảng 180 km mỗi ngày."})
    result = await evaluator.evaluate(scenario, completed_state, approved_evidence())
    assert result.overall_score == 3


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
async def test_evaluator_repairs_only_missing_claims_in_bounded_batches(scenario, completed_state):
    completed_state.factual_claims = [
        AdvisorFactualClaim(message_id="advisor-2", text=f"Chính sách {index}", category="policy")
        for index in range(1, 26)
    ]
    completed_state.messages[-1].content = " ".join(claim.text for claim in completed_state.factual_claims)
    output = evaluation_output()
    output["factual_findings"] = []

    class RepairingModel(CapturingEvaluationModel):
        def __init__(self):
            super().__init__(output)
            self.batches = []

        async def evaluate_factual_claims(self, *, system_prompt, context):
            self.batches.append(context["factual_claims"])
            return {
                "factual_findings": [
                    {
                        "message_id": claim["message_id"],
                        "claim": claim["text"],
                        "status": "unverifiable",
                        "reason": "Nguồn hiện có không đủ xác minh.",
                    }
                    for claim in context["factual_claims"]
                ]
            }

    model = RepairingModel()
    result = await RoleplayEvaluator(model).evaluate(scenario, completed_state, approved_evidence())
    assert len(result.factual_findings) == 25
    assert [len(batch) for batch in model.batches] == [4, 4, 4, 4, 4, 4, 1]


@pytest.mark.asyncio
async def test_evaluator_rejects_incomplete_factual_repair(scenario, completed_state):
    output = evaluation_output()
    output["factual_findings"] = []

    class IncompleteModel(CapturingEvaluationModel):
        async def evaluate_factual_claims(self, *, system_prompt, context):
            return {"factual_findings": []}

    with pytest.raises(EvaluationError, match="exactly the requested claims"):
        await RoleplayEvaluator(IncompleteModel(output)).evaluate(scenario, completed_state, approved_evidence())


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
