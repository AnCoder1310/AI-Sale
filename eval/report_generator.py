"""Offline Gate 4 report generator.

Role-play and Judge inputs are runner *result* JSON files, never their fixtures.
The default also reads the established Gate 3 historical reports and uses the
Judge dataset only for an explicitly labelled, safe validation context.
"""

from __future__ import annotations

import argparse
import json
import sqlite3
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from eval.roleplay_eval.run import CASE_IDS as ROLEPLAY_CASE_IDS

ROOT = Path(__file__).resolve().parents[1]
REPORT_DIR = ROOT / "eval" / "reports"
GATE3_RESULTS = REPORT_DIR / "gate3_results.json"
GATE3_FAILURES = REPORT_DIR / "gate3_failed_cases.json"
JUDGE_DATASET = ROOT / "eval" / "datasets" / "judge_calibration.json"
SCHEMA_VERSION = "gate4-report-v1"
COMPONENTS = ("copilot", "retrieval", "roleplay", "judge")
ROLEPLAY_STATUSES = {
    "PASS", "FAIL", "NOT_RUN", "NOT_EVALUATED", "NEEDS_REVIEW",
    "INVALID_TEST_SETUP", "EXECUTION_ERROR",
}
JUDGE_STATUSES = {
    "PENDING_EXPERT_REVIEW", "READY_FOR_COMPARISON", "EVALUATED",
    "INCOMPLETE", "NOT_EVALUATED",
}


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def object_at(value: Any, name: str) -> dict[str, Any]:
    require(isinstance(value, dict), f"{name} must be a JSON object")
    return value


def nonempty(value: Any, name: str) -> str:
    require(isinstance(value, str) and bool(value.strip()), f"{name} must be a nonempty string")
    return value


def read_artifact(path: Path, *, explicit: bool) -> dict[str, Any] | None:
    if not path.exists() and not explicit:
        return None
    try:
        return object_at(json.loads(path.read_text(encoding="utf-8")), str(path))
    except (OSError, json.JSONDecodeError) as exc:
        raise ValueError(f"cannot read result artifact {path}: {exc}") from exc


def source_path(path: Path) -> str:
    path = path.resolve()
    try:
        return path.relative_to(ROOT).as_posix()
    except ValueError:
        return str(path)


def unavailable(component: str, diagnostic: str) -> dict[str, Any]:
    return {
        "component": component,
        "availability": "DATA_UNAVAILABLE",
        "source_path": None,
        "source_run_id": None,
        "source_timestamp": None,
        "source_mode": None,
        "source_provenance": None,
        "source_status": None,
        "coverage": None,
        "metrics": None,
        "failed_cases": [],
        "diagnostics": [diagnostic],
        "limitations": ["No result artifact was supplied or found; this does not establish execution failure."],
    }


def normalize_roleplay(raw: dict[str, Any], path: Path) -> dict[str, Any]:
    mode = nonempty(raw.get("mode"), "roleplay.mode")
    require(mode in {"validate", "deterministic", "live"}, "unsupported roleplay mode")
    status = raw.get("overall_status")
    require(status in ROLEPLAY_STATUSES, "invalid roleplay overall_status")
    cases = raw.get("cases")
    require(isinstance(cases, list), "roleplay.cases must be a list")
    setup_error = raw.get("dataset_status") == "INVALID_TEST_SETUP"
    if not setup_error:
        nonempty(raw.get("benchmark_version"), "roleplay.benchmark_version")
        nonempty(raw.get("run_id"), "roleplay.run_id")
        nonempty(raw.get("executed_at"), "roleplay.executed_at")
    seen: set[str] = set()
    case_counts: Counter[str] = Counter()
    assertion_counts: Counter[str] = Counter()
    failures: list[dict[str, Any]] = []
    pending: list[dict[str, Any]] = []
    provenance: dict[str, str] = {}
    for raw_case in cases:
        case = object_at(raw_case, "roleplay.case")
        case_id = nonempty(case.get("case_id"), "roleplay.case_id")
        require(case_id not in seen, f"duplicate roleplay case_id: {case_id}")
        seen.add(case_id)
        case_status = case.get("case_result")
        require(case_status in ROLEPLAY_STATUSES, f"{case_id} invalid case_result")
        case_counts[case_status] += 1
        provenance[case_id] = nonempty(case.get("provenance"), f"{case_id}.provenance")
        assertions = case.get("assertions")
        diagnostics = case.get("diagnostics")
        require(isinstance(assertions, list) and isinstance(diagnostics, list),
                f"{case_id} assertions/diagnostics must be lists")
        failed_assertions = []
        for raw_assertion in assertions:
            assertion = object_at(raw_assertion, f"{case_id}.assertion")
            assertion_id = nonempty(assertion.get("assertion_id"), "assertion_id")
            assertion_status = assertion.get("status")
            require(assertion_status in {"PASS", "FAIL", "NOT_EVALUATED"},
                    f"{case_id}.{assertion_id} invalid assertion status")
            assertion_counts[assertion_status] += 1
            if assertion_status == "FAIL":
                failed_assertions.append({
                    "assertion_id": assertion_id,
                    "reason": assertion.get("reason"),
                    "expected": assertion.get("expected"),
                    "observed": assertion.get("observed"),
                    "evidence": assertion.get("evidence"),
                })
        item = {
            "case_id": case_id,
            "component": "roleplay",
            "source_status": case_status,
            "source_path": source_path(path),
            "setup_status": case.get("setup_status"),
            "execution_status": case.get("execution_status"),
            "failed_assertions": failed_assertions,
            "diagnostics": diagnostics,
        }
        if case_status in {"FAIL", "INVALID_TEST_SETUP", "EXECUTION_ERROR"}:
            failures.append(item)
        elif case_status in {"NOT_RUN", "NOT_EVALUATED", "NEEDS_REVIEW"}:
            pending.append(item)
    if mode == "validate":
        require(status == "NOT_RUN", "validation-only roleplay result cannot be behavioral PASS")
    missing_case_ids = [case_id for case_id in ROLEPLAY_CASE_IDS if case_id not in seen]
    return {
        "component": "roleplay",
        "availability": "RESULT_AVAILABLE",
        "source_path": source_path(path),
        "source_run_id": raw.get("run_id"),
        "source_timestamp": raw.get("executed_at"),
        "source_mode": mode,
        "source_provenance": provenance,
        "source_status": status,
        "coverage": {
            "case_count": len(cases),
            "expected_case_count": len(ROLEPLAY_CASE_IDS),
            "missing_case_ids": missing_case_ids,
            "suite_coverage_status": "INCOMPLETE" if missing_case_ids else "COMPLETE",
            "case_status_counts": dict(sorted(case_counts.items())),
            "assertion_status_counts": dict(sorted(assertion_counts.items())),
            "behavioral_pass_case_count": 0 if mode == "validate" else case_counts["PASS"],
        },
        "metrics": None,
        "failed_cases": failures,
        "pending_cases": pending,
        "diagnostics": raw.get("diagnostics", []),
        "limitations": (["Fixture validation only; no graph or model behavior was measured."]
                        if mode == "validate" else
                        ["T6 uses a deterministic graph with scripted model outputs; T1-T5 need live behavior."]
                        if mode == "deterministic" else []),
    }


