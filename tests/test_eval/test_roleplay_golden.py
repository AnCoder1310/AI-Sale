import copy
import json
from types import SimpleNamespace

import pytest

from eval.roleplay_eval import golden, run


def test_dataset_validates():
    data = golden.load_dataset()
    assert len(data["cases"]) == 21


@pytest.mark.parametrize("mutation", ["fact", "quote", "version", "claim", "unknown"])
def test_invalid_dataset(tmp_path, mutation):
    data = copy.deepcopy(golden.load_dataset())
    if mutation == "fact":
        data["cases"][0]["expected"]["revealed_facts_contains"] = ["unknown_fact"]
    elif mutation == "version":
        data["cases"][0]["scenario_version"] = "invalid"
    elif mutation == "unknown":
        data["cases"][0]["expected"]["mystery_contains"] = ["x"]
    else:
        finding = data["cases"][1]["expected_factual_findings"][0]
        if mutation == "quote":
            finding["supporting_document"]["quote"] = "fabricated quote"
        else:
            finding["claim_text_contains"] = "absent claim"
    path = tmp_path / "invalid.json"
    path.write_text(json.dumps(data), encoding="utf-8")
    with pytest.raises(ValueError):
        golden.load_dataset(path)


def test_aggregation():
    cases = [
        {
            "pass_at_k": True,
            "pass_hat_k": False,
            "runs": [
                {"assertions": [run.assertion("a", True, True)]},
                {"assertions": [run.assertion("a", True, False)]},
            ],
        },
        {
            "pass_at_k": True,
            "pass_hat_k": True,
            "runs": [
                {"assertions": [run.assertion("a", True, True)]},
                {"assertions": [run.assertion("a", True, True), run.assertion("b", True, available=False)]},
            ],
        },
    ]
    assert golden.aggregate(cases) == {
        "case_count": 2,
        "pass_at_k_rate": 1,
        "pass_hat_k_rate": 0.5,
        "assertion_count": 5,
        "assertion_pass_rate": 0.6,
    }
    assert golden.aggregate([])["pass_at_k_rate"] is None


@pytest.mark.parametrize("terminal", ["dropped_out", "advisor_misconduct"])
@pytest.mark.parametrize("conflict", [False, True])
def test_early_termination(monkeypatch, terminal, conflict):
    import asyncio

    import src.integrations.practice_runtime as runtime

    class ConflictError(Exception):
        pass

    class Graph:
        calls = 0

        def __init__(self, *args):
            self.state = {"turn_count": 0, "termination_status": "active"}

        async def start(self, *args):
            pass

        async def get_session_state(self, *args):
            return SimpleNamespace(model_dump=lambda **kwargs: dict(self.state))

        async def continue_session(self, *args):
            Graph.calls += 1
            self.state = {"turn_count": 1, "termination_status": terminal}
            if conflict:
                raise ConflictError("finished")

    monkeypatch.setattr(run, "_runtime", lambda: (None, lambda x: x, Graph, ConflictError, lambda x: x, lambda x: x))
    monkeypatch.setattr(runtime, "SharedLLMCustomerModel", lambda: None)
    monkeypatch.setattr(runtime, "SharedLLMTurnAnalysisModel", lambda: None)
    case = copy.deepcopy(golden.load_dataset()["cases"][0])
    case["advisor_messages"] = ["first", "must not send"]
    case["expected"] = {"turn_count": 1, "termination_status": terminal}
    result = asyncio.run(run.run_live_standard(case, "fresh", stop_on_termination=True))
    assert Graph.calls == 1
    assert result["case_result"] == "PASS"
    assert result["final_state"]["termination_status"] == terminal


def test_review_selection_and_output(tmp_path, monkeypatch):
    async def fake(case, run_id, **kwargs):
        assert case["review"]["status"] != "REJECTED"
        return {"case_result": "PASS", "assertions": [run.assertion("a", True, True)]}

    monkeypatch.setattr(run, "run_live_standard", fake)
    output = tmp_path / "report.json"
    assert (
        golden.main(
            [
                "--mode",
                "live",
                "--include-draft",
                "--repeats",
                "2",
                "--case-id",
                "S01_ON_DISCOVERY_WORK_SCHEDULE",
                "--output",
                str(output),
            ]
        )
        == 0
    )
    report = json.loads(output.read_text())
    assert report["cases"][0]["draft"]
    assert len(report["cases"][0]["runs"]) == 2
    assert report["metrics"]["overall"]["case_count"] == 0
    assert report["draft_metrics"]["overall"]["pass_hat_k_rate"] == 1
    assert output.with_suffix(".md").exists()
    assert golden.main(["--output", str(output)]) == 2
    other = tmp_path / "approved.json"
    assert golden.main(["--mode", "live", "--output", str(other)]) == 1
    assert json.loads(other.read_text())["cases"] == []
