"""Shared dataset, execution, index, and report helpers for Gate 3 evaluation."""

from __future__ import annotations

import argparse
import hashlib
import inspect
import json
import os
import re
import tempfile
import time
from collections.abc import Awaitable, Callable, Mapping, Sequence
from contextlib import contextmanager
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any

from eval.metrics import aggregate_metrics, metric_result

REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DATASET = REPO_ROOT / "eval" / "datasets" / "copilot_benchmark.json"
DEFAULT_REPORTS_DIR = REPO_ROOT / "eval" / "reports"
CORPUS_PATH = REPO_ROOT / "data" / "knowledge" / "corpus.json"
_GROUPS = {"on_topic", "negative", "edge"}
_BEHAVIORS = {"answer", "abstain", "clarify"}


def _object(value: Any, location: str, fields: Sequence[str]) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ValueError(f"{location} must be an object")
    missing = set(fields) - value.keys()
    if missing:
        raise ValueError(f"{location} missing required fields: {', '.join(sorted(missing))}")
    return value


def _string(value: Any, location: str, *, allow_empty: bool = False) -> str:
    if not isinstance(value, str) or (not allow_empty and not value.strip()):
        raise ValueError(f"{location} must be {'a string' if allow_empty else 'a non-empty string'}")
    return value


def _string_ids(value: Any, location: str) -> list[str]:
    if not isinstance(value, list):
        raise ValueError(f"{location} must be an array of document IDs")
    ids = [_string(item, f"{location}[{index}]") for index, item in enumerate(value)]
    if len(ids) != len(set(ids)):
        raise ValueError(f"{location} contains duplicate document IDs")
    return ids


