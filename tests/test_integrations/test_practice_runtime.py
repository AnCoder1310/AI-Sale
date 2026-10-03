import json
from pathlib import Path
from typing import Any

import pytest
from langchain_core.messages import HumanMessage, SystemMessage

from src.agents.roleplay.customer_agent import CustomerModelOutput
from src.agents.roleplay.evaluator import EvaluationDraft
from src.agents.roleplay.prompts import TURN_ANALYZER_PROMPT_VERSION
from src.agents.roleplay.scenario_loader import ScenarioRepository
from src.agents.roleplay.state import RoleplayState
from src.agents.roleplay.turn_analyzer import TurnAnalysis
from src.integrations.practice_runtime import (
    SharedLLMCustomerModel,
    SharedLLMEvaluationModel,
    SharedLLMTurnAnalysisModel,
    StructuredModelInvocationError,
)

SCENARIOS = Path("data/scenarios/scenarios.json")


class FakeStructuredRunnable:
    def __init__(self, owner: "FakeChatModel") -> None:
        self.owner = owner

    async def ainvoke(self, messages):
        self.owner.messages = messages
        if isinstance(self.owner.output, Exception):
            raise self.owner.output
        return self.owner.output


class FakeChatModel:
    def __init__(self, output: Any) -> None:
        self.output = output
        self.schema = None
        self.messages = None

    def with_structured_output(self, schema):
        self.schema = schema
        return FakeStructuredRunnable(self)


def scenario_and_state():
    scenario = ScenarioRepository(SCENARIOS).get("SCENARIO_01_VF5_TAXI")
    return scenario, RoleplayState.from_scenario("session-1", scenario)


@pytest.mark.asyncio
async def test_customer_adapter_uses_shared_structured_output_boundary():
    model = FakeChatModel({"reply": "Anh đang quan tâm chi phí sử dụng xe."})
    adapter = SharedLLMCustomerModel(lambda: model)

    result = await adapter.generate(
        system_prompt="customer-system",
        context={"scenario_id": "scenario-1", "messages": []},
    )

    assert result == CustomerModelOutput(reply="Anh đang quan tâm chi phí sử dụng xe.")
    assert model.schema is CustomerModelOutput
    assert isinstance(model.messages[0], SystemMessage)
    assert isinstance(model.messages[1], HumanMessage)
    assert json.loads(model.messages[1].content.removeprefix("CONTEXT_JSON:\n")) == {
        "messages": [],
        "scenario_id": "scenario-1",
    }


@pytest.mark.asyncio
async def test_turn_analysis_adapter_excludes_hidden_fact_values():
    scenario, state = scenario_and_state()
    model = FakeChatModel(
        {
            "detected_intents": [scenario.disclosure_rules[0].trigger_intent],
            "discovered_fact_ids": [scenario.disclosure_rules[0].fact_key],
            "current_topic": "nhu cầu sử dụng",
        }
    )
    adapter = SharedLLMTurnAnalysisModel(lambda: model)

    result = await adapter.analyze("Mỗi ngày anh đi khoảng bao nhiêu km?", scenario, state)

    assert isinstance(result, TurnAnalysis)
    assert model.schema is TurnAnalysis
    context_text = model.messages[1].content
    context = json.loads(context_text.removeprefix("CONTEXT_JSON:\n"))
    assert context["prompt_version"] == TURN_ANALYZER_PROMPT_VERSION
    assert context["advisor_message"] == "Mỗi ngày anh đi khoảng bao nhiêu km?"
    assert "hidden_facts" not in context["scenario"]
    assert all(value not in context_text for value in scenario.hidden_facts.values())


@pytest.mark.asyncio
async def test_evaluation_adapter_validates_draft_schema():
    criteria = [
        "need_discovery",
        "product_knowledge",
        "objection_handling",
        "policy_accuracy",
        "closing_next_step",
    ]
    model = FakeChatModel(
        {
            "evaluations": [
                {
                    "criterion": criterion,
                    "status": "not_observed",
                    "score": None,
                    "reason": "Chưa có cơ hội quan sát trong transcript.",
                }
                for criterion in criteria
            ]
        }
    )
    adapter = SharedLLMEvaluationModel(lambda: model)

    result = await adapter.evaluate(system_prompt="evaluator-system", context={"transcript": []})

    assert isinstance(result, EvaluationDraft)
    assert model.schema is EvaluationDraft
    assert len(result.evaluations) == 5


@pytest.mark.asyncio
async def test_evaluation_adapter_retries_once_after_malformed_output():
    class RetryModel(FakeChatModel):
        def __init__(self):
            super().__init__(None)
            self.calls = 0

        def with_structured_output(self, schema):
            self.schema = schema
            owner = self

            class Runnable:
                async def ainvoke(self, messages):
                    owner.calls += 1
                    if owner.calls == 1:
                        return {"unexpected": "field"}
                    return {
                        "evaluations": [
                            {"criterion": criterion, "status": "not_observed", "reason": "No opportunity."}
                            for criterion in (
                                "need_discovery",
                                "product_knowledge",
                                "objection_handling",
                                "policy_accuracy",
                                "closing_next_step",
                            )
                        ]
                    }

            return Runnable()

    model = RetryModel()
    result = await SharedLLMEvaluationModel(lambda: model).evaluate(system_prompt="judge", context={"transcript": []})

    assert isinstance(result, EvaluationDraft)
    assert model.calls == 2


@pytest.mark.asyncio
async def test_adapter_surfaces_provider_failure_without_fallback():
    model = FakeChatModel(TimeoutError("provider timed out"))
    adapter = SharedLLMCustomerModel(lambda: model)

    with pytest.raises(StructuredModelInvocationError) as exc_info:
        await adapter.generate(system_prompt="customer-system", context={"messages": []})

    assert isinstance(exc_info.value.__cause__, TimeoutError)
    assert "CustomerModelOutput" in str(exc_info.value)


@pytest.mark.asyncio
async def test_adapter_rejects_malformed_structured_output():
    model = FakeChatModel({"unexpected": "field"})
    adapter = SharedLLMCustomerModel(lambda: model)

    with pytest.raises(StructuredModelInvocationError):
        await adapter.generate(system_prompt="customer-system", context={"messages": []})
