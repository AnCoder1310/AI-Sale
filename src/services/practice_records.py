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
        if any(score < 1 or score > 5 for score in self.score_overrides.values()):
            raise ValueError("score overrides must be between 1 and 5")
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