def normalize_judge(raw: dict[str, Any], path: Path) -> dict[str, Any]:
    mode = nonempty(raw.get("mode"), "judge.mode")
    require(mode in {"validate", "compare", "live"}, "unsupported judge mode")
    status = raw.get("status")
    require(status in JUDGE_STATUSES, "invalid judge status")
    case_ids = raw.get("case_ids")
    require(isinstance(case_ids, list) and all(isinstance(x, str) and x for x in case_ids)
            and len(case_ids) == len(set(case_ids)), "judge.case_ids invalid")
    for key in ("transcript_count", "approved_label_count", "missing_expert_label_count",
                "evaluated_transcript_count", "comparable_criterion_pair_count"):
        require(type(raw.get(key)) is int and raw[key] >= 0, f"judge.{key} invalid")
    require(raw["transcript_count"] == len(case_ids), "judge transcript count mismatch")
    metrics = raw.get("metrics")
    if mode in {"validate", "live"}:
        require(metrics is None, "judge validation/live blocker cannot contain measured metrics")
    if metrics is not None:
        metrics = object_at(metrics, "judge.metrics")
        denominator = metrics.get("mae_denominator")
        require(type(denominator) is int and denominator >= 0, "judge MAE denominator invalid")
        require(denominator == raw["comparable_criterion_pair_count"], "judge comparable pair count mismatch")
        require(metrics.get("mae") is None if denominator == 0 else
                isinstance(metrics.get("mae"), (int, float)), "judge MAE/null denominator mismatch")
    if status in {"PENDING_EXPERT_REVIEW", "READY_FOR_COMPARISON", "NOT_EVALUATED"}:
        require(metrics is None or metrics.get("mae") is None,
                "judge pending/not evaluated result cannot contain scored MAE")
    diagnostics = raw.get("diagnostics")
    require(isinstance(diagnostics, list), "judge.diagnostics must be a list")
    return {
        "component": "judge",
        "availability": "RESULT_AVAILABLE",
        "source_path": source_path(path),
        "source_run_id": raw.get("run_id"),
        "source_timestamp": raw.get("executed_at"),
        "source_mode": mode,
        "source_provenance": {
            "transcripts": raw.get("provenance"),
            "predictions": raw.get("prediction_provenance"),
        },
        "source_status": status,
        "coverage": {
            "transcript_count": raw["transcript_count"],
            "approved_expert_label_count": raw["approved_label_count"],
            "missing_expert_label_count": raw["missing_expert_label_count"],
            "prediction_count": raw.get("prediction_count"),
            "evaluated_transcript_count": raw["evaluated_transcript_count"],
            "comparable_scored_criterion_pairs": raw["comparable_criterion_pair_count"],
            "missing_prediction_case_ids": raw.get("missing_prediction_case_ids"),
        },
        "metrics": metrics,
        "failed_cases": [],
        "diagnostics": diagnostics,
        "limitations": (["No approved expert-label/prediction agreement is established by validation alone."]
                        if mode == "validate" else
                        ["Fixed-transcript live integration is unavailable; no model was called."]
                        if mode == "live" else []),
    }


def judge_dataset_context(path: Path | None) -> dict[str, Any] | None:
    if path is None:
        return None
    raw = read_artifact(path, explicit=True)
    # Reuse the implemented safe validator. This is dataset context, not a
    # prediction or a saved Judge result.
    from eval.judge_eval.run import validate_dataset

    validation = validate_dataset(raw)
    return {
        "source_path": source_path(path),
        "source_kind": "calibration_dataset_validation_only",
        "status": validation["status"],
        "transcript_count": validation["transcript_count"],
        "approved_label_count": validation["approved_label_count"],
        "missing_expert_label_count": validation["missing_expert_label_count"],
        "diagnostics": validation["diagnostics"],
    }


