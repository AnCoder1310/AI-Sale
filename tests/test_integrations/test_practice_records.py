"""History/review persistence tests use a real SQLite database, not a mock."""

import pytest
from pydantic import ValidationError

from src.integrations.practice_records import SQLPracticeRecordsRepository
from src.models.evaluation import CriterionType, ReviewStatus, SessionEvaluationResult
from src.services.practice_records import AttemptNotFoundError, ManagerReviewDecision, ReviewConflictError


def draft(session_id: str, scenario_id: str = "scenario-1") -> SessionEvaluationResult:
    evaluations = [
        {
            "criterion": criterion,
            "status": "assessed" if criterion is CriterionType.NEED_DISCOVERY else "unassessed",
            "score": 3 if criterion is CriterionType.NEED_DISCOVERY else None,
            "evidence": (
                [{"message_id": "advisor-1", "quote": "What do you need?"}]
                if criterion is CriterionType.NEED_DISCOVERY
                else []
            ),
            "reason": "Recorded conversation evidence.",
        }
        for criterion in CriterionType
    ]
    return SessionEvaluationResult(
        session_id=session_id,
        scenario_id=scenario_id,
        rubric_version="test-v1",
        assessed_criteria_count=1,
        overall_score=3,
        evaluations=evaluations,
    )


@pytest.mark.asyncio
async def test_history_is_scoped_to_advisor_and_retains_every_attempt(tmp_path):
    url = f"sqlite:///{tmp_path / 'records.db'}"
    records = SQLPracticeRecordsRepository(url)
    await records.register("attempt-1", "scenario-1", "advisor-a")
    await records.register("attempt-2", "scenario-1", "advisor-a")
    await records.register("attempt-3", "scenario-2", "advisor-b")
    await records.complete("attempt-1", draft("attempt-1"))
    await records.complete("attempt-2", draft("attempt-2"))

    reopened = SQLPracticeRecordsRepository(url)
    history = await reopened.history("advisor-a", "scenario-1")

    assert [item.session_id for item in history] == ["attempt-2", "attempt-1"]
    assert all(item.advisor_id == "advisor-a" for item in history)
    assert await reopened.history("advisor-b", "scenario-1") == []
    assert all(item.ai_score == 3 for item in history)
    assert await reopened.history("advisor-b") == []  # An unfinished attempt is not history yet.
    assert (await reopened.owned_attempt("attempt-1", "advisor-a")).session_id == "attempt-1"
    with pytest.raises(AttemptNotFoundError):
        await reopened.owned_attempt("attempt-1", "advisor-b")


@pytest.mark.asyncio
async def test_manager_queue_shows_latest_unreviewed_per_advisor_scenario(tmp_path):
    records = SQLPracticeRecordsRepository(f"sqlite:///{tmp_path / 'records.db'}")
    for session_id in ("attempt-1", "attempt-2"):
        await records.register(session_id, "scenario-1", "advisor-a")
        await records.complete(session_id, draft(session_id))
    await records.register("unfinished", "scenario-1", "advisor-b")

    assert [item.session_id for item in await records.review_queue()] == ["attempt-2"]

    await records.approve("attempt-2", "manager-1", ManagerReviewDecision(change_reason="Checked transcript."))
    assert [item.session_id for item in await records.review_queue()] == ["attempt-1"]


@pytest.mark.asyncio
async def test_manager_review_preserves_ai_draft_and_audits_score_change(tmp_path):
    records = SQLPracticeRecordsRepository(f"sqlite:///{tmp_path / 'records.db'}")
    await records.register("attempt-1", "scenario-1", "advisor-a")
    await records.complete("attempt-1", draft("attempt-1"))

    review = await records.approve(
        "attempt-1",
        "manager-1",
        ManagerReviewDecision(
            score_overrides={CriterionType.NEED_DISCOVERY: 2},
            change_reason="The follow-up question met the higher anchor.",
        ),
    )

    assert review.ai_draft.overall_score == 3
    assert review.ai_draft.review_status is ReviewStatus.AI_DRAFT
    assert review.approved_result.overall_score == 2
    assert review.approved_result.review_status is ReviewStatus.MANAGER_APPROVED
    assert review.manager_id == "manager-1"
    history = await records.history("advisor-a")
    assert history[0].approved_score == 2
    assert history[0].review_status is ReviewStatus.MANAGER_APPROVED
    reopened = SQLPracticeRecordsRepository(f"sqlite:///{tmp_path / 'records.db'}")
    saved_review = await reopened.review_details("attempt-1")
    assert saved_review is not None
    assert saved_review.change_reason == "The follow-up question met the higher anchor."
    assert saved_review.ai_draft.overall_score == 3
    assert (await reopened.manager_attempt("attempt-1")).advisor_id == "advisor-a"
    with pytest.raises(ReviewConflictError, match="already reviewed"):
        await records.approve("attempt-1", "manager-2", ManagerReviewDecision(change_reason="Repeat."))


@pytest.mark.asyncio
async def test_review_rejects_unfinished_missing_or_unassessed_attempt(tmp_path):
    records = SQLPracticeRecordsRepository(f"sqlite:///{tmp_path / 'records.db'}")
    await records.register("unfinished", "scenario-1", "advisor-a")
    decision = ManagerReviewDecision(change_reason="Reviewed.")
    with pytest.raises(ReviewConflictError, match="unfinished"):
        await records.approve("unfinished", "manager-1", decision)
    with pytest.raises(AttemptNotFoundError):
        await records.approve("missing", "manager-1", decision)
    await records.register("attempt-1", "scenario-1", "advisor-a")
    await records.complete("attempt-1", draft("attempt-1"))
    with pytest.raises(ReviewConflictError, match="assessed"):
        await records.approve(
            "attempt-1",
            "manager-1",
            ManagerReviewDecision(score_overrides={CriterionType.POLICY_ACCURACY: 3}, change_reason="Invalid edit."),
        )


def test_review_decision_rejects_invalid_scores_and_blank_reason():
    with pytest.raises(ValidationError):
        ManagerReviewDecision(score_overrides={CriterionType.NEED_DISCOVERY: 4}, change_reason="Reviewed.")
    with pytest.raises(ValidationError):
        ManagerReviewDecision(change_reason="   ")
