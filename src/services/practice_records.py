"""Practice attempt history and manager-review business rules.

The caller must supply identities from a trusted authentication dependency.
This module deliberately does not accept user IDs from browser request bodies.
"""

from __future__ import annotations

from datetime import datetime
from typing import Protocol

from pydantic import BaseModel, ConfigDict, Field, model_validator

from src.agents.roleplay.state import EvaluationStatus
from src.models.evaluation import (
    CriterionStatus,
    CriterionType,
    RecommendedNextPractice,
    ReviewStatus,
    SessionEvaluationResult,
)


class AttemptNotFoundError(LookupError):
    """The attempt does not exist or is not visible to this advisor."""


class ReviewConflictError(ValueError):
    """The attempt cannot be reviewed in its current state."""


class AttemptSummary(BaseModel):
    model_config = ConfigDict(extra="forbid")

    session_id: str
    scenario_id: str
    advisor_id: str
    started_at: datetime
    completed_at: datetime | None = None
    evaluation_status: EvaluationStatus = EvaluationStatus.NOT_STARTED
    review_status: ReviewStatus = ReviewStatus.AI_DRAFT
    ai_score: float | None = None
    approved_score: float | None = None



class SkillSummary(BaseModel):
    criterion: CriterionType
    average_score: float
    assessed_count: int


class TeamOverview(BaseModel):
    completed_attempts: int
    approved_attempts: int
    pending_attempts: int
    failed_evaluations: int
    active_advisors: int
    skill_summaries: list[SkillSummary]


class AssignmentRecord(BaseModel):
    assignment_id: str
    title: str
    scenario_id: str
    scenario_title: str
    target_vehicle: str
    advisor_id: str
    advisor_name: str
    manager_id: str
    due_date: str
    status: str  # "pending" | "completed"
    created_at: str


class CreateAssignmentInput(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    scenario_id: str = Field(min_length=1, max_length=120)
    target_vehicle: str = Field(min_length=1, max_length=120)
    advisor_id: str = Field(min_length=1, max_length=120)
    due_date: str = Field(min_length=1, max_length=50)


class AdvisorPerformanceView(BaseModel):
    advisor_id: str
    advisor_name: str
    completed_sessions: int
    approved_sessions: int
    average_score: float | None = None
    latest_activity: str | None = None
    status: str  # "top" | "on_track" | "needs_attention" | "inactive"

class ManagerReviewDecision(BaseModel):
    """Manager corrections; missing scores retain their AI-draft values."""

    model_config = ConfigDict(extra="forbid")

    score_overrides: dict[CriterionType, int] = Field(default_factory=dict)
    recommended_next_practice: RecommendedNextPractice | None = None
    change_reason: str = Field(min_length=1, max_length=2000)

    @model_validator(mode="after")
    def validate_reason(self) -> ManagerReviewDecision:
        if not self.change_reason.strip():
            raise ValueError("change_reason must not be blank")
        if any(score < 1 or score > 3 for score in self.score_overrides.values()):
            raise ValueError("score overrides must be between 1 and 3")
        return self


class ManagerReviewRecord(BaseModel):
    model_config = ConfigDict(extra="forbid")

    session_id: str
    manager_id: str
    reviewed_at: datetime
    change_reason: str
    ai_draft: SessionEvaluationResult
    approved_result: SessionEvaluationResult


class PracticeRecordsRepository(Protocol):
    async def register(self, session_id: str, scenario_id: str, advisor_id: str) -> None: ...

    async def mark_evaluation_failed(self, session_id: str) -> None: ...

    async def complete(self, session_id: str, ai_draft: SessionEvaluationResult) -> None: ...

    async def history(self, advisor_id: str, scenario_id: str | None = None) -> list[AttemptSummary]: ...

    async def owned_attempt(self, session_id: str, advisor_id: str) -> AttemptSummary: ...

    async def manager_attempt(self, session_id: str) -> AttemptSummary: ...

    async def review_details(self, session_id: str) -> ManagerReviewRecord | None: ...

    async def review_queue(self) -> list[AttemptSummary]: ...

    async def manager_history(
        self, advisor_id: str | None = None, scenario_id: str | None = None, limit: int = 50, offset: int = 0
    ) -> list[AttemptSummary]: ...

    async def team_overview(self) -> TeamOverview: ...

    async def list_assignments(self, advisor_id: str | None = None) -> list[AssignmentRecord]: ...

    async def create_assignment(
        self, manager_id: str, payload: CreateAssignmentInput, scenario_title: str, advisor_name: str
    ) -> AssignmentRecord: ...

    async def list_advisors(self) -> list[AdvisorPerformanceView]: ...

    async def approve(
        self, session_id: str, manager_id: str, decision: ManagerReviewDecision
    ) -> ManagerReviewRecord: ...


def approved_evaluation(draft: SessionEvaluationResult, decision: ManagerReviewDecision) -> SessionEvaluationResult:
    """Apply only evidence-backed score edits and recompute the aggregate in code."""
    updated = draft.model_copy(deep=True)
    criteria = {item.criterion: item for item in updated.evaluations}
    for criterion, score in decision.score_overrides.items():
        item = criteria.get(criterion)
        if item is None or item.status is not CriterionStatus.ASSESSED:
            raise ReviewConflictError("only assessed criteria may receive score overrides")
        item.score = score
    if decision.recommended_next_practice is not None:
        updated.recommended_next_practice = decision.recommended_next_practice
    scores = [item.score for item in updated.evaluations if item.status is CriterionStatus.ASSESSED]
    updated.overall_score = sum(scores) / len(scores) if scores else None
    updated.review_status = ReviewStatus.MANAGER_APPROVED
    return SessionEvaluationResult.model_validate(updated.model_dump())