def normalize_gate3(
    results: dict[str, Any], result_path: Path,
    failures: dict[str, Any] | None, failure_path: Path | None,
) -> dict[str, dict[str, Any]]:
    require(results.get("schema_version") == "gate3-eval-v1", "unsupported Gate 3 results schema")
    require(isinstance(results.get("components"), dict), "Gate 3 results.components invalid")
    if failures is not None:
        require(failures.get("schema_version") == "gate3-eval-v1"
                and failures.get("benchmark_version") == results.get("benchmark_version")
                and isinstance(failures.get("components"), dict), "Gate 3 failed-cases artifact mismatch")
    output: dict[str, dict[str, Any]] = {}
    for name in ("copilot", "retrieval"):
        raw = results["components"].get(name)
        if raw is None:
            output[name] = unavailable(name, f"Gate 3 historical result has no {name} component.")
            continue
        raw = object_at(raw, f"gate3.{name}")
        require(raw.get("runner") == name, f"Gate 3 {name} runner mismatch")
        timestamp = nonempty(raw.get("timestamp"), f"gate3.{name}.timestamp")
        rows = raw.get("per_case_results")
        metrics = raw.get("aggregate_metrics")
        require(isinstance(rows, list) and isinstance(metrics, dict), f"Gate 3 {name} rows/metrics invalid")
        require(type(raw.get("number_of_cases")) is int and len(rows) == raw["number_of_cases"],
                f"Gate 3 {name} case count mismatch")
        for metric_name, metric in metrics.items():
            metric = object_at(metric, f"gate3.{name}.{metric_name}")
            for field in ("score", "applicable_cases", "observed_cases", "passed_cases",
                          "failed_cases", "not_observable_cases", "not_applicable_cases"):
                require(field in metric, f"Gate 3 {name}.{metric_name}.{field} missing")
        indexed: dict[tuple[str, int], dict[str, Any]] = {}
        for row in rows:
            row = object_at(row, f"gate3.{name}.case")
            case_id = nonempty(row.get("case_id"), "gate3.case_id")
            run_index = row.get("run_index")
            require(type(run_index) is int, "Gate 3 run_index invalid")
            require((case_id, run_index) not in indexed, "duplicate Gate 3 case/run index")
            require(isinstance(row.get("metrics"), dict), "Gate 3 case metrics invalid")
            indexed[(case_id, run_index)] = row
        expected_failure_keys = {
            key for key, row in indexed.items()
            if any(isinstance(metric, dict) and metric.get("status") in {"fail", "not_observable"}
                   for metric in row["metrics"].values())
        }
        source_failures: list[dict[str, Any]] = []
        failed_component = failures["components"].get(name) if failures is not None else None
        if failed_component is not None:
            failed_component = object_at(failed_component, f"gate3.failed.{name}")
            require(failed_component.get("timestamp") == timestamp,
                    f"Gate 3 {name} result/failure timestamps differ")
            failed_rows = failed_component.get("cases")
            require(isinstance(failed_rows, list) and
                    failed_component.get("number_of_cases") == len(failed_rows),
                    f"Gate 3 {name} failure count mismatch")
            require({(item.get("case_id"), item.get("run_index")) for item in failed_rows}
                    == expected_failure_keys, f"Gate 3 {name} failed-case coverage mismatch")
            for failure in failed_rows:
                failure = object_at(failure, f"gate3.failed.{name}.case")
                key = (nonempty(failure.get("case_id"), "failed case_id"), failure.get("run_index"))
                require(key in indexed, f"Gate 3 {name} failure not in result cases")
                failed_metrics = object_at(failure.get("failed_metrics"), "failed_metrics")
                require(failed_metrics, f"Gate 3 {name} failure lacks failed metrics")
                for metric_name in failed_metrics:
                    case_metric = indexed[key]["metrics"].get(metric_name)
                    require(isinstance(case_metric, dict) and
                            case_metric.get("status") in {"fail", "not_observable"},
                            f"Gate 3 {name} failure metric does not match source result")
                    require(case_metric.get("reason") == failed_metrics[metric_name],
                            f"Gate 3 {name} failure reason differs from source result")
                source_failures.append({
                    "case_id": key[0], "run_index": key[1], "component": name,
                    "source_status": "failed_metrics",
                    "source_path": source_path(failure_path),
                    "failed_metrics": failed_metrics,
                    "reason": failure.get("reason"),
                    "expected": failure.get("expected"),
                    "observed": failure.get("actual"),
                })
        else:
            for (case_id, run_index), row in indexed.items():
                failed_metrics = {
                    metric_name: metric.get("reason")
                    for metric_name, metric in row["metrics"].items()
                    if isinstance(metric, dict) and metric.get("status") in {"fail", "not_observable"}
                }
                if failed_metrics:
                    source_failures.append({
                        "case_id": case_id, "run_index": run_index, "component": name,
                        "source_status": "failed_metrics", "source_path": source_path(result_path),
                        "failed_metrics": failed_metrics,
                        "reason": "; ".join(str(value) for value in failed_metrics.values()),
                        "expected": row.get("expected"), "observed": row.get("actual"),
                    })
        source_failures.sort(key=lambda item: (item["case_id"], item["run_index"]))
        output[name] = {
            "component": name,
            "availability": "RESULT_AVAILABLE",
            "source_path": source_path(result_path),
            "source_failed_cases_path": source_path(failure_path) if failed_component is not None else None,
            "source_run_id": None,
            "source_timestamp": timestamp,
            "source_mode": "historical_gate3",
            "source_provenance": raw.get("execution_config"),
            "source_status": None,
            "coverage": {
                "case_count": raw["number_of_cases"],
                "unique_cases": raw.get("unique_cases"),
                "reported_failed_case_count": len(source_failures),
            },
            "metrics": metrics,
            "failed_cases": source_failures,
            "diagnostics": [],
            "limitations": ["Historical Gate 3 run; this report does not rerun Copilot or Retrieval."],
        }
    return output


