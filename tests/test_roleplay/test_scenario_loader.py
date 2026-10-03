import json
from pathlib import Path

import pytest

from src.agents.roleplay.scenario_loader import (
    ScenarioDatasetError,
    ScenarioNotFoundError,
    ScenarioRepository,
)

SCENARIOS = Path("data/scenarios/scenarios.json")


def test_repository_default_path_loads_project_scenarios():
    repository = ScenarioRepository()

    assert len(repository.list_public()) == 3


def test_repository_loads_scenarios_and_returns_defensive_copies():
    repository = ScenarioRepository(SCENARIOS)

    first = repository.get("SCENARIO_01_VF5_TAXI")
    first.persona["name"] = "changed"

    assert repository.get("SCENARIO_01_VF5_TAXI").persona["name"] == "Anh Nam"


def test_public_summaries_do_not_expose_private_scenario_fields():
    repository = ScenarioRepository(SCENARIOS)

    summaries = [summary.model_dump() for summary in repository.list_public()]

    assert len(summaries) == 3
    private_fields = {
        "persona",
        "hidden_facts",
        "buyer_intent",
        "customer_goals",
        "disclosure_rules",
        "objections",
        "success_conditions",
    }
    assert all(private_fields.isdisjoint(summary) for summary in summaries)


def test_unknown_scenario_has_a_domain_specific_error():
    repository = ScenarioRepository(SCENARIOS)

    with pytest.raises(ScenarioNotFoundError, match="unknown scenario_id"):
        repository.get("SCENARIO_DOES_NOT_EXIST")


def test_duplicate_scenario_identifiers_are_rejected(tmp_path):
    raw_scenario = json.loads(SCENARIOS.read_text(encoding="utf-8"))[0]
    dataset_path = tmp_path / "scenarios.json"
    dataset_path.write_text(json.dumps([raw_scenario, raw_scenario]), encoding="utf-8")

    with pytest.raises(ScenarioDatasetError, match="duplicate scenario_id"):
        ScenarioRepository(dataset_path)


def test_non_array_dataset_is_rejected(tmp_path):
    dataset_path = tmp_path / "scenarios.json"
    dataset_path.write_text("{}", encoding="utf-8")

    with pytest.raises(ScenarioDatasetError, match="must be a JSON array"):
        ScenarioRepository(dataset_path)
