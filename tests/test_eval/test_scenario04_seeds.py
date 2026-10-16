"""Offline contract checks for synthetic scenario 4 judge seeds and smoke probes."""

import json
from pathlib import Path

from eval.run_roleplay_realism_smoke import (
    RUNS,
    SCENARIO_04_ID,
    SCENARIO_04_RUNS,
    SCENARIO_ID,
    runs_for_scenario,
)
from src.models.evaluation import CriterionType

ROOT = Path(__file__).resolve().parents[2]


def test_scenario04_judge_seed_contract():
    dataset = json.loads((ROOT / "eval/datasets/judge_seed_scenario04.json").read_text())
    scenarios = json.loads((ROOT / "data/scenarios/scenarios.json").read_text())
    versions = {item["scenario_id"]: item["scenario_version"] for item in scenarios}
    cases = dataset["cases"]
    assert len(cases) == 3
    assert {case["case_id"] for case in cases} == {"S04_STRONG_ECO", "S04_STRONG_PLUS", "S04_WEAK"}
    assert len({case["session_id"] for case in cases}) == 3
    message_ids = set()
    for case in cases:
        assert case["scenario_id"] == SCENARIO_04_ID
        assert versions[case["scenario_id"]] == case["scenario_version"]
        assert case["label_source"] == "author_draft_needs_expert_review"
        assert len(case["messages"]) >= 2
        for index, message in enumerate(case["messages"]):
            message_id = message["message_id"]
            assert isinstance(message_id, str) and message_id.strip()
            assert message_id not in message_ids
            message_ids.add(message_id)
            assert message["role"] == ("advisor" if index % 2 == 0 else "customer")
            assert isinstance(message["content"], str) and message["content"].strip()
        ranges = case["expected"]["score_ranges"]
        assert set(ranges) == {criterion.value for criterion in CriterionType}
        for score in ranges.values():
            assert 1 <= score["min"] <= score["max"] <= 3
    by_id = {case["case_id"]: case["expected"] for case in cases}
    assert by_id["S04_STRONG_ECO"]["closing_outcome"] == "close_eco"
    assert by_id["S04_STRONG_PLUS"]["closing_outcome"] == "upsell_plus"
    for case_id, criterion, score in [
        ("S04_STRONG_ECO", "closing_next_step", 3),
        ("S04_STRONG_ECO", "policy_accuracy", 3),
        ("S04_STRONG_PLUS", "closing_next_step", 3),
        ("S04_STRONG_PLUS", "objection_handling", 3),
        ("S04_WEAK", "policy_accuracy", 1),
        ("S04_WEAK", "product_knowledge", 1),
        ("S04_WEAK", "closing_next_step", 1),
    ]:
        assert by_id[case_id]["score_ranges"][criterion] == {"min": score, "max": score}


def test_realism_smoke_selects_scenario04_offline(monkeypatch):
    def no_network(*args, **kwargs):
        raise AssertionError("offline selection must not construct a graph or model")

    monkeypatch.setattr("eval.run_roleplay_realism_smoke.RoleplayGraph", no_network)
    monkeypatch.setattr("eval.run_roleplay_realism_smoke.SharedLLMCustomerModel", no_network)
    monkeypatch.setattr("eval.run_roleplay_realism_smoke.SharedLLMTurnAnalysisModel", no_network)
    assert runs_for_scenario(SCENARIO_04_ID) is SCENARIO_04_RUNS
    assert runs_for_scenario(SCENARIO_ID) is RUNS
    assert all("chị" in turns[0] for turns in SCENARIO_04_RUNS.values())
