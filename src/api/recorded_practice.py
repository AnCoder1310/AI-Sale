"""Auth-gated Practice history and manager-review routes."""

from collections.abc import Awaitable, Callable
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status

from src.agents.roleplay.customer_agent import CustomerResponseError
from src.agents.roleplay.graph import (
    RoleplayScenarioNotFoundError,
    RoleplaySessionConflictError,
    RoleplaySessionNotFoundError,
)
from src.agents.roleplay.scenario_loader import ScenarioSummary
from src.agents.roleplay.state_reducer import StateTransitionError
from src.agents.roleplay.turn_analyzer import TurnAnalysisError
from src.api.practice import AdvisorMessageRequest, CreatePracticeSessionRequest
from src.models.auth import AuthenticatedUser
from src.services.practice import PracticeEvaluationUnavailableError, PracticeResultView, PracticeSessionView
from src.services.practice_records import (
    AttemptNotFoundError,
    AttemptSummary,
    ManagerReviewDecision,
    ManagerReviewRecord,
    ReviewConflictError,
)
from src.services.recorded_practice import RecordedAttemptDetail, RecordedPracticeService

IdentityDependency = Callable[..., Awaitable[AuthenticatedUser]]
SessionId = Annotated[str, Path(min_length=1, max_length=120)]


def create_recorded_practice_routers(
    service: RecordedPracticeService,
    get_identity: IdentityDependency,
) -> tuple[APIRouter, APIRouter]:
    """Construct a replacement Practice router and manager router.

    Mount these instead of the legacy Practice router, never alongside it.
    """
    practice = APIRouter(prefix="/practice", tags=["practice"])
    manager = APIRouter(prefix="/manager", tags=["manager-review"])
    actor = Annotated[AuthenticatedUser, Depends(get_identity)]

    def require_role(identity: AuthenticatedUser, role: str) -> None:
        if identity.role != role:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This role cannot access this operation.")

    @practice.get("/scenarios", response_model=list[ScenarioSummary])
    async def list_scenarios(identity: actor) -> list[ScenarioSummary]:
        require_role(identity, "advisor")
        return service.list_scenarios()

    @practice.post("/sessions", response_model=PracticeSessionView, status_code=status.HTTP_201_CREATED)
    async def start_session(request: CreatePracticeSessionRequest, identity: actor) -> PracticeSessionView:
        require_role(identity, "advisor")
        try:
            return await service.start_session(request.scenario_id, identity.user_id, max_turns=request.max_turns)
        except RoleplayScenarioNotFoundError as exc:
            raise HTTPException(status_code=404, detail="Practice scenario was not found.") from exc

    @practice.get("/history", response_model=list[AttemptSummary])
    async def history(identity: actor, scenario_id: str | None = Query(None, max_length=120)) -> list[AttemptSummary]:
        require_role(identity, "advisor")
        return await service.history(identity.user_id, scenario_id)

    @practice.post("/{session_id}/message", response_model=PracticeSessionView)
    async def send_message(
        session_id: SessionId, request: AdvisorMessageRequest, identity: actor
    ) -> PracticeSessionView:
        require_role(identity, "advisor")
        try:
            return await service.send_message(session_id, identity.user_id, request.message)
        except (AttemptNotFoundError, RoleplaySessionNotFoundError) as exc:
            raise HTTPException(status_code=404, detail="Practice session was not found.") from exc
        except (RoleplaySessionConflictError, StateTransitionError) as exc:
            raise HTTPException(status_code=409, detail="Practice session cannot accept a message now.") from exc
        except (CustomerResponseError, TurnAnalysisError) as exc:
            raise HTTPException(status_code=502, detail="AI response failed; the saved turn can be retried.") from exc

    @practice.post("/{session_id}/finish", response_model=PracticeResultView)
    async def finish_session(session_id: SessionId, identity: actor) -> PracticeResultView:
        require_role(identity, "advisor")
        try:
            return await service.finish_session(session_id, identity.user_id)
        except (AttemptNotFoundError, RoleplaySessionNotFoundError) as exc:
            raise HTTPException(status_code=404, detail="Practice session was not found.") from exc
        except RoleplaySessionConflictError as exc:
            raise HTTPException(status_code=409, detail="Practice session cannot be finished now.") from exc
        except PracticeEvaluationUnavailableError as exc:
            raise HTTPException(
                status_code=503, detail="Evaluation is unavailable; the attempt can be retried."
            ) from exc

    @practice.get("/{session_id}/result", response_model=PracticeResultView)
    async def advisor_result(session_id: SessionId, identity: actor) -> PracticeResultView:
        require_role(identity, "advisor")
        try:
            return await service.advisor_result(session_id, identity.user_id)
        except (AttemptNotFoundError, RoleplaySessionNotFoundError) as exc:
            raise HTTPException(status_code=404, detail="Practice session was not found.") from exc

    @practice.get("/{session_id}/attempt", response_model=RecordedAttemptDetail)
    async def advisor_detail(session_id: SessionId, identity: actor) -> RecordedAttemptDetail:
        require_role(identity, "advisor")
        try:
            return await service.advisor_detail(session_id, identity.user_id)
        except (AttemptNotFoundError, RoleplaySessionNotFoundError) as exc:
            raise HTTPException(status_code=404, detail="Practice session was not found.") from exc

    @practice.get("/{session_id}", response_model=PracticeSessionView)
    async def advisor_session(session_id: SessionId, identity: actor) -> PracticeSessionView:
        require_role(identity, "advisor")
        try:
            return await service.advisor_session(session_id, identity.user_id)
        except (AttemptNotFoundError, RoleplaySessionNotFoundError) as exc:
            raise HTTPException(status_code=404, detail="Practice session was not found.") from exc

    @manager.get("/reviews", response_model=list[AttemptSummary])
    async def review_queue(identity: actor) -> list[AttemptSummary]:
        require_role(identity, "manager")
        return await service.review_queue()

    @manager.get("/reviews/{session_id}", response_model=RecordedAttemptDetail)
    async def manager_detail(session_id: SessionId, identity: actor) -> RecordedAttemptDetail:
        require_role(identity, "manager")
        try:
            return await service.manager_detail(session_id)
        except (AttemptNotFoundError, RoleplaySessionNotFoundError) as exc:
            raise HTTPException(status_code=404, detail="Practice session was not found.") from exc

    @manager.patch("/reviews/{session_id}", response_model=ManagerReviewRecord)
    async def approve(session_id: SessionId, decision: ManagerReviewDecision, identity: actor) -> ManagerReviewRecord:
        require_role(identity, "manager")
        try:
            return await service.approve(session_id, identity.user_id, decision)
        except AttemptNotFoundError as exc:
            raise HTTPException(status_code=404, detail="Practice session was not found.") from exc
        except ReviewConflictError as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc

    return practice, manager
