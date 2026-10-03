"""HTTP contract for the advisor Practice Room."""

from typing import Annotated

from fastapi import APIRouter, HTTPException, Path, status
from pydantic import BaseModel, ConfigDict, Field, field_validator

from src.agents.roleplay.customer_agent import CustomerResponseError
from src.agents.roleplay.graph import (
    RoleplayScenarioNotFoundError,
    RoleplaySessionConflictError,
    RoleplaySessionNotFoundError,
)
from src.agents.roleplay.scenario_loader import ScenarioSummary
from src.agents.roleplay.state_reducer import StateTransitionError
from src.agents.roleplay.turn_analyzer import TurnAnalysisError
from src.services.practice import (
    PracticeEvaluationUnavailableError,
    PracticeResultView,
    PracticeService,
    PracticeSessionView,
)


class CreatePracticeSessionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    scenario_id: str = Field(min_length=1, max_length=120)

    @field_validator("scenario_id")
    @classmethod
    def strip_scenario_id(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("scenario_id must not be blank")
        return normalized


class AdvisorMessageRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    message: str = Field(min_length=1, max_length=4000)

    @field_validator("message")
    @classmethod
    def strip_message(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("message must not be blank")
        return normalized


def create_practice_router(service: PracticeService) -> APIRouter:
    """Create a router with explicit service injection for app composition/tests."""
    router = APIRouter(prefix="/practice", tags=["practice"])

    @router.get("/scenarios", response_model=list[ScenarioSummary])
    async def list_scenarios() -> list[ScenarioSummary]:
        return service.list_scenarios()

    @router.post(
        "/sessions",
        response_model=PracticeSessionView,
        status_code=status.HTTP_201_CREATED,
    )
    async def start_session(
        request: CreatePracticeSessionRequest,
    ) -> PracticeSessionView:
        try:
            return await service.start_session(request.scenario_id)
        except RoleplayScenarioNotFoundError as exc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Practice scenario was not found.",
            ) from exc

    @router.post(
        "/{session_id}/message",
        response_model=PracticeSessionView,
    )
    async def send_message(
        session_id: Annotated[str, Path(min_length=1, max_length=120)],
        request: AdvisorMessageRequest,
    ) -> PracticeSessionView:
        try:
            return await service.send_message(session_id, request.message)
        except RoleplaySessionNotFoundError as exc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Practice session was not found.",
            ) from exc
        except (RoleplaySessionConflictError, StateTransitionError) as exc:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Practice session cannot accept this message in its current state.",
            ) from exc
        except (CustomerResponseError, TurnAnalysisError) as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=("The AI response could not be completed. The advisor turn was saved and can be retried."),
            ) from exc

    @router.post("/{session_id}/finish", response_model=PracticeResultView)
    async def finish_session(
        session_id: Annotated[str, Path(min_length=1, max_length=120)],
    ) -> PracticeResultView:
        try:
            return await service.finish_session(session_id)
        except RoleplaySessionNotFoundError as exc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Practice session was not found.",
            ) from exc
        except RoleplaySessionConflictError as exc:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Practice session cannot be finished in its current state.",
            ) from exc
        except PracticeEvaluationUnavailableError as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Evaluation is temporarily unavailable. The saved attempt can be retried.",
            ) from exc

    @router.get("/{session_id}/result", response_model=PracticeResultView)
    async def get_result(
        session_id: Annotated[str, Path(min_length=1, max_length=120)],
    ) -> PracticeResultView:
        try:
            return await service.get_result(session_id)
        except RoleplaySessionNotFoundError as exc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Practice session was not found.",
            ) from exc

    @router.get("/{session_id}", response_model=PracticeSessionView)
    async def get_session(
        session_id: Annotated[str, Path(min_length=1, max_length=120)],
    ) -> PracticeSessionView:
        try:
            return await service.get_session(session_id)
        except RoleplaySessionNotFoundError as exc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Practice session was not found.",
            ) from exc

    return router