def build_report(
    *, roleplay_path: Path | None = None, judge_path: Path | None = None,
    gate3_results_path: Path | None = GATE3_RESULTS,
    gate3_failures_path: Path | None = GATE3_FAILURES,
    judge_dataset_path: Path | None = JUDGE_DATASET,
    generated_at: str | None = None,
) -> dict[str, Any]:
    """Build one report object; all Markdown and JSON output uses this object."""
    source_artifacts: list[dict[str, Any]] = []
    sections: dict[str, dict[str, Any]] = {}
    result = read_artifact(gate3_results_path, explicit=True) if gate3_results_path else None
    failed = read_artifact(gate3_failures_path, explicit=True) if gate3_failures_path and result else None
    if result is not None:
        sections.update(normalize_gate3(result, gate3_results_path, failed, gate3_failures_path))
        source_artifacts.append({"path": source_path(gate3_results_path), "kind": "historical_gate3_results"})
        if failed is not None:
            source_artifacts.append({"path": source_path(gate3_failures_path), "kind": "historical_gate3_failed_cases"})
    else:
        sections["copilot"] = unavailable("copilot", "No Copilot result artifact available.")
        sections["retrieval"] = unavailable("retrieval", "No Retrieval result artifact available.")
    roleplay = read_artifact(roleplay_path, explicit=True) if roleplay_path else None
    sections["roleplay"] = (normalize_roleplay(roleplay, roleplay_path) if roleplay is not None else
                            unavailable("roleplay", "No T1-T6 runner result artifact supplied."))
    if roleplay is not None:
        source_artifacts.append({"path": source_path(roleplay_path), "kind": "roleplay_runner_result"})
    judge = read_artifact(judge_path, explicit=True) if judge_path else None
    sections["judge"] = (normalize_judge(judge, judge_path) if judge is not None else
                         unavailable("judge", "No Judge runner result artifact supplied."))
    if judge is not None:
        source_artifacts.append({"path": source_path(judge_path), "kind": "judge_runner_result"})
    context = judge_dataset_context(judge_dataset_path)
    if context is not None:
        sections["judge"]["dataset_context"] = context
        source_artifacts.append({"path": source_path(judge_dataset_path), "kind": "calibration_dataset_validation_only"})
    sections = {name: sections[name] for name in COMPONENTS}
    failures = [failure for name in COMPONENTS for failure in sections[name]["failed_cases"]]
    pending: list[str] = []
    if sections["roleplay"]["availability"] == "DATA_UNAVAILABLE":
        pending.append("Cần artifact kết quả thực thi T1–T6; không suy ra trạng thái benchmark từ fixture.")
    elif sections["roleplay"]["coverage"]["missing_case_ids"]:
        pending.append("Role-play thiếu kết quả các case: " +
                       ", ".join(sections["roleplay"]["coverage"]["missing_case_ids"]) + ".")
    elif sections["roleplay"]["source_status"] != "PASS" or sections["roleplay"]["source_mode"] == "validate":
        pending.append("Role-play chưa có kết quả đủ để kết luận toàn bộ T1–T6 đạt yêu cầu.")
    if sections["judge"]["availability"] == "DATA_UNAVAILABLE":
        pending.append("Chưa có artifact kết quả Judge calibration.")
    elif sections["judge"]["source_status"] != "EVALUATED":
        pending.append("Judge calibration chưa có kết quả so sánh hoàn chỉnh.")
    if context is not None and context["missing_expert_label_count"]:
        pending.append(f"Còn {context['missing_expert_label_count']} nhãn chuyên gia cần duyệt.")
    if context is not None and any("Fixed transcript live import" in text for text in context["diagnostics"]):
        pending.append("Chưa có API nạp transcript cố định vào RoleplayState để chạy Judge live.")
    return {
        "schema_version": SCHEMA_VERSION,
        "generated_at": generated_at or datetime.now(timezone.utc).isoformat(),
        "generation_status": "GENERATED",
        "source_artifacts": source_artifacts,
        "components": sections,
        "failed_cases": failures,
        "overall_readiness": {
            "status": "GATE_4_VALIDATION_PENDING",
            "gate4_acceptance": None,
            "pending_items": pending,
            "note": "Tạo báo cáo thành công không đồng nghĩa benchmark hoặc Gate 4 đã PASS.",
        },
    }


