from pathlib import Path

import pytest

from src.agents.roleplay.scenario_loader import ScenarioRepository
from src.agents.roleplay.state import ConversationStage, RoleplayState, TerminationStatus
from src.agents.roleplay.state_reducer import StateTransitionError, apply_turn_analysis
from src.agents.roleplay.turn_analyzer import FactualClaim, TurnAnalysis

SCENARIOS = Path("data/scenarios/scenarios.json")


@pytest.fixture
def scenario():
    return ScenarioRepository(SCENARIOS).get("SCENARIO_01_VF5_TAXI")


@pytest.fixture
def initial_state(scenario):
    return RoleplayState.from_scenario("session-1", scenario)


def test_discovery_reveals_fact_without_mutating_input(initial_state, scenario):
    updated = apply_turn_analysis(
        initial_state,
        scenario,
        "Mỗi ngày anh chạy bao nhiêu km?",
        TurnAnalysis(
            detected_intents=["ask_daily_travel_distance"],
            discovered_fact_ids=["daily_distance"],
            current_topic="daily_usage",
        ),
    )

    assert initial_state.turn_count == 0
    assert initial_state.revealed_facts == []
    assert updated.turn_count == 1
    assert updated.conversation_stage is ConversationStage.DISCOVERY
    assert updated.revealed_facts == ["daily_distance"]
    assert updated.advisor_discoveries == ["daily_distance"]
    assert updated.messages[-1].content == "Mỗi ngày anh chạy bao nhiêu km?"


def test_presentation_does_not_force_an_objection(initial_state, scenario):
    updated = apply_turn_analysis(
        initial_state,
        scenario,
        "Chi phí sử dụng của mẫu xe này thấp hơn.",
        TurnAnalysis(factual_claims=[FactualClaim(text="Chi phí sử dụng thấp hơn", category="price")]),
    )

    assert updated.conversation_stage is ConversationStage.PRESENTATION
    assert updated.active_objections == []
    assert len(updated.factual_claims) == 1
    assert updated.factual_claims[0].message_id == updated.messages[-1].message_id
    assert updated.factual_claims[0].text == "Chi phí sử dụng thấp hơn"
    assert updated.factual_claims[0].category == "price"


def test_reducer_rejects_fact_without_matching_intent(initial_state, scenario):
    updated = apply_turn_analysis(
        initial_state,
        scenario,
        "Tôi chưa hỏi về quãng đường.",
        TurnAnalysis(discovered_fact_ids=["daily_distance"]),
    )

    assert updated.revealed_facts == []
    assert updated.advisor_discoveries == []


def test_analyzer_cannot_resolve_without_customer_reaction(initial_state, scenario):
    initial_state.conversation_stage = ConversationStage.OBJECTION_HANDLING
    initial_state.active_objections = ["OBJ_VF5_BATTERY_VS_GAS"]

    updated = apply_turn_analysis(
        initial_state,
        scenario,
        "Mình sẽ so sánh theo quãng đường và kiểm tra lại nguồn.",
        TurnAnalysis(
            addressed_objection_ids=["OBJ_VF5_BATTERY_VS_GAS"],
            resolved_objection_ids=["OBJ_VF5_BATTERY_VS_GAS"],
        ),
    )

    assert updated.active_objections == ["OBJ_VF5_BATTERY_VS_GAS"]
    assert updated.resolved_objections == []
    assert "OBJ_VF5_BATTERY_VS_GAS" in updated.unresolved_objections
    assert updated.conversation_stage is ConversationStage.OBJECTION_HANDLING


def test_reducer_does_not_resolve_unaddressed_objection(initial_state, scenario):
    initial_state.conversation_stage = ConversationStage.OBJECTION_HANDLING
    initial_state.active_objections = ["OBJ_VF5_BATTERY_VS_GAS"]

    updated = apply_turn_analysis(
        initial_state,
        scenario,
        "Tôi chuyển sang chủ đề khác.",
        TurnAnalysis(resolved_objection_ids=["OBJ_VF5_BATTERY_VS_GAS"]),
    )

    assert updated.active_objections == ["OBJ_VF5_BATTERY_VS_GAS"]
    assert updated.resolved_objections == []


def test_next_step_does_not_inject_a_closing_objection(initial_state, scenario):
    initial_state.conversation_stage = ConversationStage.OBJECTION_HANDLING
    initial_state.active_objections = ["OBJ_VF5_BATTERY_VS_GAS"]

    updated = apply_turn_analysis(
        initial_state,
        scenario,
        "Nếu phần chi phí đã rõ, mình hẹn lái thử nhé anh?",
        TurnAnalysis(
            addressed_objection_ids=["OBJ_VF5_BATTERY_VS_GAS"],
            resolved_objection_ids=["OBJ_VF5_BATTERY_VS_GAS"],
            next_step_attempted=True,
        ),
    )

    assert updated.conversation_stage is ConversationStage.OBJECTION_HANDLING
    assert updated.active_objections == ["OBJ_VF5_BATTERY_VS_GAS"]


def test_explicit_finish_terminates_session(initial_state, scenario):
    updated = apply_turn_analysis(
        initial_state,
        scenario,
        "Kết thúc bài luyện tập.",
        TurnAnalysis(advisor_requested_finish=True),
    )

    assert updated.termination_status is TerminationStatus.ADVISOR_ENDED
    assert updated.conversation_stage is ConversationStage.FINISHED


def test_turn_limit_waits_for_customer_reply(initial_state, scenario):
    initial_state.turn_count = scenario.termination_conditions.max_turns - 1

    updated = apply_turn_analysis(
        initial_state,
        scenario,
        "Tôi xin hỏi thêm một câu.",
        TurnAnalysis(),
    )

    assert updated.termination_status is TerminationStatus.ACTIVE
    assert updated.turn_count == scenario.termination_conditions.max_turns


def test_cannot_continue_a_terminated_session(initial_state, scenario):
    initial_state.termination_status = TerminationStatus.MAX_TURNS

    with pytest.raises(StateTransitionError, match="terminated"):
        apply_turn_analysis(initial_state, scenario, "Tiếp tục", TurnAnalysis())


def test_trust_and_interest_levels_stay_within_bounds(initial_state, scenario):
    initial_state.trust_level = 1
    initial_state.interest_level = 1

    updated = apply_turn_analysis(
        initial_state,
        scenario,
        "Tôi cam kết mà không cần căn cứ.",
        TurnAnalysis(premature_closing=True, unsafe_or_abusive=True),
    )

    assert updated.trust_level == 1
    assert updated.interest_level == 1
