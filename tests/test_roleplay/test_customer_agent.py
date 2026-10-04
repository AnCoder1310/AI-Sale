from pathlib import Path

import pytest

from src.agents.roleplay.customer_agent import CustomerAgent, CustomerResponseError
from src.agents.roleplay.prompts import CUSTOMER_PROMPT_VERSION, CUSTOMER_SYSTEM_PROMPT
from src.agents.roleplay.scenario_loader import ScenarioRepository
from src.agents.roleplay.state import RoleplayState

SCENARIOS = Path("data/scenarios/scenarios.json")


class CapturingCustomerModel:
    def __init__(self, output):
        self.output = output
        self.calls = []

    async def generate(self, *, system_prompt, context):
        self.calls.append({"system_prompt": system_prompt, "context": context})
        return self.output


@pytest.fixture
def scenario():
    return ScenarioRepository(SCENARIOS).get("SCENARIO_01_VF5_TAXI")


@pytest.fixture
def state(scenario):
    return RoleplayState.from_scenario("session-1", scenario)


@pytest.mark.asyncio
async def test_customer_agent_uses_versioned_prompt_and_returns_customer_message(scenario, state):
    model = CapturingCustomerModel({"reply": "Anh muốn biết chi phí sử dụng thực tế thế nào."})
    agent = CustomerAgent(model)

    message = await agent.generate_reply(scenario, state, mode="opening")

    assert message.role == "customer"
    assert message.content == "Anh muốn biết chi phí sử dụng thực tế thế nào."
    assert model.calls[0]["system_prompt"] == CUSTOMER_SYSTEM_PROMPT
    assert model.calls[0]["context"]["prompt_version"] == CUSTOMER_PROMPT_VERSION
    assert model.calls[0]["context"]["turn_mode"] == "opening"


@pytest.mark.asyncio
async def test_customer_context_only_contains_revealed_facts_and_active_objections(scenario, state):
    state.revealed_facts = ["daily_distance"]
    state.spoken_fact_message_ids = {"daily_distance": "customer-2"}
    state.active_objections = ["OBJ_VF5_BATTERY_VS_GAS"]
    model = CapturingCustomerModel({"reply": "Vậy em thử tính theo quãng đường của anh xem."})
    agent = CustomerAgent(model)

    await agent.generate_reply(scenario, state, mode="response")

    context = model.calls[0]["context"]
    assert context["revealed_facts"] == {"daily_distance": scenario.hidden_facts["daily_distance"]}
    assert context["revealed_statements"] == [
        {
            "fact_key": "daily_distance",
            "statement": scenario.disclosure_rules[0].revealed_statement,
        }
    ]
    assert context["active_objections"] == [
        {
            "objection_id": "OBJ_VF5_BATTERY_VS_GAS",
            "objection_text": scenario.objections[0].objection_text,
        }
    ]
    assert scenario.hidden_facts["budget"] not in str(context)
    assert scenario.success_conditions not in str(context)
    assert scenario.expected_discovery not in str(context)


@pytest.mark.asyncio
async def test_customer_agent_rejects_extra_structured_output_fields(scenario, state):
    agent = CustomerAgent(
        CapturingCustomerModel(
            {
                "reply": "Anh vẫn đang cân nhắc.",
                "score": 5,
            }
        )
    )

    with pytest.raises(CustomerResponseError, match="invalid customer response"):
        await agent.generate_reply(scenario, state, mode="response")


@pytest.mark.asyncio
async def test_customer_agent_rejects_unrevealed_private_fact_in_output(scenario, state):
    private_fact = scenario.hidden_facts["budget"]
    agent = CustomerAgent(CapturingCustomerModel({"reply": private_fact}))

    with pytest.raises(CustomerResponseError, match="unrevealed private facts"):
        await agent.generate_reply(scenario, state, mode="response")


@pytest.mark.asyncio
async def test_customer_retries_a_mixed_language_reply_once(scenario, state):
    class MixedLanguageModel(CapturingCustomerModel):
        async def generate(self, *, system_prompt, context):
            self.calls.append({"system_prompt": system_prompt, "context": context})
            if len(self.calls) == 1:
                return {
                    "reply": "Mức góp đó là bình quân hay cố định? Could you show monthly installment separately from charging costs?"
                }
            return {
                "reply": "Mức góp đó là bình quân hay tháng nào cũng vậy? Em tách tiền góp và tiền sạc giúp anh nhé."
            }

    model = MixedLanguageModel(None)
    message = await CustomerAgent(model).generate_reply(scenario, state, mode="opening")

    assert (
        message.content == "Mức góp đó là bình quân hay tháng nào cũng vậy? Em tách tiền góp và tiền sạc giúp anh nhé."
    )
    assert len(model.calls) == 2
    assert "previous_mixed_language_reply" in model.calls[1]["context"]
    assert "# Correction" in model.calls[1]["system_prompt"]


@pytest.mark.asyncio
async def test_customer_does_not_publish_english_when_retry_still_fails(scenario, state):
    model = CapturingCustomerModel({"reply": "Could you show the monthly installment separately?"})

    with pytest.raises(CustomerResponseError, match="English prose"):
        await CustomerAgent(model).generate_reply(scenario, state, mode="opening")

    assert len(model.calls) == 2