def build_gate4_handoff(
    *, reviewed_path: Path, live_path: Path, t6_path: Path,
    predictions_path: Path, retry_path: Path,
    judge_dataset_path: Path = JUDGE_DATASET,
    index_count: int | None = None,
    generated_at: str | None = None,
) -> dict[str, Any]:
    """Summarize only the available Gate 4 evidence; never infer missing runs or metrics."""
    from eval.judge_eval.adapter import PROVENANCE, make_artifact
    from eval.judge_eval.run import validate_dataset
    from src.config import get_settings

    reviewed = read_artifact(reviewed_path, explicit=True)
    live = read_artifact(live_path, explicit=True)
    t6 = read_artifact(t6_path, explicit=True)
    predictions = read_artifact(predictions_path, explicit=True)
    retry = read_artifact(retry_path, explicit=True)
    dataset = read_artifact(judge_dataset_path, explicit=True)
    labels = validate_dataset(dataset)
    require(labels["status"] == "READY_FOR_COMPARISON" and labels["approved_label_count"] == 25,
            "Judge labels are not 25/25 approved")
    reviewed_section = normalize_roleplay(reviewed, reviewed_path)
    t6_section = normalize_roleplay(t6, t6_path)
    require(reviewed["mode"] == "live" and reviewed["run_id"] == live.get("run_id")
            and reviewed["overall_status"] == live.get("overall_status") == "FAIL",
            "reviewed/live provenance mismatch")
    require([x["case_id"] for x in reviewed["cases"]] == list(ROLEPLAY_CASE_IDS[i] for i in (0, 1, 4))
            and [x["case_id"] for x in live["cases"]] == [x["case_id"] for x in reviewed["cases"]],
            "reviewed run must contain T1, T2 and T5 only")
    require([x["case_result"] for x in reviewed["cases"]] == ["PASS", "FAIL", "PASS"]
            and [x["case_result"] for x in live["cases"]] == ["PASS", "FAIL", "NEEDS_REVIEW"],
            "reviewed/live case results differ from handoff evidence")
    require(reviewed["cases"][:2] == live["cases"][:2], "T1/T2 changed during human review")
    new_t5, old_t5 = reviewed["cases"][2], live["cases"][2]
    require(new_t5.get("semantic_review_status") == "REVIEWED"
            and new_t5.get("semantic_review", {}).get("label") == "PASS"
            and new_t5.get("semantic_review", {}).get("run_id") == reviewed["run_id"],
            "T5 approved human review missing")
    require(new_t5.get("checkpoints") == old_t5.get("checkpoints")
            and new_t5.get("observations") == old_t5.get("observations")
            and new_t5.get("automated_results") == old_t5.get("automated_results"),
            "T5 runtime evidence changed during review")
    require(t6["mode"] == "deterministic" and t6["overall_status"] == "PASS"
            and len(t6["cases"]) == 1 and t6["cases"][0]["case_id"] == ROLEPLAY_CASE_IDS[5]
            and t6["cases"][0]["case_result"] == "PASS", "T6 deterministic result invalid")
    flows = t6["cases"][0].get("flows", [])
    require([(x.get("flow_id"), x.get("flow_status")) for x in flows]
            == [("explicit_finish", "PASS"), ("max_turn", "PASS")]
            and sum(x.get("status") == "PASS" for flow in flows for x in flow.get("assertions", [])) == 77,
            "T6 flow evidence differs from reported 77 passes")

    require(predictions.get("status") == "INCOMPLETE" and predictions.get("provenance") == PROVENANCE
            and predictions.get("successful_case_count") == 4
            and predictions.get("failed_case_count") == 1,
            "Judge prediction artifact is not the expected incomplete run")
    expected = make_artifact(dataset, predictions["predictions"], predictions["failures"],
                             provider=predictions["provider"], model=predictions["model"])
    require(all(predictions.get(key) == value for key, value in expected.items() if key != "generated_at"),
            "Judge prediction artifact fails adapter contract")
    jc3 = "JC3_CONTEXT_ADAPTIVE"
    error = {"case_id": jc3, "error_type": "EvaluationError",
             "reason": "score 3 requires customer context evidence"}
    require(predictions["missing_case_ids"] == [jc3] and predictions["failures"] == [error]
            and retry.get("status") == "INCOMPLETE" and retry.get("provider") == predictions["provider"]
            and retry.get("model") == predictions["model"] and retry.get("provenance") == PROVENANCE
            and retry.get("predictions") == [] and retry.get("failures") == [error],
            "JC3 retry evidence differs from incomplete Judge run")

    settings = get_settings()
    require(settings.vector_store_type == "chroma", "runtime vector store is not Chroma")
    index_path = Path(settings.chroma_persist_dir).resolve() / "chroma.sqlite3"
    if index_count is None:
        with sqlite3.connect(index_path.as_uri() + "?mode=ro", uri=True) as database:
            row = database.execute(
                "SELECT count(e.id) FROM collections c "
                "LEFT JOIN segments s ON s.collection=c.id "
                "LEFT JOIN embeddings e ON e.segment_id=s.id WHERE c.name=?",
                (settings.chroma_collection_name,),
            ).fetchone()
            require(row is not None, "Chroma collection count unavailable")
            index_count = row[0]
    require(type(index_count) is int and index_count >= 0, "invalid index count")

    case_results = []
    for raw, path in ((reviewed, reviewed_path), (t6, t6_path)):
        for case in raw["cases"]:
            case_results.append({
                "case_id": case["case_id"], "status": case["case_result"],
                "execution_status": case["execution_status"],
                "source_path": source_path(path), "run_id": raw["run_id"],
                "assertion_counts": dict(Counter(x["status"] for x in case.get("assertions", []))),
            })
    for case_id in ROLEPLAY_CASE_IDS[2:4]:
        case_results.append({"case_id": case_id, "status": "NOT_RUN", "execution_status": "NOT_RUN",
                             "source_path": None, "run_id": None, "assertion_counts": {},
                             "reason": "Chroma index empty" if index_count == 0 else "live run not performed"})
    case_results.sort(key=lambda item: ROLEPLAY_CASE_IDS.index(item["case_id"]))
    require(len({x["case_id"] for x in case_results}) == 6, "roleplay case coverage invalid")
    roleplay = reviewed_section
    roleplay["source_mode"] = "live_and_deterministic_separate_runs"
    roleplay["source_paths"] = [source_path(reviewed_path), source_path(t6_path)]
    roleplay["source_run_ids"] = [reviewed["run_id"], t6["run_id"]]
    roleplay["case_results"] = case_results
    roleplay["coverage"] = {
        "expected_case_count": 6, "executed_case_count": 4,
        "missing_case_ids": list(ROLEPLAY_CASE_IDS[2:4]),
        "suite_coverage_status": "INCOMPLETE",
        "case_status_counts": dict(Counter(x["status"] for x in case_results)),
    }
    roleplay["source_status"] = "FAIL"
    roleplay["failed_cases"] = reviewed_section["failed_cases"]
    roleplay["limitations"] = ["T3/T4 were not run; T6 used deterministic models in a separate run."]
    judge = {
        "component": "judge", "availability": "RESULT_AVAILABLE",
        "source_path": source_path(predictions_path), "retry_source_path": source_path(retry_path),
        "source_status": "INCOMPLETE", "source_mode": "production_evaluator_predictions",
        "source_provenance": predictions["provenance"],
        "provider": predictions["provider"], "model": predictions["model"],
        "coverage": {"transcript_count": 5, "approved_expert_label_count": 25,
                     "prediction_count": 4, "missing_prediction_case_ids": [jc3]},
        "metrics": None, "metrics_status": "NOT_EVALUATED",
        "failed_cases": [{**error, "source_path": source_path(predictions_path),
                          "retry_source_path": source_path(retry_path)}],
        "dataset_context": judge_dataset_context(judge_dataset_path),
    }
    findings = [
        {"id": "G4-T2", "priority": "P1", "owner": "Duy", "status": "FAIL",
         "title": "State discovery không khớp hội thoại",
         "evidence": source_path(reviewed_path),
         "detail": "Khách nói chạy 200–300 km/ngày; daily_distance vắng trong revealed_facts, advisor_discoveries và spoken_fact_message_ids. Chưa xác định lỗi ở analyzer hay reducer."},
        {"id": "G4-T3T4", "priority": "P1", "owner": "Đạt (ingestion orchestration), Chương (vector store support)",
         "status": "BLOCKED/NOT_RUN", "title": "Index retrieval runtime rỗng",
         "evidence": None, "observation_provenance": "local_read_only_preflight",
         "detail": f"Quan sát preflight read-only trên môi trường local: collection {settings.chroma_collection_name} có {index_count} embeddings. T3/T4 chưa có kết quả live; không có artifact Chroma chia sẻ. Chưa có bằng chứng lỗi production retrieval."},
        {"id": "G4-JC3", "priority": "P1", "owner": "Duy", "status": "INCOMPLETE",
         "title": "Judge từ chối evidence của JC3",
         "evidence": source_path(retry_path),
         "detail": "Hai lượt JC3 đều lỗi EvaluationError: score 3 requires customer context evidence. Chưa có bằng chứng validator sai rubric."},
    ]
    acceptance = [
        {"requirement": "Runner Role-play tự động", "status": "MET"},
        {"requirement": "Assertions machine-readable T1–T6", "status": "MET_WITH_INCOMPLETE_EXECUTION"},
        {"requirement": "Judge MAE / criterion agreement", "status": "PENDING"},
        {"requirement": "eval/reports/latest.md được sinh tự động", "status": "MET"},
    ]
    sources = [
        {"path": source_path(path), "kind": kind} for path, kind in (
            (reviewed_path, "reviewed_roleplay_live"), (live_path, "raw_roleplay_live"),
            (t6_path, "deterministic_t6"), (ROOT / "eval/datasets/roleplay_benchmark.json", "roleplay_fixture"),
            (predictions_path, "incomplete_judge_predictions"), (retry_path, "jc3_retry_failure"),
            (judge_dataset_path, "approved_judge_labels"),
        )
    ]
    return {
        "schema_version": SCHEMA_VERSION,
        "generated_at": generated_at or datetime.now(timezone.utc).isoformat(),
        "generation_status": "GENERATED", "scope": "Gate 4 Checkpoint Đ4 handoff",
        "source_artifacts": sources,
        "components": {"roleplay": roleplay, "judge": judge},
        "findings": findings,
        "priority_note": "P1 là mức ưu tiên đánh giá đề xuất. ROADMAP nêu P0/P1/P2 nhưng không có quy tắc phân loại riêng cho Gate 4; đây không phải severity chính thức của đội phát triển.",
        "acceptance": acceptance,
        "retrieval_readiness": {"observation_provenance": "local_read_only_preflight",
                                "shared_artifact": False, "collection": settings.chroma_collection_name,
                                "embedding_count": index_count,
                                "status": "NOT_READY" if index_count == 0 else "UNVERIFIED"},
        "overall_readiness": {
            "status": "GATE_4_VALIDATION_PENDING", "gate4_acceptance": False,
            "pending_items": ["T2 discovery FAIL", "T3/T4 live NOT_RUN",
                              "Judge calibration INCOMPLETE; MAE/agreement NOT_EVALUATED"],
            "note": "Bằng chứng đánh giá đã sẵn sàng bàn giao; Gate 4 chưa đạt đầy đủ acceptance.",
        },
    }


