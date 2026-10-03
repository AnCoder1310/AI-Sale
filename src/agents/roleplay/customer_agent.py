"""Safe model boundary for generating an AI Customer turn."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal, Protocol

from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator

from .contracts import ScenarioContract
from .prompts import CUSTOMER_PROMPT_VERSION, CUSTOMER_SYSTEM_PROMPT
from .state import RoleplayMessage, RoleplayState

CustomerTurnMode = Literal["opening", "response"]
CustomerDecision = Literal["reply", "acknowledge", "accept_step", "defer", "decline"]


class CustomerModelOutput(BaseModel):
    """Strict structured output expected from the customer model."""

    model_config = ConfigDict(extra="forbid")

    reply: str = Field(min_length=1, max_length=800)
    raised_objection_id: str | None
    decision: CustomerDecision

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
    decision: CustomerDecision = "reply"
    source: Literal["model", "scenario_disclosure", "follow_up_guard"] = "model"


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
            reply = pending[0].revealed_statement
            return CustomerTurn(message=RoleplayMessage(role="customer", content=reply), source="scenario_disclosure")

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
        raised_id = output.raised_objection_id
        if raised_id is not None and raised_id not in known_ids:
            raise CustomerResponseError("customer response references an unknown concern")
        if output.decision != "reply" and raised_id is not None:
            raise CustomerResponseError("a decision cannot also raise a concern")
        if output.decision == "accept_step" and not consider_next_step:
            raise CustomerResponseError("customer accepted a next step that was not proposed")
        if raised_id and state.concern_prompt_counts.get(raised_id, 0) >= 2:
            return CustomerTurn(
                message=RoleplayMessage(
                    role="customer",
                    content="Anh vẫn chưa yên tâm về việc này. Để anh cân nhắc thêm rồi liên hệ lại em sau nhé.",
                ),
                decision="defer",
                source="follow_up_guard",
            )
        return CustomerTurn(
            message=RoleplayMessage(role="customer", content=output.reply),
            raised_objection_id=raised_id,
            decision=output.decision,
        )

    @staticmethod
    def pending_disclosures(scenario: ScenarioContract, state: RoleplayState):
        """Facts permitted by discovery but not yet said in a customer message."""
        return [
            rule
            for rule in scenario.disclosure_rules
            if rule.fact_key in state.pending_disclosure_fact_ids and rule.fact_key not in state.spoken_fact_message_ids
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
                "available_objections": [
                    {"objection_id": item.objection_id, "objection_text": item.objection_text}
                    for item in scenario.objections
                    if item.objection_id in state.unresolved_objections
                    and state.concern_prompt_counts.get(item.objection_id, 0) < 2
                ],
                "drop_out_trigger": scenario.termination_conditions.drop_out_trigger,
                "exhausted_objection_ids": [
                    item for item in state.active_objections if state.concern_prompt_counts.get(item, 0) >= 2
                ],
                "buyer_decision_policy": (
                    scenario.buyer_decision_policy.model_dump() if scenario.buyer_decision_policy else None
                ),
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
