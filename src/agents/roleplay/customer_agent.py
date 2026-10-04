"""Safe model boundary for generating an AI Customer turn."""

from __future__ import annotations

from dataclasses import dataclass
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
    raised_objection_id: str | None = None
    accepted_next_step: bool = False

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


@dataclass(frozen=True)
class CustomerTurn:
    message: RoleplayMessage
    raised_objection_id: str | None = None
    accepted_next_step: bool = False


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
        return (await self.generate_turn(scenario, state, mode=mode)).message

    async def generate_turn(
        self,
        scenario: ScenarioContract,
        state: RoleplayState,
        *,
        mode: CustomerTurnMode,
        consider_next_step: bool = False,
    ) -> CustomerTurn:
        if state.scenario_id != scenario.scenario_id:
            raise CustomerResponseError("state and scenario identifiers do not match")

        pending = self.pending_disclosures(scenario, state) if mode == "response" else []
        if pending:
            reply = " ".join(rule.revealed_statement for rule in pending)
            return CustomerTurn(message=RoleplayMessage(role="customer", content=reply))

        if (
            mode == "response"
            and state.active_objections
            and self.focus_objection_id(state) is None
            and not consider_next_step
        ):
            return CustomerTurn(
                message=RoleplayMessage(
                    role="customer",
                    content="Anh vẫn chưa yên tâm về điểm này. Mình tạm dừng ở đây; em gửi thông tin phù hợp với trường hợp của anh sau nhé.",
                )
            )

        context = self._build_context(scenario, state, mode=mode)
        context["consider_next_step"] = consider_next_step
        if consider_next_step and self.focus_objection_id(state) is None:
            context["active_objections"] = []
        try:
            raw_output = await self._model.generate(
                system_prompt=CUSTOMER_SYSTEM_PROMPT,
                context=context,
            )
            output = CustomerModelOutput.model_validate(raw_output)
        except (ValidationError, TypeError, ValueError) as exc:
            raise CustomerResponseError(f"invalid customer response: {exc}") from exc

        self._reject_private_fact_leak(output.reply, scenario, state)
        known_ids = {item.objection_id for item in scenario.objections}
        raised_id = output.raised_objection_id if output.raised_objection_id in known_ids else None
        if raised_id and state.concern_prompt_counts.get(raised_id, 0) >= 2:
            raise CustomerResponseError("customer repeated a concern after its follow-up limit")
        return CustomerTurn(
            message=RoleplayMessage(role="customer", content=output.reply),
            raised_objection_id=raised_id,
            accepted_next_step=output.accepted_next_step,
        )

    @staticmethod
    def pending_disclosures(scenario: ScenarioContract, state: RoleplayState):
        """Facts permitted by discovery but not yet said in a customer message."""
        return [
            rule
            for rule in scenario.disclosure_rules
            if rule.fact_key in state.revealed_facts and rule.fact_key not in state.spoken_fact_message_ids
        ]

    @staticmethod
    def focus_objection_id(state: RoleplayState) -> str | None:
        return next(
            (item for item in state.active_objections if state.concern_prompt_counts.get(item, 0) < 2),
            None,
        )

    @staticmethod
    def _build_context(
        scenario: ScenarioContract,
        state: RoleplayState,
        *,
        mode: CustomerTurnMode,
    ) -> dict[str, Any]:
        context = state.customer_prompt_context()
        active_ids = {item for item in state.active_objections if state.concern_prompt_counts.get(item, 0) < 2}
        focus_id = CustomerAgent.focus_objection_id(state)
        context.update(
            {
                "prompt_version": CUSTOMER_PROMPT_VERSION,
                "turn_mode": mode,
                "focus_objection_id": focus_id,
                "focus_objection_prompt_number": state.concern_prompt_counts.get(focus_id, 0) + 1 if focus_id else None,
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
                    if rule.fact_key in state.spoken_fact_message_ids
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