def render_handoff_markdown(report: dict[str, Any]) -> str:
    lines = [
        "# Gate 4 Evaluation Report", "", f"Thời điểm tạo báo cáo: {report['generated_at']}", "",
        "## Kết luận", "",
        "Phần xây dựng và thu thập đánh giá đã có bằng chứng bàn giao. Gate 4 chưa đạt đầy đủ acceptance: "
        "T2 FAIL, T3–T4 chưa chạy và Judge metrics chưa có.", "",
        "## Role-play T1–T6", "",
        "| Case | Kết quả | Execution | Run/artifact |", "| --- | --- | --- | --- |",
    ]
    for case in report["components"]["roleplay"]["case_results"]:
        lines.append(f"| {case['case_id']} | {case['status']} | {case['execution_status']} | "
                     f"{case['source_path'] or 'chưa có'} |")
    lines.extend(["", "T5: human review `dat-eval-lead` APPROVED PASS; 13/13 assertions PASS. "
                  "T6: explicit_finish và max_turn PASS, 77 assertions PASS.", "",
                  "## Judge calibration", ""])
    judge = report["components"]["judge"]
    lines.append(f"25/25 expert labels APPROVED; {judge['coverage']['prediction_count']}/5 predictions hợp lệ. "
                 "JC3 thất bại hai lượt với `EvaluationError: score 3 requires customer context evidence`. "
                 "Judge status: INCOMPLETE; MAE, exact/criterion/applicability agreement: NOT_EVALUATED.")
    lines.extend(["", "## Findings (mức ưu tiên đề xuất)", "", report["priority_note"], ""])
    for item in report["findings"]:
        evidence = (f"Evidence: `{item['evidence']}`."
                    if item["evidence"] else "Quan sát local; không có artifact Chroma chia sẻ.")
        lines.append(f"- **{item['id']} — {item['priority']} — {item['owner']}**: {item['title']}; "
                     f"{item['status']}. {item['detail']} {evidence}")
    lines.extend(["", "## Checkpoint Đ4 acceptance", ""])
    for item in report["acceptance"]:
        lines.append(f"- {item['requirement']}: {item['status']}.")
    lines.extend(["", "## Dependency tiếp theo", ""])
    for item in report["overall_readiness"]["pending_items"]:
        lines.append(f"- {item}.")
    lines.extend(["", "## Nguồn bằng chứng", ""])
    for item in report["source_artifacts"]:
        lines.append(f"- `{item['path']}` — {item['kind']}.")
    return "\n".join(lines) + "\n"


