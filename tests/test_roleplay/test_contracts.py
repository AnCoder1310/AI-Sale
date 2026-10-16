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
    assert len(raw_scenarios) == 4
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

    assert prompt_context["revealed_facts"] == {}
    state.spoken_fact_message_ids["daily_distance"] = "customer-2"
    prompt_context = state.customer_prompt_context()
    assert prompt_context["revealed_facts"] == {"daily_distance": scenario.hidden_facts["daily_distance"]}
    assert prompt_context["spoken_fact_message_ids"] == {"daily_distance": "customer-2"}
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


@pytest.mark.parametrize("invalid_max_turns", [0, -1, 16, "not-a-number"])
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


def test_rubric_contract_uses_the_shared_one_to_three_scale():
    assert len(RUBRIC_CRITERIA) == 5
    assert (RUBRIC_SCORE_MIN, RUBRIC_SCORE_MAX) == (1, 3)


def test_assessed_criterion_requires_transcript_evidence():
    with pytest.raises(ValueError, match="transcript evidence"):
        CriterionEvaluation(
            criterion=CriterionType.NEED_DISCOVERY,
            status=CriterionStatus.ASSESSED,
            score=3,
            reason="The advisor discovered intended use.",
        )


def test_unassessed_criterion_rejects_numeric_score():
    with pytest.raises(ValueError, match="must not contain a score"):
        CriterionEvaluation(
            criterion=CriterionType.CLOSING_NEXT_STEP,
            status=CriterionStatus.UNASSESSED,
            score=2,
            reason="No fair closing opportunity occurred.",
        )


def test_assessed_criterion_rejects_score_above_three():
    with pytest.raises(ValueError):
        CriterionEvaluation(
            criterion=CriterionType.NEED_DISCOVERY,
            status=CriterionStatus.ASSESSED,
            score=4,
            evidence=[TranscriptEvidence(message_id="turn-1", quote="Anh đi bao nhiêu km?")],
            reason="Asked about usage.",
        )


def test_old_unassessed_statuses_are_not_part_of_v3_contract():
    for old_status in ("not_observed", "insufficient_evidence"):
        with pytest.raises(ValueError):
            CriterionEvaluation(
                criterion=CriterionType.CLOSING_NEXT_STEP,
                status=old_status,
                reason="No reliable score.",
            )


def _unassessed(criterion: CriterionType) -> CriterionEvaluation:
    return CriterionEvaluation(
        criterion=criterion,
        status=CriterionStatus.UNASSESSED,
        reason="The scenario did not create a fair opportunity.",
    )


def test_session_result_validates_coverage_and_aggregate():
    result = SessionEvaluationResult(
        session_id="session-1",
        scenario_id="scenario-1",
        rubric_version="v3",
        assessed_criteria_count=1,
        overall_score=3.0,
        evaluations=[
            CriterionEvaluation(
                criterion=CriterionType.NEED_DISCOVERY,
                status=CriterionStatus.ASSESSED,
                score=3,
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
                status=CriterionStatus.UNASSESSED,
                reason="The session ended before a closing opportunity.",
            ),
            _unassessed(CriterionType.PRODUCT_KNOWLEDGE),
            _unassessed(CriterionType.OBJECTION_HANDLING),
            _unassessed(CriterionType.POLICY_ACCURACY),
        ],
    )

    assert result.assessed_criteria_count == 1
    assert result.overall_score == 3.0


