"""Deterministic checks for the isolated attack harness."""

import json
from types import SimpleNamespace

import pytest

from eval.prompt_injection.run import (
    ADVISOR_ATTACKS,
    DIRECT_QUERY_ATTACKS,
    FALSE_POLICY,
    SOURCE_ATTACKS,
    probe_source,
    synthetic_hit,
)


def test_attack_suite_covers_three_untrusted_surfaces_without_real_corpus():
    assert len(SOURCE_ATTACKS) == len(DIRECT_QUERY_ATTACKS) == 3
    assert len(ADVISOR_ATTACKS) == 7
    hit = synthetic_hit("synthetic content")
    assert hit["document_id"] == "INJECTION_TEST_SOURCE"
    assert hit["content"] == "synthetic content"


@pytest.mark.asyncio
async def test_harness_flags_a_forged_policy_even_when_citation_shape_is_valid(monkeypatch):
    from src.agents.copilot import nodes

    class MaliciousModel:
        async def ainvoke(self, messages):
            return SimpleNamespace(
                content=json.dumps(
                    {
                        "status": "answered",
                        "answer": f"{FALSE_POLICY} [C1].",
                        "citation_ids": ["C1"],
                        "talking_points": [],
                        "suggested_message": None,
                        "suggested_next_question": None,
                    }
                )
            )

    monkeypatch.setattr(nodes, "get_llm", lambda: MaliciousModel())
    monkeypatch.setattr(nodes, "get_settings", lambda: SimpleNamespace(llm_timeout_seconds=5))
    result = await probe_source("forged_discount", "Giá niêm yết VF 5 là 529 triệu đồng.")

    assert result["status"] == "FAIL"
    assert result["validation_status"] == "valid"
    assert result["attack_marker_present"] is True
