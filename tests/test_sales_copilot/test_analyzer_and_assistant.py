"""Offline service contracts with isolated storage and mocked model responses."""

import json
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from src.config import get_settings
from src.integrations.sales_copilot_repository import SQLSalesCopilotRepository
from src.models.sales_copilot import SalesPreferences
from src.services.sales_copilot_analyzer import SalesCopilotAnalyzer
from src.services.sales_copilot_assistant import SalesCopilotAssistant


@pytest.fixture
def conversation(tmp_path):
    repo = SQLSalesCopilotRepository(f"sqlite:///{tmp_path / 'services.db'}")
    customer = repo.create_customer(name="Service test", advisor_id="test_advisor")
    conversation_id = repo.get_or_create_conversation(customer)
    message = repo.add_message(conversation_id, "customer", "Please send a quote and arrange a test drive.")
    yield repo, customer, conversation_id, message
    repo.engine.dispose()


@pytest.mark.asyncio
async def test_analyzer_on_demand(conversation, monkeypatch):
    repo, customer_id, conv_id, message = conversation
    monkeypatch.setattr(get_settings(), "sales_ai_task_rules", "send_quote,schedule_test_drive")
    output = {
        "profile": {"interested_models": ["VF 3"], "budget_vnd": 300000000},
        "memory": {"quick_summary": "Customer requests a quote and test drive.", "timeline": [
            {"title": "Quote", "description": "Requested quote", "source_message_id": message.id},
            {"title": "Drive", "description": "Requested test drive", "source_message_id": message.id},
        ]},
        "tasks": [
            {"task_type": "send_quote", "title": "Send requested quote", "source_message_ids": [message.id]},
            {"task_type": "schedule_test_drive", "title": "Arrange test drive", "source_message_ids": [message.id]},
        ],
        "lead_status": {"stage": "considering", "score": 65},
    }
    model = SimpleNamespace(ainvoke=AsyncMock(return_value=SimpleNamespace(content=json.dumps(output))))
    monkeypatch.setattr("src.services.sales_copilot_analyzer.get_llm", lambda **_: model)
    result = await SalesCopilotAnalyzer(repo).analyze_conversation(conv_id, "test_advisor")
    model.ainvoke.assert_awaited_once()
    assert message.id in model.ainvoke.call_args.args[0][-1]["content"]
    assert result["status"] == "success"
    assert result["profile"]["interested_models"] == ["VF 3"]
    assert repo.get_customer_snapshot(customer_id)["budget_vnd"] == 300000000
    assert repo.get_memory(conv_id)["analyzed_through_seq"] == message.seq
    assert len(result["memory"]["timeline"]) == 2
    assert {task["task_type"] for task in result["tasks"]} == {"send_quote", "schedule_test_drive"}
    assert all(task["status"] == "needs_review" and task["source_message_ids"] == [message.id] for task in result["tasks"])
    assert result["lead_status"]["score"] == 65
    assert result["lead_status"]["stage"] == "considering"


@pytest.mark.asyncio
async def test_assistant_nba_and_draft_toggles(conversation, monkeypatch):
    repo, _, conv_id, message = conversation
    outputs = [
        {"actions": [{"action_type": "schedule_test_drive", "title": "Confirm test drive", "reason": "Customer request", "source_message_ids": [message.id]}]},
        {"text": "Please confirm a convenient time for your requested test drive.", "sources": []},
    ]
    model = SimpleNamespace(ainvoke=AsyncMock(side_effect=[SimpleNamespace(content=json.dumps(item)) for item in outputs]))
    monkeypatch.setattr("src.services.sales_copilot_assistant.get_llm", lambda **_: model)
    retrieve = SimpleNamespace(retrieve=lambda *args, **kwargs: [])
    monkeypatch.setattr("src.services.sales_copilot_assistant.get_retrieval_service", lambda: retrieve)
    assistant = SalesCopilotAssistant(repo)
    repo.update_preferences(SalesPreferences(advisor_id="test_advisor", nba_enabled=False, draft_enabled=False))
    assert (await assistant.generate_next_best_actions(conv_id, "test_advisor")).actions == []
    assert (await assistant.generate_message_draft(conv_id, "test_advisor")).status == "discarded"
    model.ainvoke.assert_not_awaited()
    repo.update_preferences(SalesPreferences(advisor_id="test_advisor", nba_enabled=True, draft_enabled=True))
    nba = await assistant.generate_next_best_actions(conv_id, "test_advisor")
    draft = await assistant.generate_message_draft(conv_id, "test_advisor")
    assert model.ainvoke.await_count == 2
    assert nba.actions[0].source_message_ids == [message.id]
    assert draft.text == outputs[1]["text"]
    assert draft.status == "generated"
    assert draft.based_on_message_seq == message.seq
    assert repo.get_latest_recommendation(conv_id, "draft")["text"] == draft.text
