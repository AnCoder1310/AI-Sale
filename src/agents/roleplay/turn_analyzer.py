"""Structured advisor-turn analysis with deterministic contract enforcement."""

from __future__ import annotations

from typing import Any, Protocol

from pydantic import BaseModel, Field, ValidationError

from .contracts import ClaimCategory, ScenarioContract
from .state import RoleplayState


class FactualClaim(BaseModel):
    text: str = Field(min_length=1)
    category: ClaimCategory


class TurnAnalysis(BaseModel):
    """Signals used by deterministic state logic and later evaluation."""

    detected_intents: list[str] = Field(default_factory=list)
    discovered_fact_ids: list[str] = Field(default_factory=list)
    factual_claims: list[FactualClaim] = Field(default_factory=list)
    addressed_objection_ids: list[str] = Field(default_factory=list)
    resolved_objection_ids: list[str] = Field(default_factory=list)
    next_step_attempted: bool = False
    premature_closing: bool = False
    unsafe_or_abusive: bool = False
    advisor_requested_finish: bool = False
    current_topic: str | None = None


class TurnAnalysisModel(Protocol):
    """Replaceable structured-output model boundary."""

    async def analyze(
        self,
        advisor_message: str,
        scenario: ScenarioContract,
        state: RoleplayState,
    ) -> TurnAnalysis | dict[str, Any]: ...


class TurnAnalysisError(ValueError):
    """Raised when a turn cannot produce a valid structured analysis."""


def _unique(items: list[str]) -> list[str]:
    return list(dict.fromkeys(items))


class TurnAnalyzer:
    """Validate model output and reject state mutations unsupported by a scenario."""

    def __init__(self, model: TurnAnalysisModel) -> None:
        self._model = model

    async def analyze(
        self,
        advisor_message: str,
        scenario: ScenarioContract,
        state: RoleplayState,
    ) -> TurnAnalysis:
        if not advisor_message.strip():
            raise TurnAnalysisError("advisor_message must not be blank")
        if state.scenario_id != scenario.scenario_id:
            raise TurnAnalysisError("state and scenario identifiers do not match")

        try:
            raw_analysis = await self._model.analyze(advisor_message, scenario, state)
            analysis = TurnAnalysis.model_validate(raw_analysis)
        except (ValidationError, TypeError, ValueError) as exc:
            raise TurnAnalysisError(f"invalid turn analysis: {exc}") from exc

        known_intents = {rule.trigger_intent for rule in scenario.disclosure_rules}
        detected_intents = [intent for intent in _unique(analysis.detected_intents) if intent in known_intents]
        permitted_fact_ids = {
            rule.fact_key for rule in scenario.disclosure_rules if rule.trigger_intent in detected_intents
        }
        discovered_fact_ids = [
            fact_id for fact_id in _unique(analysis.discovered_fact_ids) if fact_id in permitted_fact_ids
        ]

        known_objections = {objection.objection_id for objection in scenario.objections}
        addressed_objection_ids = [
            objection_id
            for objection_id in _unique(analysis.addressed_objection_ids)
            if objection_id in known_objections
        ]
        resolvable_objections = set(addressed_objection_ids) & set(state.active_objections)
        resolved_objection_ids = [
            objection_id
            for objection_id in _unique(analysis.resolved_objection_ids)
            if objection_id in resolvable_objections
        ]
        factual_claims = [
            claim for claim in analysis.factual_claims if claim.text.casefold() in advisor_message.casefold()
        ]

        return analysis.model_copy(
            update={
                "detected_intents": detected_intents,
                "discovered_fact_ids": discovered_fact_ids,
                "addressed_objection_ids": addressed_objection_ids,
                "resolved_objection_ids": resolved_objection_ids,
                "factual_claims": factual_claims,
            }
        )
