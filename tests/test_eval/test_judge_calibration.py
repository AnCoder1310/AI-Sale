"""Pending calibration labels remain distinct from expert judgements."""

import copy
import json
import subprocess

import pytest

from eval.judge_eval import adapter, run

PENDING_CASE_ID = "JC6_VF6_PLUS_UPSELL_PENDING"


def dataset():
    return run.read_json(run.DEFAULT_DATASET)


def test_pending_case_validates_without_expert_judgements():
    data = dataset()
    report = run.validate_dataset(data)
    assert report["transcript_count"] == 6
    assert report["approved_label_count"] == 25
    assert report["missing_expert_label_count"] == 5
    assert report["status"] == run.PENDING
    assert all(
        label["review_status"] == run.PENDING and label["score"] is None
        for label in data["cases"][-1]["expert_labels"].values()
    )


def test_original_cases_are_byte_identical_to_head():
    original = subprocess.check_output(
        ["git", "show", "HEAD:eval/datasets/judge_calibration.json"], cwd=run.ROOT, text=True
    )
    current = run.DEFAULT_DATASET.read_text()
    # The original case list is an unchanged byte prefix; only a comma and case are appended.
    assert current.startswith(original.removesuffix("\n  ]\n}\n") + ",\n")
    assert dataset()["cases"][:5] == json.loads(original)["cases"]
    assert dataset()["dataset_version"] == json.loads(original)["dataset_version"]


def test_pending_prediction_is_excluded_from_all_agreement_metrics():
    data = dataset()
    predictions = run.read_json(run.ROOT / "eval/reports/judge_calibration_predictions_2026-10-09.json")
    before = run.compare(data, predictions)
    pending = data["cases"][-1]
    prediction = {
        "case_id": pending["case_id"],
        "evaluation": {
            "session_id": "pending-offline-test",
            "scenario_id": pending["scenario_id"],
            "rubric_version": pending["rubric_version"],
            "assessed_criteria_count": 0,
            "overall_score": None,
            "evaluations": [
                {
                    "criterion": criterion,
                    "status": "unassessed",
                    "score": None,
                    "evidence": [],
                    "reason": "Offline exclusion fixture.",
                }
                for criterion in run.CRITERIA
            ],
        },
    }
    predictions["predictions"].append(prediction)
    after = run.compare(data, predictions)
    assert after["metrics"] == before["metrics"]
    assert after["evaluated_transcript_count"] == before["evaluated_transcript_count"] + 1
    assert any("Pending expert labels" in message for message in after["diagnostics"])


@pytest.mark.parametrize(
    "field,value", [("score", 3), ("reviewer_id", "invented"), ("adjudication_status", "APPROVED")]
)
def test_pending_labels_reject_judgement_or_provenance(field, value):
    data = copy.deepcopy(dataset())
    data["cases"][-1]["expert_labels"][run.CRITERIA[0]][field] = value
    with pytest.raises(ValueError, match="pending"):
        run.validate_dataset(data)


def test_pending_case_adapter_preflight_offline(monkeypatch, capsys):
    def no_llm(*args, **kwargs):
        raise AssertionError("preflight must not construct an LLM")

    monkeypatch.setattr(adapter, "get_llm", no_llm)
    assert adapter.main(["--preflight", "--case-id", PENDING_CASE_ID]) == 0
    report = json.loads(capsys.readouterr().out)
    assert report["case_ids"] == [PENDING_CASE_ID]
    assert report["pending_expert_review_case_ids"] == [PENDING_CASE_ID]
    assert report["status"] == "OFFLINE_VALIDATED_RUBRIC_MISMATCH"
    assert report["annotated_claims"] == 11
    assert report["knowledge_sources"] == 3


def test_offline_validate_and_live_dry_path(capsys):
    assert run.main([]) == 0
    assert json.loads(capsys.readouterr().out)["status"] == run.PENDING
    assert run.main(["--mode", "live"]) == 3
    report = json.loads(capsys.readouterr().out)
    assert report["status"] == "NOT_EVALUATED"
    assert report["missing_expert_label_count"] == 5


def test_historical_versions_are_reported_without_relabelling():
    report = run.validate_dataset(dataset())
    assert any("Historical rubric" in message for message in report["diagnostics"])
    assert sum("historical scenario version" in message for message in report["diagnostics"]) == 5
