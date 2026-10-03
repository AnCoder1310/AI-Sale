from pathlib import Path

import pytest

from src.agents.roleplay.scenario_loader import ScenarioRepository
from src.agents.roleplay.state import RoleplayState
from src.agents.roleplay.turn_analyzer import TurnAnalysisError, TurnAnalyzer

SCENARIOS = Path("data/scenarios/scenarios.json")


class StaticAnalysisModel:
    def __init__(self, output):
        self.output = output

    async def analyze(self, advisor_message, scenario, state):
        return self.output


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "advisor_message",
    [
        "Mỗi ngày anh thường chạy khoảng bao nhiêu km?",
        "Một ngày làm việc điển hình xe của anh phải hoạt động nhiều không ạ?",
    ],
)
async def test_semantic_intent_reveals_the_same_fact_for_paraphrases(advisor_message):
    scenario = ScenarioRepository(SCENARIOS).get("SCENARIO_01_VF5_TAXI")
    state = RoleplayState.from_scenario("session-1", scenario)
    analyzer = TurnAnalyzer(
        StaticAnalysisModel(
            {
                "detected_intents": ["ask_daily_travel_distance"],
                "discovered_fact_ids": ["daily_distance"],
                "current_topic": "daily_usage",
            }
        )
    )

    analysis = await analyzer.analyze(advisor_message, scenario, state)

    assert analysis.discovered_fact_ids == ["daily_distance"]


@pytest.mark.asyncio
async def test_fact_is_not_revealed_without_its_matching_intent():
    scenario = ScenarioRepository(SCENARIOS).get("SCENARIO_01_VF5_TAXI")
    state = RoleplayState.from_scenario("session-1", scenario)
    analyzer = TurnAnalyzer(
        StaticAnalysisModel(
            {
                "detected_intents": ["ask_budget_or_financing"],
                "discovered_fact_ids": ["daily_distance", "unknown_fact"],
            }
        )
    )

    analysis = await analyzer.analyze("Anh dự tính trả trước bao nhiêu?", scenario, state)

    assert analysis.detected_intents == ["ask_budget_or_financing"]
    assert analysis.discovered_fact_ids == []


@pytest.mark.asyncio
async def test_only_active_addressed_objections_can_be_resolved():
    scenario = ScenarioRepository(SCENARIOS).get("SCENARIO_01_VF5_TAXI")
    state = RoleplayState.from_scenario("session-1", scenario)
    state.active_objections = ["OBJ_VF5_BATTERY_VS_GAS"]
    analyzer = TurnAnalyzer(
        StaticAnalysisModel(
            {
                "addressed_objection_ids": ["OBJ_VF5_BATTERY_VS_GAS"],
                "resolved_objection_ids": [
                    "OBJ_VF5_BATTERY_VS_GAS",
                    "OBJ_VF5_CHARGING_TIME",
                ],
            }
        )
    )

    analysis = await analyzer.analyze("Em xin phép so sánh theo số km thực tế.", scenario, state)

    assert analysis.resolved_objection_ids == ["OBJ_VF5_BATTERY_VS_GAS"]


@pytest.mark.asyncio
async def test_malformed_structured_output_has_a_domain_specific_error():
    scenario = ScenarioRepository(SCENARIOS).get("SCENARIO_01_VF5_TAXI")
    state = RoleplayState.from_scenario("session-1", scenario)
    analyzer = TurnAnalyzer(
        StaticAnalysisModel({"factual_claims": [{"text": "Giá hiện tại là...", "category": "invented"}]})
    )

    with pytest.raises(TurnAnalysisError, match="invalid turn analysis"):
        await analyzer.analyze("Giá hiện tại là...", scenario, state)


@pytest.mark.asyncio
async def test_analyzer_keeps_only_claims_exactly_present_in_advisor_turn():
    scenario = ScenarioRepository(SCENARIOS).get("SCENARIO_01_VF5_TAXI")
    state = RoleplayState.from_scenario("session-1", scenario)
    analyzer = TurnAnalyzer(
        StaticAnalysisModel(
            {
                "factual_claims": [
                    {"text": "VF 5 được bảo hành 7 năm", "category": "warranty"},
                    {"text": "VF 5 miễn phí hoàn toàn", "category": "promotion"},
                ]
            }
        )
    )

    result = await analyzer.analyze("VF 5 được bảo hành 7 năm.", scenario, state)

    assert [claim.text for claim in result.factual_claims] == ["VF 5 được bảo hành 7 năm"]
