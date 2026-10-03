import json
from pathlib import Path

import pytest

from src.agents.roleplay.contracts import (
    RUBRIC_CRITERIA,
    RUBRIC_SCORE_MAX,
    RUBRIC_SCORE_MIN,
    ScenarioContract,
)
from src.agents.roleplay.state import RoleplayState
from src.models.evaluation import (
    CriterionEvaluation,
    CriterionStatus,
    CriterionType,
    FactualClaimStatus,
    FactualFinding,
    SessionEvaluationResult,
    TranscriptEvidence,
)

SCENARIOS = Path("data/scenarios/scenarios.json")


def _raw_scenario(index: int = 0):
    return json.loads(SCENARIOS.read_text(encoding="utf-8"))[index]


def test_all_gate1_scenarios_load_and_initialize_state():
    raw_scenarios = json.loads(SCENARIOS.read_text(encoding="utf-8"))
    assert len(raw_scenarios) == 3
    for raw_scenario in raw_scenarios:
        scenario = ScenarioContract.model_validate(raw_scenario)
        state = RoleplayState.from_scenario(f"session-{scenario.scenario_id}", scenario)
        assert state.scenario_id == scenario.scenario_id
        assert state.difficulty == scenario.difficulty
        assert state.persona == scenario.persona
        assert state.turn_count == 0
        assert state.active_objections == []
        assert state.unresolved_objections == [objection.objection_id for objection in scenario.objections]


def test_customer_prompt_does_not_leak_unrevealed_hidden_facts():
    scenario = ScenarioContract.model_validate(_raw_scenario())
    state = RoleplayState.from_scenario("session-1", scenario)
    prompt_context = state.customer_prompt_context()
    assert "hidden_facts" not in prompt_context
    assert all(value not in str(prompt_context) for value in scenario.hidden_facts.values())
    assert prompt_context["difficulty"] == scenario.difficulty
    assert prompt_context["trust_level"] == state.trust_level
    assert prompt_context["interest_level"] == state.interest_level


def test_customer_prompt_only_contains_revealed_fact_values():
    scenario = ScenarioContract.model_validate(_raw_scenario())
    state = RoleplayState.from_scenario("session-1", scenario)
    state.revealed_facts.append("daily_distance")

    prompt_context = state.customer_prompt_context()

    assert prompt_context["revealed_facts"] == {"daily_distance": scenario.hidden_facts["daily_distance"]}
    assert scenario.hidden_facts["budget"] not in str(prompt_context)


def test_advisor_visible_context_excludes_private_customer_state():
    scenario = ScenarioContract.model_validate(_raw_scenario())
    state = RoleplayState.from_scenario("session-1", scenario)
    advisor_context = state.advisor_visible_context()

    private_keys = {
        "hidden_facts",
        "persona",
        "trust_level",
        "interest_level",
        "customer_goals",
        "current_intent",
        "active_objections",
        "resolved_objections",
        "unresolved_objections",
        "disclosure_rules",
        "rubric",
        "evaluator",
    }
    assert private_keys.isdisjoint(advisor_context)
    assert advisor_context["difficulty"] == scenario.difficulty
    assert advisor_context["sales_channel"] == scenario.sales_channel
    assert advisor_context["training_objective"] == scenario.training_objective
    assert scenario.customer_goals not in str(advisor_context)
    assert scenario.buyer_intent not in str(advisor_context)
    assert all(value not in str(advisor_context) for value in scenario.hidden_facts.values())
    assert all(objection.objection_id not in str(advisor_context) for objection in scenario.objections)


def test_malformed_objection_is_rejected():
    raw_scenario = _raw_scenario()
    raw_scenario["objections"] = [{"objection_id": "OBJ_INCOMPLETE"}]

    with pytest.raises(ValueError):
        ScenarioContract.model_validate(raw_scenario)


@pytest.mark.parametrize("invalid_max_turns", [0, -1, "not-a-number"])
def test_invalid_max_turns_is_rejected(invalid_max_turns):
    raw_scenario = _raw_scenario()
    raw_scenario["termination_conditions"]["max_turns"] = invalid_max_turns

    with pytest.raises(ValueError):
        ScenarioContract.model_validate(raw_scenario)


def test_unknown_target_skill_is_rejected():
    raw_scenario = _raw_scenario()
    raw_scenario["target_skills"] = ["generic_sales_skill"]

    with pytest.raises(ValueError):
        ScenarioContract.model_validate(raw_scenario)


def test_disclosure_rule_must_reference_a_hidden_fact():
    raw_scenario = _raw_scenario()
    raw_scenario["disclosure_rules"][0]["fact_key"] = "unknown_fact"

    with pytest.raises(ValueError, match="unknown hidden facts"):
        ScenarioContract.model_validate(raw_scenario)