def load_dataset(path: Path = DEFAULT_DATASET) -> dict[str, Any]:
    """Load and validate the benchmark without inventing or changing expected facts."""
    if not path.is_file():
        raise FileNotFoundError(f"Gate 3 benchmark dataset is missing: {path}. Supply Đạt's approved dataset before running evaluation.")
    try:
        dataset = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise ValueError(f"Invalid JSON dataset {path}: {exc}") from exc
    dataset = _object(dataset, "dataset", ("benchmark_version", "cases"))
    _string(dataset["benchmark_version"], "benchmark_version")
    cases = dataset["cases"]
    if not isinstance(cases, list) or not cases:
        raise ValueError("cases must be a non-empty array")

    seen: set[str] = set()
    for index, raw_case in enumerate(cases):
        location = f"cases[{index}]"
        case = _object(raw_case, location, ("case_id", "group", "category", "query", "target_date", "expected", "notes"))
        case_id = _string(case["case_id"], f"{location}.case_id")
        if case_id in seen:
            raise ValueError(f"Duplicate case_id: {case_id}")
        seen.add(case_id)
        if _string(case["group"], f"{location}.group") not in _GROUPS:
            raise ValueError(f"{location}.group must be one of {sorted(_GROUPS)}")
        _string(case["category"], f"{location}.category")
        _string(case["query"], f"{location}.query")
        _string(case["notes"], f"{location}.notes", allow_empty=True)
        target_date = case["target_date"]
        if target_date is not None:
            if not isinstance(target_date, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", target_date):
                raise ValueError(f"{location}.target_date must be null or YYYY-MM-DD")
            try:
                date.fromisoformat(target_date)
            except ValueError as exc:
                raise ValueError(f"{location}.target_date is not a real date") from exc

        expected = _object(
            case["expected"],
            f"{location}.expected",
            ("behavior", "supporting_document_ids", "forbidden_document_ids", "required_facts", "policy_version"),
        )
        if _string(expected["behavior"], f"{location}.expected.behavior") not in _BEHAVIORS:
            raise ValueError(f"{location}.expected.behavior must be one of {sorted(_BEHAVIORS)}")
        supporting = _string_ids(expected["supporting_document_ids"], f"{location}.expected.supporting_document_ids")
        forbidden = _string_ids(expected["forbidden_document_ids"], f"{location}.expected.forbidden_document_ids")
        if set(supporting).intersection(forbidden):
            raise ValueError(f"{location} lists the same document as supporting and forbidden")
        facts = expected["required_facts"]
        if not isinstance(facts, list):
            raise ValueError(f"{location}.expected.required_facts must be an array")
        for fact_index, fact in enumerate(facts):
            _string(fact, f"{location}.expected.required_facts[{fact_index}]")
        policy = _object(
            expected["policy_version"],
            f"{location}.expected.policy_version",
            ("required_document_id", "forbidden_document_ids"),
        )
        required = policy["required_document_id"]
        if required is not None:
            _string(required, f"{location}.expected.policy_version.required_document_id")
        policy_forbidden = _string_ids(policy["forbidden_document_ids"], f"{location}.expected.policy_version.forbidden_document_ids")
        if required in policy_forbidden or required in forbidden:
            raise ValueError(f"{location} marks the required policy version as forbidden")
    return dataset


def validate_gate3_benchmark_composition(dataset: Mapping[str, Any]) -> dict[str, int]:
    """Require the approved 30/15/5 composition for production runs only."""
    expected = {"on_topic": 30, "negative": 15, "edge": 5}
    actual = {group: sum(case["group"] == group for case in dataset["cases"]) for group in expected}
    total = len(dataset["cases"])
    if total != 50 or actual != expected:
        counts = ", ".join(f"{group}={actual[group]} (expected {count})" for group, count in expected.items())
        raise ValueError(f"Gate 3 benchmark composition invalid: total={total} (expected 50); {counts}")
    return {"total": total, **actual}


def load_corpus_by_id(path: Path = CORPUS_PATH) -> dict[str, dict[str, Any]]:
    if not path.is_file():
        raise FileNotFoundError(f"Knowledge corpus is missing: {path}")
    records = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(records, list) or not records:
        raise ValueError(f"Knowledge corpus must be a non-empty array: {path}")
    by_id: dict[str, dict[str, Any]] = {}
    for record in records:
        if not isinstance(record, dict) or not isinstance(record.get("document_id"), str):
            raise ValueError("Knowledge corpus contains a record without document_id")
        document_id = record["document_id"]
        if document_id in by_id:
            raise ValueError(f"Knowledge corpus has duplicate document_id: {document_id}")
        by_id[document_id] = record
    return by_id


def validate_ground_truth(dataset: Mapping[str, Any], corpus_by_id: Mapping[str, Any]) -> None:
    known = set(corpus_by_id)
    for case in dataset["cases"]:
        expected = case["expected"]
        policy = expected["policy_version"]
        referenced = set(expected["supporting_document_ids"] + expected["forbidden_document_ids"] + policy["forbidden_document_ids"])
        if policy["required_document_id"] is not None:
            referenced.add(policy["required_document_id"])
        unknown = referenced - known
        if unknown:
            raise ValueError(f"case_id={case['case_id']} references documents absent from corpus: {', '.join(sorted(unknown))}")


def select_cases(dataset: Mapping[str, Any], case_ids: Sequence[str] = (), groups: Sequence[str] = ()) -> list[dict[str, Any]]:
    unknown = set(case_ids) - {case["case_id"] for case in dataset["cases"]}
    if unknown:
        raise ValueError(f"Unknown case_id: {', '.join(sorted(unknown))}")
    selected = [
        case for case in dataset["cases"]
        if (not case_ids or case["case_id"] in case_ids) and (not groups or case["group"] in groups)
    ]
    if not selected:
        raise ValueError("No benchmark cases match the requested selection")
    return selected


def ensure_index_ready(retriever: Any, corpus_path: Path = CORPUS_PATH) -> dict[str, Any]:
    """Reuse an exact index, or initialize an empty one without clearing data."""
    from src.config import get_settings
    from src.knowledge.chunking import load_and_chunk_corpus
    from src.knowledge.vector_store import InMemoryVectorStore

    settings = get_settings()
    store = retriever.vector_store
    if settings.vector_store_type == "chroma" and isinstance(store, InMemoryVectorStore):
        raise RuntimeError("Chroma initialization fell back to memory; benchmark configuration is not the requested store.")
    expected_chunks = load_and_chunk_corpus(corpus_path)
    expected_by_id = {chunk.chunk_id: chunk for chunk in expected_chunks}
    if len(expected_by_id) != len(expected_chunks):
        raise RuntimeError("Corpus chunk IDs are not unique")

    def check_index() -> tuple[int, list[str]]:
        count = store.count()
        mismatches = []
        for chunk_id, expected in expected_by_id.items():
            actual = store.get_by_id(chunk_id)
            if actual is None or actual.model_dump(mode="json") != expected.model_dump(mode="json"):
                mismatches.append(chunk_id)
        return count, mismatches

    before_count = store.count()
    if before_count:
        after_count, mismatches = check_index()
        if after_count != len(expected_chunks) or mismatches:
            raise RuntimeError(
                f"Existing index does not match corpus: {after_count} stored vs {len(expected_chunks)} expected chunks; "
                f"{len(mismatches)} missing/mismatched. No ingest, reset, delete, or repair was performed."
            )
        index_action = "reused_existing_index"
        embedding_provenance = "unverified_for_existing_index"
    else:
        ingested = retriever.ingest_corpus(str(corpus_path))
        after_count, mismatches = check_index()
        if ingested != len(expected_chunks) or after_count != len(expected_chunks) or mismatches:
            raise RuntimeError(
                f"Index verification failed after initializing empty index: ingested={ingested}, stored={after_count}, "
                f"expected={len(expected_chunks)}, mismatched={len(mismatches)}. No reset was performed."
            )
        index_action = "initialized_empty_index"
        embedding_provenance = "initialized_by_current_embedding_service"
    return {
        "corpus_sha256": hashlib.sha256(corpus_path.read_bytes()).hexdigest(),
        "indexed_chunks": after_count,
        "index_action": index_action,
        "vector_store": store.__class__.__name__,
        "configured_vector_store_type": settings.vector_store_type,
        "embedding_service": retriever.embedding_service.model_name,
        "embedding_provenance": embedding_provenance,
        "app_env": settings.app_env,
        "llm_provider": settings.llm_provider,
        "model_name": settings.model_name,
    }


def json_ready(value: Any) -> Any:
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    if hasattr(value, "model_dump"):
        return json_ready(value.model_dump(mode="json"))
    if isinstance(value, Mapping):
        return {str(key): json_ready(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [json_ready(item) for item in value]
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    raise TypeError(f"Cannot serialize value of type {type(value).__name__}")


async def run_cases(
    cases: Sequence[dict[str, Any]],
    observe: Callable[[dict[str, Any]], dict[str, Any] | Awaitable[dict[str, Any]]],
    score_case: Callable[[dict[str, Any], dict[str, Any]], dict[str, dict[str, Any]]],
    *,
    repeat: int = 1,
) -> list[dict[str, Any]]:
    if repeat < 1:
        raise ValueError("repeat must be positive")
    results = []
    for case in cases:
        for run_index in range(1, repeat + 1):
            try:
                observation = observe(case)
                if inspect.isawaitable(observation):
                    observation = await observation
                actual = json_ready(observation)
                if not isinstance(actual, dict):
                    raise TypeError("Runtime observation must be an object")
            except Exception as exc:
                actual = {"error_type": type(exc).__name__, "error": str(exc)}
                metrics = {"runtime_execution": metric_result(score=0.0, applicable=True, passed=False, reason=f"Runtime call failed: {type(exc).__name__}: {exc}")}
            else:
                try:
                    metrics = score_case(case, actual)
                except Exception as exc:
                    metrics = {"evaluation_execution": metric_result(score=0.0, applicable=True, passed=False, reason=f"Metric calculation failed: {type(exc).__name__}: {exc}")}
            results.append({
                "case_id": case["case_id"],
                "run_index": run_index,
                "group": case["group"],
                "category": case["category"],
                "query": case["query"],
                "target_date": case["target_date"],
                "expected": case["expected"],
                "actual": actual,
                "metrics": metrics,
                "passed": all(metric["status"] in {"pass", "not_applicable"} for metric in metrics.values()),
            })
    return results


def build_parser(description: str, *, allow_top_k: bool = False) -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=description)
    parser.add_argument("--dataset", type=Path, default=DEFAULT_DATASET)
    parser.add_argument("--case-id", action="append", default=[], help="Select a case; repeat to select several")
    parser.add_argument("--group", action="append", choices=sorted(_GROUPS), default=[])
    parser.add_argument("--repeat", type=int, default=1)
    if allow_top_k:
        parser.add_argument("--top-k", type=int, default=4)
    return parser


@contextmanager
def _report_lock(reports_dir: Path):
    """Serialize component updates; the temporary lock is removed on exit."""
    lock_path = reports_dir / ".gate3_reports.lock"
    deadline = time.monotonic() + 30
    while True:
        try:
            descriptor = os.open(lock_path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
            break
        except FileExistsError:
            if time.monotonic() >= deadline:
                raise RuntimeError(f"Timed out waiting for report lock: {lock_path}") from None
            time.sleep(0.1)
    try:
        os.close(descriptor)
        yield
    finally:
        lock_path.unlink(missing_ok=True)


def _read_report(path: Path, benchmark_version: str) -> dict[str, Any]:
    if not path.exists():
        return {"schema_version": "gate3-eval-v1", "benchmark_version": benchmark_version, "components": {}}
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict) or data.get("benchmark_version") != benchmark_version or not isinstance(data.get("components"), dict):
        raise ValueError(f"Existing report is incompatible with benchmark version {benchmark_version}: {path}")
    return data


def _write_json_atomic(path: Path, data: Mapping[str, Any]) -> None:
    temporary: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=path.parent, prefix=".gate3_", suffix=".tmp", delete=False) as handle:
            temporary = Path(handle.name)
            json.dump(json_ready(data), handle, ensure_ascii=False, indent=2, allow_nan=False)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def write_component_reports(
    *,
    component: str,
    benchmark_version: str,
    per_case_results: Sequence[dict[str, Any]],
    execution_config: Mapping[str, Any],
    reports_dir: Path = DEFAULT_REPORTS_DIR,
) -> tuple[Path, Path]:
    if component not in {"copilot", "retrieval"}:
        raise ValueError(f"Unsupported Gate 3 component: {component}")
    reports_dir.mkdir(parents=True, exist_ok=True)
    results_path = reports_dir / "gate3_results.json"
    failed_path = reports_dir / "gate3_failed_cases.json"
    timestamp = datetime.now(timezone.utc).isoformat()
    failed = []
    for case in per_case_results:
        failures = {name: metric["reason"] for name, metric in case["metrics"].items() if metric["status"] in {"fail", "not_observable"}}
        if failures:
            failed.append({
                "case_id": case["case_id"],
                "run_index": case["run_index"],
                "query": case["query"],
                "expected": case["expected"],
                "actual": case["actual"],
                "retrieved_document_ids": case["actual"].get("retrieved_document_ids", []),
                "citations": case["actual"].get("citations", []),
                "failed_metrics": failures,
                "reason": "; ".join(failures.values()),
            })

    with _report_lock(reports_dir):
        results_report = _read_report(results_path, benchmark_version)
        failed_report = _read_report(failed_path, benchmark_version)
        results_report["timestamp"] = timestamp
        failed_report["timestamp"] = timestamp
        results_report["components"][component] = {
            "runner": component,
            "timestamp": timestamp,
            "number_of_cases": len(per_case_results),
            "unique_cases": len({case["case_id"] for case in per_case_results}),
            "aggregate_metrics": aggregate_metrics(per_case_results),
            "per_case_results": list(per_case_results),
            "execution_config": dict(execution_config),
        }
        failed_report["components"][component] = {"runner": component, "timestamp": timestamp, "number_of_cases": len(failed), "cases": failed}
        _write_json_atomic(results_path, results_report)
        _write_json_atomic(failed_path, failed_report)
    return results_path, failed_path
