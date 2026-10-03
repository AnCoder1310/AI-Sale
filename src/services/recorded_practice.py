"""Identity-aware Practice operations, ready for the shared auth dependency.

Only backend-authenticated IDs may be passed to this service. The public
FastAPI router is intentionally not registered until auth is available.
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict

from src.agents.roleplay.scenario_loader import ScenarioSummary
from src.agents.roleplay.state import EvaluationStatus
from src.services.practice import (
    PracticeEvaluationUnavailableError,
    PracticeResultView,
    PracticeService,
    PracticeSessionView,
)
from src.services.practice_records import (
    AttemptSummary,
    ManagerReviewDecision,
    ManagerReviewRecord,
    PracticeRecordsRepository,
)


class RecordedAttemptDetail(BaseModel):
    model_config = ConfigDict(extra="forbid")

    attempt: AttemptSummary
    session: PracticeSessionView
    ai_evaluation: PracticeResultView
    manager_review: ManagerReviewRecord | None = None


class RecordedPracticeService:
    def __init__(self, practice: PracticeService, records: PracticeRecordsRepository) -> None:
        self._practice = practice
        self._records = records

    def list_scenarios(self) -> list[ScenarioSummary]:
        return self._practice.list_scenarios()

    async def start_session(
        self, scenario_id: str, advisor_id: str, max_turns: int | None = None
    ) -> PracticeSessionView:
        session = (
            await self._practice.start_session(scenario_id, max_turns=max_turns)
            if max_turns is not None
            else await self._practice.start_session(scenario_id)
        )
        await self._records.register(session.session_id, session.scenario_id, advisor_id)
        return session

    async def send_message(self, session_id: str, advisor_id: str, message: str) -> PracticeSessionView:
        await self._records.owned_attempt(session_id, advisor_id)
        return await self._practice.send_message(session_id, message)

    async def retry_customer_reply(self, session_id: str, advisor_id: str) -> PracticeSessionView:
        await self._records.owned_attempt(session_id, advisor_id)
        return await self._practice.retry_customer_reply(session_id)

    async def finish_session(self, session_id: str, advisor_id: str) -> PracticeResultView:
        await self._records.owned_attempt(session_id, advisor_id)
        try:
            evaluation = await self._practice.finish_session(session_id)
        except PracticeEvaluationUnavailableError:
            await self._records.mark_evaluation_failed(session_id)
            raise
        if evaluation.evaluation_status is EvaluationStatus.COMPLETE and evaluation.result is not None:
            await self._records.complete(session_id, evaluation.result)
        return evaluation

    async def advisor_detail(self, session_id: str, advisor_id: str) -> RecordedAttemptDetail:
        attempt = await self._records.owned_attempt(session_id, advisor_id)
        session = await self._practice.get_session(session_id)
        evaluation = await self._practice.get_result(session_id)
        review = await self._records.review_details(session_id)
        return RecordedAttemptDetail(
            attempt=attempt,
            session=session,
            ai_evaluation=evaluation,
            manager_review=review,
        )

    async def advisor_session(self, session_id: str, advisor_id: str) -> PracticeSessionView:
        await self._records.owned_attempt(session_id, advisor_id)
        return await self._practice.get_session(session_id)

    async def advisor_result(self, session_id: str, advisor_id: str) -> PracticeResultView:
        await self._records.owned_attempt(session_id, advisor_id)
        return await self._practice.get_result(session_id)

    async def history(self, advisor_id: str, scenario_id: str | None = None) -> list[AttemptSummary]:
        return await self._records.history(advisor_id, scenario_id)

    async def review_queue(self) -> list[AttemptSummary]:
        return await self._records.review_queue()

    async def manager_detail(self, session_id: str) -> RecordedAttemptDetail:
        attempt = await self._records.manager_attempt(session_id)
        session = await self._practice.get_session(session_id)
        evaluation = await self._practice.get_result(session_id)
        review = await self._records.review_details(session_id)
        return RecordedAttemptDetail(
            attempt=attempt,
            session=session,
            ai_evaluation=evaluation,
            manager_review=review,
        )

    async def approve(self, session_id: str, manager_id: str, decision: ManagerReviewDecision) -> ManagerReviewRecord:
        return await self._records.approve(session_id, manager_id, decision)