def test_objection_identifiers_must_be_unique():
    raw_scenario = _raw_scenario()
    raw_scenario["objections"].append(raw_scenario["objections"][0])

    with pytest.raises(ValueError, match="must be unique"):
        ScenarioContract.model_validate(raw_scenario)


def test_visible_context_must_not_contain_a_hidden_fact_value():
    raw_scenario = _raw_scenario()
    raw_scenario["visible_context"] += " " + raw_scenario["hidden_facts"]["budget"]

    with pytest.raises(ValueError, match="contains hidden fact"):
        ScenarioContract.model_validate(raw_scenario)


def test_rubric_contract_uses_the_shared_one_to_five_scale():
    assert len(RUBRIC_CRITERIA) == 5
    assert (RUBRIC_SCORE_MIN, RUBRIC_SCORE_MAX) == (1, 5)


def test_assessed_criterion_requires_transcript_evidence():
    with pytest.raises(ValueError, match="transcript evidence"):
        CriterionEvaluation(
            criterion=CriterionType.NEED_DISCOVERY,
            status=CriterionStatus.ASSESSED,
            score=4,
            reason="The advisor discovered intended use.",
        )


def test_not_observed_criterion_rejects_numeric_score():
    with pytest.raises(ValueError, match="must not contain a score"):
        CriterionEvaluation(
            criterion=CriterionType.CLOSING_NEXT_STEP,
            status=CriterionStatus.NOT_OBSERVED,
            score=2,
            reason="No fair closing opportunity occurred.",
        )


def _not_observed(criterion: CriterionType) -> CriterionEvaluation:
    return CriterionEvaluation(
        criterion=criterion,
        status=CriterionStatus.NOT_OBSERVED,
        reason="The scenario did not create a fair opportunity.",
    )


def test_session_result_validates_coverage_and_aggregate():
    result = SessionEvaluationResult(
        session_id="session-1",
        scenario_id="scenario-1",
        rubric_version="v2",
        assessed_criteria_count=1,
        overall_score=4.0,
        evaluations=[
            CriterionEvaluation(
                criterion=CriterionType.NEED_DISCOVERY,
                status=CriterionStatus.ASSESSED,
                score=4,
                evidence=[
                    TranscriptEvidence(
                        message_id="turn-1",
                        quote="Anh thường dùng xe cho nhu cầu nào?",
                    )
                ],
                reason="The advisor asked about intended use.",
            ),
            CriterionEvaluation(
                criterion=CriterionType.CLOSING_NEXT_STEP,
                status=CriterionStatus.NOT_OBSERVED,
                reason="The session ended before a closing opportunity.",
            ),
            _not_observed(CriterionType.PRODUCT_KNOWLEDGE),
            _not_observed(CriterionType.OBJECTION_HANDLING),
            _not_observed(CriterionType.POLICY_ACCURACY),
        ],
    )

    assert result.assessed_criteria_count == 1
    assert result.overall_score == 4.0


def test_session_result_rejects_llm_supplied_inconsistent_aggregate():
    with pytest.raises(ValueError, match="mean of assessed criteria"):
        SessionEvaluationResult(
            session_id="session-1",
            scenario_id="scenario-1",
            rubric_version="v2",
            assessed_criteria_count=1,
            overall_score=5.0,
            evaluations=[
                CriterionEvaluation(
                    criterion=CriterionType.NEED_DISCOVERY,
                    status=CriterionStatus.ASSESSED,
                    score=4,
                    evidence=[
                        TranscriptEvidence(
                            message_id="turn-1",
                            quote="Anh thường dùng xe cho nhu cầu nào?",
                        )
                    ],
                    reason="The advisor asked about intended use.",
                ),
                _not_observed(CriterionType.PRODUCT_KNOWLEDGE),
                _not_observed(CriterionType.OBJECTION_HANDLING),
                _not_observed(CriterionType.POLICY_ACCURACY),
                _not_observed(CriterionType.CLOSING_NEXT_STEP),
            ],
        )


def test_factual_finding_derives_source_ids_from_auditable_references():
    finding = FactualFinding(
        claim="Chính sách A đang áp dụng.",
        message_id="advisor-1",
        status=FactualClaimStatus.SUPPORTED,
        source_references=[
            {
                "source_id": "policy-a",
                "version": "2026.1",
                "quote": "Chính sách A đang áp dụng",
            }
        ],
        reason="Approved evidence supports the claim.",
    )

    assert finding.source_ids == ["policy-a"]


def test_factual_finding_rejects_mismatched_source_ids_and_references():
    with pytest.raises(ValueError, match="must match source_references"):
        FactualFinding(
            claim="Chính sách A đang áp dụng.",
            message_id="advisor-1",
            status=FactualClaimStatus.SUPPORTED,
            source_ids=["different-source"],
            source_references=[
                {
                    "source_id": "policy-a",
                    "version": "2026.1",
                    "quote": "Chính sách A đang áp dụng",
                }
            ],
            reason="Approved evidence supports the claim.",
        )