def test_session_result_rejects_llm_supplied_inconsistent_aggregate():
    with pytest.raises(ValueError, match="mean of assessed criteria"):
        SessionEvaluationResult(
            session_id="session-1",
            scenario_id="scenario-1",
            rubric_version="v3",
            assessed_criteria_count=1,
            overall_score=2.0,
            evaluations=[
                CriterionEvaluation(
                    criterion=CriterionType.NEED_DISCOVERY,
                    status=CriterionStatus.ASSESSED,
                    score=3,
                    evidence=[
                        TranscriptEvidence(
                            message_id="turn-1",
                            quote="Anh thường dùng xe cho nhu cầu nào?",
                        )
                    ],
                    reason="The advisor asked about intended use.",
                ),
                _unassessed(CriterionType.PRODUCT_KNOWLEDGE),
                _unassessed(CriterionType.OBJECTION_HANDLING),
                _unassessed(CriterionType.POLICY_ACCURACY),
                _unassessed(CriterionType.CLOSING_NEXT_STEP),
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


@pytest.mark.parametrize(
    "path",
    [
        (),
        ("disclosure_rules", 0),
        ("objections", 0),
        ("termination_conditions",),
        ("acceptable_outcomes", 0),
        ("upsell_benefits", 0),
        ("upsell_rule",),
        ("policy_expectations", 0),
    ],
)
def test_scenario_models_reject_unknown_fields(path):
    raw = _raw_scenario(3)
    nested = raw
    for key in path:
        nested = nested[key]
    nested["unknown_field"] = "must not be silently dropped"
    with pytest.raises(ValueError, match="Extra inputs are not permitted"):
        ScenarioContract.model_validate(raw)


@pytest.mark.parametrize("keywords", [[], [" "]])
def test_objection_requires_at_least_one_nonblank_trigger(keywords):
    raw = _raw_scenario()
    raw["objections"][0].pop("trigger_stage")
    raw["objections"][0]["trigger_keywords"] = keywords
    with pytest.raises(ValueError, match="trigger|blank"):
        ScenarioContract.model_validate(raw)


def test_keyword_only_objection_and_stage_with_keywords_are_supported():
    raw = _raw_scenario(3)
    scenario = ScenarioContract.model_validate(raw)
    assert scenario.objections[1].trigger_stage is None
    assert scenario.objections[1].trigger_keywords == ["Plus", "bản cao hơn", "nâng cấp lên"]
    raw["objections"][1]["trigger_stage"] = "presentation"
    assert ScenarioContract.model_validate(raw).objections[1].trigger_stage == "presentation"


@pytest.mark.parametrize("index", [0, 1, 2])
def test_legacy_scenarios_compute_independent_default_outcomes(index):
    raw = _raw_scenario(index)
    raw.pop("policy_expectations")
    assert "acceptable_outcomes" not in raw
    scenario = ScenarioContract.model_validate(raw)
    assert [outcome.model_dump() for outcome in scenario.acceptable_outcomes] == [
        {
            "outcome_id": "close",
            "label": "Chốt bước tiếp theo",
            "product": "",
            "requires_resolved_objections": [],
            "preferred": False,
        }
    ]
    scenario.acceptable_outcomes[0].requires_resolved_objections.append("mutated")
    assert ScenarioContract.model_validate(raw).acceptable_outcomes[0].requires_resolved_objections == []


def test_upsell_rule_rejects_unknown_objection():
    raw = _raw_scenario(3)
    raw["upsell_rule"]["objection_id"] = "unknown"
    with pytest.raises(ValueError, match="upsell_rule references unknown objection"):
        ScenarioContract.model_validate(raw)


def test_upsell_rule_requires_benefits():
    raw = _raw_scenario(3)
    raw["upsell_benefits"] = []
    with pytest.raises(ValueError, match="requires non-empty upsell_benefits"):
        ScenarioContract.model_validate(raw)


@pytest.mark.parametrize("key,value", [("min_linked", 0), ("min_safety", -1)])
def test_upsell_rule_rejects_invalid_thresholds(key, value):
    raw = _raw_scenario(3)
    raw["upsell_rule"][key] = value
    with pytest.raises(ValueError):
        ScenarioContract.model_validate(raw)


def test_upsell_benefits_reject_unknown_need_fact():
    raw = _raw_scenario(3)
    raw["upsell_benefits"][0]["linked_need_fact_keys"] = ["unknown"]
    with pytest.raises(ValueError, match="upsell benefits reference unknown hidden facts"):
        ScenarioContract.model_validate(raw)


@pytest.mark.parametrize("field", ["acceptable_outcomes", "upsell_benefits"])
def test_outcome_and_benefit_ids_must_be_unique(field):
    raw = _raw_scenario(3)
    raw[field].append(raw[field][0])
    with pytest.raises(ValueError, match="must be unique"):
        ScenarioContract.model_validate(raw)


def test_acceptable_outcomes_reject_unknown_resolved_objection():
    raw = _raw_scenario(3)
    raw["acceptable_outcomes"][0]["requires_resolved_objections"] = ["unknown"]
    with pytest.raises(ValueError, match="acceptable outcomes reference unknown objection"):
        ScenarioContract.model_validate(raw)


def test_policy_sources_exist_in_the_controlled_knowledge_dataset():
    documents = [
        document
        for path in [Path("data/knowledge/corpus.json"), Path("data/knowledge/faq.json")]
        for document in json.loads(path.read_text(encoding="utf-8"))
    ]
    document_ids = {document["document_id"] for document in documents}
    for raw in json.loads(SCENARIOS.read_text(encoding="utf-8")):
        scenario = ScenarioContract.model_validate(raw)
        assert scenario.policy_expectations
        for expectation in scenario.policy_expectations:
            assert expectation.source_ids
            assert set(expectation.source_ids) <= document_ids, (scenario.scenario_id, expectation.policy_id)


def test_policy_expectations_reject_unknown_level():
    raw = _raw_scenario(3)
    raw["policy_expectations"][0]["level"] = "required"
    with pytest.raises(ValueError):
        ScenarioContract.model_validate(raw)


@pytest.mark.parametrize("max_turns", [1, 15])
def test_scenario_and_state_accept_same_turn_limit_boundaries(max_turns):
    raw = _raw_scenario()
    raw["termination_conditions"]["max_turns"] = max_turns
    scenario = ScenarioContract.model_validate(raw)
    assert RoleplayState.from_scenario("boundary", scenario).max_turns == max_turns
