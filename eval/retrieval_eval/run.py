"""Run document-level retrieval metrics against the real retrieval service.

From the repository root: python -m eval.retrieval_eval.run
"""

from __future__ import annotations

import asyncio
from datetime import date
from typing import Any

from eval.metrics import policy_version_correctness, recall_at_k, retrieval_hit_rate
from eval.runner import (
    build_parser,
    ensure_index_ready,
    load_corpus_by_id,
    load_dataset,
    run_cases,
    select_cases,
    validate_gate3_benchmark_composition,
    validate_ground_truth,
    write_component_reports,
)


def has_retrieval_expectation(case: dict[str, Any]) -> bool:
    expected = case["expected"]
    policy = expected["policy_version"]
    return bool(expected["supporting_document_ids"] or policy["required_document_id"] or policy["forbidden_document_ids"])


async def execute(args: Any) -> tuple[str, str, int]:
    dataset = load_dataset(args.dataset)
    validate_gate3_benchmark_composition(dataset)
    corpus_by_id = load_corpus_by_id()
    validate_ground_truth(dataset, corpus_by_id)
    selected = select_cases(dataset, args.case_id, args.group)
    cases = [case for case in selected if has_retrieval_expectation(case)]
    if not cases:
        raise ValueError("Selected cases have no supporting-document or policy-version retrieval expectation")
    if args.repeat < 1 or args.top_k < 1:
        raise ValueError("--repeat and --top-k must be positive")

    from src.agents.copilot.intent_router import extract_models
    from src.knowledge.retrieval_service import get_retrieval_service

    retriever = get_retrieval_service()
    index_config = ensure_index_ready(retriever)

    def observe(case: dict[str, Any]) -> dict[str, Any]:
        product_model, _competitor_model = extract_models(case["query"])
        target_date = date.fromisoformat(case["target_date"]) if case["target_date"] else None
        chunks = retriever.retrieve(
            query=case["query"],
            product_model=product_model,
            target_date=target_date,
            top_k=args.top_k,
        )
        return {
            "product_model_filter": product_model,
            "retrieved_document_ids": [chunk.document_id for chunk in chunks],
            "retrieved": [
                {
                    "chunk_id": chunk.chunk_id,
                    "document_id": chunk.document_id,
                    "metadata": chunk.metadata.model_dump(mode="json"),
                }
                for chunk in chunks
            ],
        }

    def score_case(case: dict[str, Any], actual: dict[str, Any]) -> dict[str, dict[str, Any]]:
        document_ids = actual["retrieved_document_ids"]
        return {
            "retrieval_hit_rate": retrieval_hit_rate(case["expected"], document_ids),
            "recall_at_k": recall_at_k(case["expected"], document_ids, k=args.top_k),
            "policy_version_correctness": policy_version_correctness(case["expected"], document_ids, source="retrieval"),
        }

    results = await run_cases(cases, observe, score_case, repeat=args.repeat)
    config = {
        **index_config,
        "retrieval_interface": "src.knowledge.retrieval_service.get_retrieval_service().retrieve",
        "top_k": args.top_k,
        "repeat": args.repeat,
        "selected_groups": args.group,
        "selected_cases_without_retrieval_expectation": len(selected) - len(cases),
    }
    result_path, failed_path = write_component_reports(
        component="retrieval",
        benchmark_version=dataset["benchmark_version"],
        per_case_results=results,
        execution_config=config,
    )
    return str(result_path), str(failed_path), sum(not result["passed"] for result in results)


def main() -> int:
    parser = build_parser("Run Gate 3 retrieval evaluation against the real retrieval service", allow_top_k=True)
    args = parser.parse_args()
    try:
        result_path, failed_path, failure_count = asyncio.run(execute(args))
    except (FileNotFoundError, ValueError, RuntimeError) as exc:
        parser.exit(2, f"Gate 3 retrieval evaluation stopped: {exc}\n")
    print(f"Retrieval results: {result_path}")
    print(f"Failed cases: {failed_path}")
    print(f"Failed runs: {failure_count}")
    return 1 if failure_count else 0


if __name__ == "__main__":
    raise SystemExit(main())