def render_markdown(report: dict[str, Any]) -> str:
    if report.get("scope") == "Gate 4 Checkpoint Đ4 handoff":
        return render_handoff_markdown(report)
    lines = [
        "# Gate 4 Evaluation Report",
        "",
        f"Thời điểm tạo báo cáo: {report['generated_at']}",
        "",
        "## Tóm tắt",
        "",
        f"Trạng thái báo cáo: {report['generation_status']}. "
        f"Đánh giá Gate 4: {report['overall_readiness']['status']}; chưa có kết luận PASS.",
        "",
        "## Thành phần",
        "",
        "| Thành phần | Dữ liệu | Trạng thái nguồn | Phạm vi |",
        "| --- | --- | --- | --- |",
    ]
    for name, label in (("copilot", "Copilot"), ("retrieval", "Retrieval"),
                        ("roleplay", "Role-play T1–T6"), ("judge", "Judge calibration")):
        section = report["components"][name]
        coverage = section["coverage"] or {}
        count = coverage.get("case_count", coverage.get("transcript_count"))
        scope = f"{count} case" if count is not None else "chưa có kết quả"
        if section["source_mode"] == "historical_gate3":
            scope += f"; lịch sử {section['source_timestamp']}"
        elif section["source_mode"]:
            scope += f"; mode {section['source_mode']}"
        if name == "roleplay" and section["coverage"]:
            scope += f"; {section['coverage']['suite_coverage_status']}"
        lines.append(f"| {label} | {section['availability']} | "
                     f"{section['source_status'] or 'không có'} | {scope} |")
    lines.extend(["", "## Số liệu và độ phủ", ""])
    for name in COMPONENTS:
        section = report["components"][name]
        lines.append(f"### {name}")
        lines.append("")
        if section["availability"] == "DATA_UNAVAILABLE":
            lines.append("Chưa có artifact kết quả.")
        elif name in {"copilot", "retrieval"}:
            lines.append(f"Nguồn lịch sử: `{section['source_path']}`; "
                         f"{section['coverage']['case_count']} case, "
                         f"{section['coverage']['reported_failed_case_count']} case có metric lỗi.")
            for metric_name, metric in section["metrics"].items():
                lines.append(
                    f"- {metric_name}: score {metric['score']}; "
                    f"applicable {metric['applicable_cases']}, observed {metric['observed_cases']}, "
                    f"pass {metric['passed_cases']}, fail {metric['failed_cases']}, "
                    f"not_observable {metric['not_observable_cases']}, "
                    f"not_applicable {metric['not_applicable_cases']}."
                )
        elif name == "roleplay":
            coverage = section["coverage"]
            lines.append(
                f"Run ID: {section['source_run_id'] or 'không có'}; "
                f"timestamp nguồn: {section['source_timestamp'] or 'không có'}; "
                f"trạng thái case: {json.dumps(coverage['case_status_counts'], ensure_ascii=False)}. "
                f"Case PASS trong artifact: {coverage['behavioral_pass_case_count']}."
            )
            lines.append(
                f"Độ phủ T1–T6: {coverage['suite_coverage_status']} "
                f"({coverage['case_count']}/{coverage['expected_case_count']}); "
                f"case thiếu: {', '.join(coverage['missing_case_ids']) if coverage['missing_case_ids'] else 'không có'}. "
                "Trạng thái nguồn chỉ áp dụng cho case có trong artifact."
            )
        else:
            coverage = section["coverage"]
            metrics = section["metrics"]
            lines.append(
                f"Transcript: {coverage['transcript_count']}; nhãn duyệt: "
                f"{coverage['approved_expert_label_count']}; dự đoán: "
                f"{coverage['prediction_count'] if coverage['prediction_count'] is not None else 'chưa có'}; "
                f"cặp điểm so sánh: {coverage['comparable_scored_criterion_pairs']}."
            )
            lines.append(
                f"MAE: {metrics['mae'] if metrics is not None and metrics['mae'] is not None else 'NOT_EVALUATED'}; "
                f"mẫu số: {metrics['mae_denominator'] if metrics is not None else 'chưa có'}."
            )
        if name == "judge" and section.get("dataset_context"):
            context = section["dataset_context"]
            lines.append(
                f"Dataset (chỉ kiểm tra cấu trúc): {context['status']}; "
                f"{context['transcript_count']} transcript; "
                f"{context['missing_expert_label_count']} nhãn chờ duyệt."
            )
        lines.append("")
    lines.extend(["## Case lỗi đã ghi nhận", ""])
    if report["failed_cases"]:
        for name in COMPONENTS:
            items = report["components"][name]["failed_cases"]
            if items:
                ids = ", ".join(item["case_id"] for item in items)
                lines.append(f"- {name}: {len(items)} case — {ids}. Chi tiết lý do và evidence trong `latest.json`.")
    else:
        lines.append("Không có case lỗi trong các artifact đã đọc; phần thiếu kết quả vẫn chưa được đánh giá.")
    lines.extend(["", "## Việc còn chờ", ""])
    for item in report["overall_readiness"]["pending_items"]:
        lines.append(f"- {item}")
    lines.extend(["", "## Nguồn đã đọc", ""])
    for source in report["source_artifacts"]:
        lines.append(f"- `{source['path']}` — {source['kind']}.")
    return "\n".join(lines) + "\n"


