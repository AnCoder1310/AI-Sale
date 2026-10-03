"""Application service for advisor-facing role-play operations."""

from __future__ import annotations

import asyncio
from collections.abc import Callable
from typing import Protocol
from uuid import uuid4

from pydantic import BaseModel, ConfigDict

from src.agents.roleplay.contracts import RoleplayGraphContract, ScenarioContract
from src.agents.roleplay.evaluator import KnowledgeEvidence, RoleplayEvaluator
from src.agents.roleplay.scenario_loader import ScenarioRepository, ScenarioSummary
from src.agents.roleplay.state import (
    ConversationStage,
    EvaluationStatus,
    RoleplayMessage,
    RoleplayState,
    TerminationStatus,
)
from src.models.evaluation import SessionEvaluationResult


class PracticeSessionView(BaseModel):
    """Public session shape consumed by the Practice Room frontend."""

    model_config = ConfigDict(extra="forbid")

    session_id: str
    scenario_id: str
    difficulty: str
    sales_channel: str | None = None
    training_objective: str | None = None
    conversation_stage: ConversationStage
    turn_count: int
    visible_context: str
    termination_status: TerminationStatus
    termination_reason: str | None = None
    messages: list[RoleplayMessage]


class PracticeResultView(BaseModel):
    """Advisor-facing status and draft result for a finished attempt."""

    model_config = ConfigDict(extra="forbid")

    session_id: str
    evaluation_status: EvaluationStatus
    result: SessionEvaluationResult | None = None


class KnowledgeEvidenceProvider(Protocol):
    async def for_session(self, scenario: ScenarioContract, state: RoleplayState) -> list[KnowledgeEvidence]: ...


class PracticeEvaluationUnavailableError(RuntimeError):
    """Evaluation failed; the frozen transcript remains available for retry."""


class PracticeService:
    """Keep HTTP handlers independent from graph and persistence details."""

    def __init__(
        self,
        graph: RoleplayGraphContract,
        scenarios: ScenarioRepository,
        *,
        session_id_factory: Callable[[], str] | None = None,
        evaluator: RoleplayEvaluator | None = None,
        knowledge_evidence: KnowledgeEvidenceProvider | None = None,
    ) -> None:
        self._graph = graph
        self._scenarios = scenarios
        self._session_id_factory = session_id_factory or (lambda: str(uuid4()))
        self._evaluator = evaluator
        self._knowledge_evidence = knowledge_evidence
        self._session_locks: dict[str, asyncio.Lock] = {}

    def list_scenarios(self) -> list[ScenarioSummary]:
        return self._scenarios.list_public()

    async def start_session(self, scenario_id: str) -> PracticeSessionView:
        session_id = self._session_id_factory()
        result = await self._graph.start(session_id, scenario_id)
        return PracticeSessionView.model_validate(result)

    async def send_message(
        self,
        session_id: str,
        advisor_message: str,
    ) -> PracticeSessionView:
        async with self._lock_for(session_id):
            result = await self._graph.continue_session(session_id, advisor_message)
            return PracticeSessionView.model_validate(result)

    async def finish_session(self, session_id: str) -> PracticeResultView:
        async with self._lock_for(session_id):
            state = await self._graph.finish_session(session_id)
            if state.evaluation_result is not None:
                return self._result_view(state)

            try:
                if self._evaluator is None or self._knowledge_evidence is None:
                    raise PracticeEvaluationUnavailableError("evaluation dependencies are not configured")
                scenario = self._scenarios.get(state.scenario_id)
                evidence = await self._knowledge_evidence.for_session(scenario, state)
                result = await self._evaluator.evaluate(scenario, state, evidence)
            except Exception as exc:
                await self._graph.mark_evaluation_failed(session_id)
                raise PracticeEvaluationUnavailableError(
                    "Evaluation is unavailable; the finished attempt can be retried."
                ) from exc

            saved = await self._graph.save_evaluation_result(session_id, result)
            return self._result_view(saved)

    async def get_result(self, session_id: str) -> PracticeResultView:
        state = await self._graph.get_session_state(session_id)
        return self._result_view(state)

    async def get_session(self, session_id: str) -> PracticeSessionView:
        state = await self._graph.get_session_state(session_id)
        return PracticeSessionView.model_validate(state.advisor_visible_context())

    def _lock_for(self, session_id: str) -> asyncio.Lock:
        return self._session_locks.setdefault(session_id, asyncio.Lock())

    @staticmethod
    def _result_view(state: RoleplayState) -> PracticeResultView:
        return PracticeResultView(
            session_id=state.session_id,
            evaluation_status=state.evaluation_status,
            result=state.evaluation_result,
        )
