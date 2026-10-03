"""Optional sales suggestions must not change the grounded answer contract."""

import json
from types import SimpleNamespace

import pytest
from pydantic import ValidationError

from src.agents.copilot import nodes
from src.agents.copilot.prompts import COPILOT_SYSTEM_PROMPT, format_user_prompt
from src.agents.copilot.state import ABSTAIN_ANSWER, CopilotResponse, GeneratedAnswer
from src.api.copilot import CopilotQueryRequest, query_copilot


def test_old_answer_payload_without_suggestions_still_valid():
    parsed = GeneratedAnswer(status="answered", answer="Giá niêm yết nằm trong bảng giá [C1].", citation_ids=["C1"])

    assert parsed.talking_points == []
    assert parsed.suggested_message is None
    assert parsed.suggested_next_question is None


def test_abstention_cannot_expose_sales_suggestions():
    with pytest.raises(ValidationError, match="sales suggestions"):
        CopilotResponse(
            status="abstained",
            answer=ABSTAIN_ANSWER,
            citations=[],
            suggested_message="Em cam kết giá tốt nhất.",
        )
    with pytest.raises(ValidationError, match="sales suggestions"):
        GeneratedAnswer(
            status="abstained",
            answer=ABSTAIN_ANSWER,
            citation_ids=[],
            talking_points=["Giá rất tốt."],
        )


def test_suggestion_count_and_size_are_bounded():
    with pytest.raises(ValidationError):
        GeneratedAnswer(
            status="answered", answer="Nguồn [C1].", citation_ids=["C1"], talking_points=["A", "B", "C", "D"]
        )
    with pytest.raises(ValidationError):
        GeneratedAnswer(status="answered", answer="Nguồn [C1].", citation_ids=["C1"], suggested_message="x" * 501)


def test_prompt_requests_optional_source_bound_suggestions():
    prompt = format_user_prompt("Giá VF 8?", "[C1] Bảng giá", "2026-10-03")

    assert "talking_points" in prompt
    assert "suggested_message" in prompt
    assert "suggested_next_question" in prompt
    assert "không bổ sung số liệu" in COPILOT_SYSTEM_PROMPT


@pytest.mark.asyncio
async def test_generation_exposes_only_source_bound_talking_points(monkeypatch):
    answer_line = "Giá tham khảo nằm trong bảng giá [C1]."
    model_output = {
        "status": "answered",
        "answer": answer_line,
        "citation_ids": ["C1"],
        "talking_points": [answer_line, "Cam kết giảm giá chưa có trong câu trả lời [C1]."],
        "suggested_message": "Em có thể gửi anh/chị tài liệu chính thức để đối chiếu.",
        "suggested_next_question": "Anh/chị muốn xem thêm điều kiện áp dụng không?",
    }

    class FakeModel:
        async def ainvoke(self, messages):
            return SimpleNamespace(content=json.dumps(model_output, ensure_ascii=False))

    monkeypatch.setattr(nodes, "get_llm", lambda: FakeModel())
    monkeypatch.setattr(nodes, "get_settings", lambda: SimpleNamespace(llm_timeout_seconds=5))
    evidence = {
        "chunk_id": "price-1",
        "document_id": "price-list",
        "content": "Giá tham khảo nằm trong bảng giá.",
        "title": "Bảng giá",
        "section": None,
        "page": None,
        "source_uri": "https://example.com/price.pdf",
        "effective_from": "2026-10-01",
        "effective_to": None,
        "status": "active",
        "version": "1",
        "product_model": "VF 8",
        "retrieval_method": "bm25",
        "native_score": 5.0,
        "rank": 1,
        "dense_score": None,
        "bm25_score": 5.0,
        "rrf_score": 0.016,
    }
    state = {"query": "Giá VF 8?", "selected_evidence": [evidence]}

    generated = await nodes.generate_node(state)
    assert generated["validation_error"] is None
    result = generated["draft_response"]
    assert result.talking_points == [answer_line]
    assert result.suggested_message == model_output["suggested_message"]
    assert result.suggested_next_question == model_output["suggested_next_question"]
    validated = await nodes.validate_response_node({**state, **generated})
    assert validated["validation_status"] == "valid"
    assert validated["final_response"].talking_points == [answer_line]


def test_quantified_sales_suggestion_is_dropped_without_affecting_answer():
    parsed = GeneratedAnswer(
        status="answered",
        answer="Thông tin trong nguồn [C1].",
        citation_ids=["C1"],
        suggested_message="Em cam kết giảm 20 triệu.",
        suggested_next_question="Anh muốn mua ở mức 500 triệu?",
    )

    points, message, question = nodes._safe_suggestions(parsed, {"C1"})
    assert points == []
    assert message is None
    assert question is None

    parsed.suggested_message = "Em cam kết pin miễn phí."
    _, message, _ = nodes._safe_suggestions(parsed, {"C1"})
    assert message is None


@pytest.mark.asyncio
async def test_copilot_api_returns_suggestions_without_changing_existing_fields(monkeypatch):
    async def fake_graph(state):
        return {
            "final_response": CopilotResponse(
                status="answered",
                answer="Bảng giá có thông tin VF 8 [C1].",
                citations=[
                    {
                        "citation_id": "C1",
                        "chunk_id": "price-1",
                        "document_id": "price-list",
                        "title": "Bảng giá",
                    }
                ],
                talking_points=["Bảng giá có thông tin VF 8 [C1]."],
                suggested_message="Em có thể gửi anh/chị bảng giá để đối chiếu.",
                suggested_next_question="Anh/chị muốn xem phiên bản nào?",
            )
        }

    monkeypatch.setattr("src.api.copilot.copilot_agent.ainvoke", fake_graph)
    response = await query_copilot(CopilotQueryRequest(query="Giá VF 8?"))

    assert response.answer == "Bảng giá có thông tin VF 8 [C1]."
    assert response.citations[0].document_id == "price-list"
    assert response.is_abstain is False
    assert response.talking_points == ["Bảng giá có thông tin VF 8 [C1]."]
    assert response.suggested_message == "Em có thể gửi anh/chị bảng giá để đối chiếu."
    assert response.suggested_next_question == "Anh/chị muốn xem phiên bản nào?"