def write_reports(report: dict[str, Any], directory: Path) -> tuple[Path, Path]:
    json_path = directory / "latest.json"
    markdown_path = directory / "latest.md"
    if json_path.exists():
        existing = read_artifact(json_path, explicit=True)
        require(existing.get("schema_version") == SCHEMA_VERSION,
                f"refusing to replace unrelated historical artifact: {json_path}")
    if markdown_path.exists():
        require(markdown_path.read_text(encoding="utf-8").startswith("# Gate 4 Evaluation Report\n"),
                f"refusing to replace unrelated historical artifact: {markdown_path}")
    payload = json.dumps(report, ensure_ascii=False, indent=2, allow_nan=False) + "\n"
    markdown = render_markdown(report)
    directory.mkdir(parents=True, exist_ok=True)
    json_path.write_text(payload, encoding="utf-8")
    markdown_path.write_text(markdown, encoding="utf-8")
    return json_path, markdown_path


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Generate an offline Gate 4 evaluation report")
    parser.add_argument("--roleplay-result", type=Path)
    parser.add_argument("--judge-result", type=Path)
    parser.add_argument("--gate4-handoff", action="store_true", help="Summarize the existing Gate 4 evidence only")
    parser.add_argument("--roleplay-live", type=Path)
    parser.add_argument("--t6-result", type=Path)
    parser.add_argument("--judge-predictions", type=Path)
    parser.add_argument("--judge-retry", type=Path)
    parser.add_argument("--judge-dataset", type=Path, default=JUDGE_DATASET)
    parser.add_argument("--gate3-results", type=Path)
    parser.add_argument("--gate3-failures", type=Path)
    parser.add_argument("--output-dir", type=Path, default=REPORT_DIR)
    args = parser.parse_args(argv)
    gate3_results = args.gate3_results if args.gate3_results is not None else (
        GATE3_RESULTS if GATE3_RESULTS.exists() else None
    )
    gate3_failures = args.gate3_failures if args.gate3_failures is not None else (
        GATE3_FAILURES if args.gate3_results is None and GATE3_FAILURES.exists() else None
    )
    try:
        if args.gate4_handoff:
            require(all((args.roleplay_result, args.roleplay_live, args.t6_result,
                         args.judge_predictions, args.judge_retry)),
                    "Gate 4 handoff requires reviewed/live Role-play, T6 and Judge prediction/retry artifacts")
            report = build_gate4_handoff(
                reviewed_path=args.roleplay_result, live_path=args.roleplay_live,
                t6_path=args.t6_result, predictions_path=args.judge_predictions,
                retry_path=args.judge_retry, judge_dataset_path=args.judge_dataset,
            )
        else:
            report = build_report(
                roleplay_path=args.roleplay_result,
                judge_path=args.judge_result,
                gate3_results_path=gate3_results,
                gate3_failures_path=gate3_failures,
                judge_dataset_path=args.judge_dataset,
            )
        json_path, markdown_path = write_reports(report, args.output_dir)
        print(json.dumps({
            "generation_status": report["generation_status"],
            "overall_readiness": report["overall_readiness"]["status"],
            "json_path": str(json_path),
            "markdown_path": str(markdown_path),
        }, ensure_ascii=False, allow_nan=False))
        return 0
    except (OSError, ValueError, TypeError, KeyError) as exc:
        print(f"report generator error: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
