"""Shared structured-LLM adapters for the role-play runtime.

This module only adapts the team-owned LLM factory to Duy's role-play model
contracts. Application composition, persistence, and knowledge retrieval are
deliberately handled in later integration phases.
"""

from __future__ import annotations

import json
from collections.abc import Callable
from typing import Any, TypeVar

from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel

from src.agents.roleplay.contracts import ScenarioContract
from src.agents.roleplay.customer_agent import CustomerAgent, CustomerModelOutput
from src.agents.roleplay.evaluator import EvaluationDraft, RoleplayEvaluator
from src.agents.roleplay.graph import RoleplayGraph
from src.agents.roleplay.prompts import (
    TURN_ANALYZER_PROMPT_VERSION,
    TURN_ANALYZER_SYSTEM_PROMPT,
)
from src.agents.roleplay.scenario_loader import ScenarioRepository
from src.agents.roleplay.state import RoleplayState
from src.agents.roleplay.turn_analyzer import TurnAnalysis, TurnAnalyzer
from src.config import Settings, get_settings
from src.knowledge.retrieval_service import RetrievalService, get_retrieval_service
from src.services.llm import get_llm
from src.services.practice import PracticeService

from .practice_knowledge import RetrievalKnowledgeEvidenceProvider
from .practice_persistence import SQLCheckpointRepository

StructuredOutput = TypeVar("StructuredOutput", bound=BaseModel)
LLMFactory = Callable[[], BaseChatModel]


class StructuredModelInvocationError(ValueError):
    """The shared provider failed or returned invalid structured output."""


class _StructuredInvoker:
    def __init__(self, model_factory: LLMFactory = get_llm) -> None:
        self._model_factory = model_factory

    async def invoke(
        self,
        schema: type[StructuredOutput],
        *,
        system_prompt: str,
        context: dict[str, Any],
    ) -> StructuredOutput:
        try:
            model = self._model_factory()
            structured_model = model.with_structured_output(schema)
            raw_output = await structured_model.ainvoke(
                [
                    SystemMessage(content=system_prompt),
                    HumanMessage(content=_serialize_context(context)),
                ]
            )
            return schema.model_validate(raw_output)
        except Exception as exc:
            raise StructuredModelInvocationError(f"structured model invocation failed for {schema.__name__}") from exc


class SharedLLMCustomerModel:
    """Adapt the shared LLM factory to ``CustomerTurnModel``."""

    def __init__(self, model_factory: LLMFactory = get_llm) -> None:
        self._invoker = _StructuredInvoker(model_factory)

    async def generate(
        self,
        *,
        system_prompt: str,
        context: dict[str, Any],
    ) -> CustomerModelOutput:
        return await self._invoker.invoke(
            CustomerModelOutput,
            system_prompt=system_prompt,
            context=context,
        )


class SharedLLMTurnAnalysisModel:
    """Adapt the shared LLM factory to ``TurnAnalysisModel``."""

    def __init__(self, model_factory: LLMFactory = get_llm) -> None:
        self._invoker = _StructuredInvoker(model_factory)

    async def analyze(
        self,
        advisor_message: str,
        scenario: ScenarioContract,
        state: RoleplayState,
    ) -> TurnAnalysis:
        return await self._invoker.invoke(
            TurnAnalysis,
            system_prompt=TURN_ANALYZER_SYSTEM_PROMPT,
            context=_turn_analysis_context(advisor_message, scenario, state),
        )


class SharedLLMEvaluationModel:
    """Adapt the shared LLM factory to ``EvaluationModel``."""

    def __init__(self, model_factory: LLMFactory = get_llm) -> None:
        self._invoker = _StructuredInvoker(model_factory)

    async def evaluate(
        self,
        *,
        system_prompt: str,
        context: dict[str, Any],
    ) -> EvaluationDraft:
        # One bounded retry covers transient provider/structured-output failures.
        # The frozen transcript and evidence are unchanged between attempts.
        try:
            return await self._invoker.invoke(
                EvaluationDraft,
                system_prompt=system_prompt,
                context=context,
            )
        except StructuredModelInvocationError:
            return await self._invoker.invoke(
                EvaluationDraft,
                system_prompt=system_prompt,
                context=context,
            )


def build_practice_service(
    *,
    settings: Settings | None = None,
    model_factory: LLMFactory = get_llm,
    retrieval_service: RetrievalService | None = None,
    checkpoint: SQLCheckpointRepository | None = None,
) -> PracticeService:
    """Compose the production Practice vertical slice from shared adapters."""

    resolved_settings = settings or get_settings()
    scenarios = ScenarioRepository()
    resolved_checkpoint = checkpoint or SQLCheckpointRepository(resolved_settings.database_url)
    resolved_retrieval = retrieval_service or get_retrieval_service()
    graph = RoleplayGraph(
        scenarios,
        TurnAnalyzer(SharedLLMTurnAnalysisModel(model_factory)),
        CustomerAgent(SharedLLMCustomerModel(model_factory)),
        resolved_checkpoint,
    )
    return PracticeService(
        graph,
        scenarios,
        evaluator=RoleplayEvaluator(SharedLLMEvaluationModel(model_factory)),
        knowledge_evidence=RetrievalKnowledgeEvidenceProvider(resolved_retrieval),
    )


def _turn_analysis_context(
    advisor_message: str,
    scenario: ScenarioContract,
    state: RoleplayState,
) -> dict[str, Any]:
    """Build an allowlisted context without private hidden-fact values."""

    return {
        "prompt_version": TURN_ANALYZER_PROMPT_VERSION,
        "advisor_message": advisor_message,
        "scenario": {
            "scenario_id": scenario.scenario_id,
            "difficulty": scenario.difficulty,
            "disclosure_rules": [rule.model_dump(mode="json") for rule in scenario.disclosure_rules],
            "objections": [objection.model_dump(mode="json") for objection in scenario.objections],
            "success_conditions": scenario.success_conditions,
            "termination_conditions": scenario.termination_conditions.model_dump(mode="json"),
        },
        "state": {
            "conversation_stage": state.conversation_stage.value,
            "revealed_fact_ids": list(state.revealed_facts),
            "active_objection_ids": list(state.active_objections),
            "resolved_objection_ids": list(state.resolved_objections),
            "unresolved_objection_ids": list(state.unresolved_objections),
            "current_topic": state.current_topic,
            "recent_messages": [message.model_dump(mode="json") for message in state.messages[-6:]],
        },
    }


def _serialize_context(context: dict[str, Any]) -> str:
    return "CONTEXT_JSON:\n" + json.dumps(
        context,
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    )
