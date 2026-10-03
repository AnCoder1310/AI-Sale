"""Safe model boundary for generating an AI Customer turn."""

from __future__ import annotations

from typing import Any, Literal, Protocol

from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator

from .contracts import ScenarioContract
from .prompts import CUSTOMER_PROMPT_VERSION, CUSTOMER_SYSTEM_PROMPT
from .state import RoleplayMessage, RoleplayState

CustomerTurnMode = Literal["opening", "response"]


class CustomerModelOutput(BaseModel):
    """Strict structured output expected from the customer model."""

    model_config = ConfigDict(extra="forbid")

    reply: str = Field(min_length=1, max_length=800)

    @field_validator("reply")
    @classmethod
    def normalize_reply(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("reply must not be blank")
        return normalized


class CustomerTurnModel(Protocol):
    """Provider-independent structured-output model contract."""

    async def generate(
        self,
        *,
        system_prompt: str,
        context: dict[str, Any],
    ) -> CustomerModelOutput | dict[str, Any]: ...


class CustomerResponseError(ValueError):
    """Raised when a safe customer response cannot be produced."""


class CustomerAgent:
    """Build an allowlisted prompt context and validate the generated reply."""

    def __init__(self, model: CustomerTurnModel) -> None:
        self._model = model

    async def generate_reply(
        self,
        scenario: ScenarioContract,
        state: RoleplayState,
        *,
        mode: CustomerTurnMode,
    ) -> RoleplayMessage:
        if state.scenario_id != scenario.scenario_id:
            raise CustomerResponseError("state and scenario identifiers do not match")

        context = self._build_context(scenario, state, mode=mode)
        try:
            raw_output = await self._model.generate(
                system_prompt=CUSTOMER_SYSTEM_PROMPT,
                context=context,
            )
            output = CustomerModelOutput.model_validate(raw_output)
        except (ValidationError, TypeError, ValueError) as exc:
            raise CustomerResponseError(f"invalid customer response: {exc}") from exc

        self._reject_private_fact_leak(output.reply, scenario, state)
        return RoleplayMessage(role="customer", content=output.reply)

    @staticmethod
    def _build_context(
        scenario: ScenarioContract,
        state: RoleplayState,
        *,
        mode: CustomerTurnMode,
    ) -> dict[str, Any]:
        context = state.customer_prompt_context()
        active_ids = set(state.active_objections)
        context.update(
            {
                "prompt_version": CUSTOMER_PROMPT_VERSION,
                "turn_mode": mode,
                "sales_channel": state.sales_channel,
                "active_objections": [
                    {
                        "objection_id": objection.objection_id,
                        "objection_text": objection.objection_text,
                    }
                    for objection in scenario.objections
                    if objection.objection_id in active_ids
                ],
                "revealed_statements": [
                    {
                        "fact_key": rule.fact_key,
                        "statement": rule.revealed_statement,
                    }
                    for rule in scenario.disclosure_rules
                    if rule.fact_key in state.revealed_facts
                ],
            }
        )
        return context

    @staticmethod
    def _reject_private_fact_leak(
        reply: str,
        scenario: ScenarioContract,
        state: RoleplayState,
    ) -> None:
        normalized_reply = reply.casefold()
        revealed_ids = set(state.revealed_facts)
        leaked_fact_ids = [
            fact_id
            for fact_id, fact_value in scenario.hidden_facts.items()
            if fact_id not in revealed_ids and fact_value.strip() and fact_value.casefold() in normalized_reply
        ]
        if leaked_fact_ids:
            raise CustomerResponseError(
                "customer response contains unrevealed private facts: " + ", ".join(sorted(leaked_fact_ids))
            )
