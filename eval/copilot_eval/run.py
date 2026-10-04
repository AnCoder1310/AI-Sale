"""Run the approved Gate 3 benchmark against the real Copilot graph.

From the repository root: python -m eval.copilot_eval.run
"""

from __future__ import annotations

import asyncio
from collections.abc import Mapping
from typing import Any

from eval.metrics import appropriate_behavior, citation_correctness, policy_version_correctness
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


async def execute(args: Any) -> tuple[str, str, int]:
    dataset = load_dataset(args.dataset)
    validate_gate3_benchmark_composition(dataset)
    corpus_by_id = load_corpus_by_id()
    validate_ground_truth(dataset, corpus_by_id)
    cases = select_cases(dataset, args.case_id, args.group)
    if args.repeat < 1:
        raise ValueError("--repeat must be positive")

    from src.knowledge.retrieval_service import get_retrieval_service

    retriever = get_retrieval_service()
    index_config = ensure_index_ready(retriever)

    from src.agents.copilot.graph import copilot_agent

    async def observe(case: dict[str, Any]) -> dict[str, Any]:
        state = await copilot_agent.ainvoke({"query": case["query"], "target_date": case["target_date"]})
        if not isinstance(state, Mapping):
            raise TypeError("Copilot graph did not return a state mapping")
        chunks = state.get("retrieved_chunks") or []
        if not isinstance(chunks, list):
            raise TypeError("Copilot retrieved_chunks is not a list")
        return {
            "answer": state.get("answer", ""),
            "citations": state.get("citations", []),
            "is_abstain": state.get("is_abstain"),
            "intent": state.get("intent"),
            "product_model": state.get("product_model"),
            "abstain_reason": state.get("abstain_reason"),
            "retrieved_document_ids": [chunk["document_id"] for chunk in chunks],
            "retrieved_chunk_ids": [chunk["chunk_id"] for chunk in chunks],
        }

    def score_case(case: dict[str, Any], actual: dict[str, Any]) -> dict[str, dict[str, Any]]:
        citations = actual["citations"]
        if not isinstance(citations, list):
            raise TypeError("Copilot citations is not a list")
        cited_ids = [item.get("document_id") for item in citations if isinstance(item, Mapping)]
        return {
            "citation_correctness": citation_correctness(case["expected"], citations, corpus_by_id),
            "policy_version_correctness": policy_version_correctness(case["expected"], cited_ids, source="citations"),
            "appropriate_behavior": appropriate_behavior(case["expected"], actual),
        }

    results = await run_cases(cases, observe, score_case, repeat=args.repeat)
    config = {**index_config, "graph": "src.agents.copilot.graph.copilot_agent", "top_k": 4, "repeat": args.repeat, "selected_groups": args.group}
    result_path, failed_path = write_component_reports(
        component="copilot",
        benchmark_version=dataset["benchmark_version"],
        per_case_results=results,
        execution_config=config,
    )
    return str(result_path), str(failed_path), sum(not result["passed"] for result in results)


def main() -> int:
    parser = build_parser("Run Gate 3 Copilot evaluation against the real LangGraph agent")
    args = parser.parse_args()
    try:
        result_path, failed_path, failure_count = asyncio.run(execute(args))
    except (FileNotFoundError, ValueError, RuntimeError) as exc:
        parser.exit(2, f"Gate 3 Copilot evaluation stopped: {exc}\n")
    print(f"Copilot results: {result_path}")
    print(f"Failed cases: {failed_path}")
    print(f"Failed/not-observable runs: {failure_count}")
    return 1 if failure_count else 0


if __name__ == "__main__":
    raise SystemExit(main())
