"""SQL storage for advisor attempt history and manager decisions.

Separate tables avoid changing Chương's existing checkpoint schema. Old,
unowned checkpoints are intentionally excluded from per-advisor history.
"""

from __future__ import annotations

from datetime import UTC, datetime
from threading import Lock

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    MetaData,
    String,
    Table,
    Text,
    create_engine,
    insert,
    select,
    update,
)
from sqlalchemy.engine import Engine
from sqlalchemy.exc import IntegrityError

from src.agents.roleplay.state import EvaluationStatus
from src.integrations.practice_persistence import normalize_database_url
from src.models.evaluation import CriterionStatus, CriterionType, ReviewStatus, SessionEvaluationResult
from src.services.practice_records import (
    AdvisorPerformanceView,
    AssignmentRecord,
    CreateAssignmentInput,
    SkillSummary,
    TeamOverview,
    AttemptNotFoundError,
    AttemptSummary,
    ManagerReviewDecision,
    ManagerReviewRecord,
    ReviewConflictError,
    approved_evaluation,
)


class SQLPracticeRecordsRepository:
    def __init__(self, database_url: str, *, engine: Engine | None = None) -> None:
        self._engine = engine or create_engine(normalize_database_url(database_url), pool_pre_ping=True)
        metadata = MetaData()
        self._attempts = Table(
            "practice_attempts",
            metadata,
            Column("session_id", String(120), primary_key=True),
            Column("scenario_id", String(120), nullable=False),
            Column("advisor_id", String(120), nullable=False, index=True),
            Column("started_at", DateTime(timezone=True), nullable=False),
            Column("completed_at", DateTime(timezone=True)),
            Column("evaluation_status", String(20), nullable=False),
            Column("ai_draft_json", Text),
        )
        self._reviews = Table(
            "practice_manager_reviews",
            metadata,
            Column("session_id", String(120), ForeignKey("practice_attempts.session_id"), primary_key=True),
            Column("manager_id", String(120), nullable=False),
            Column("reviewed_at", DateTime(timezone=True), nullable=False),
            Column("change_reason", Text, nullable=False),
            Column("approved_result_json", Text, nullable=False),
        )
        self._assignments = Table(
            "practice_assignments",
            metadata,
            Column("assignment_id", String(120), primary_key=True),
            Column("title", String(200), nullable=False),
            Column("scenario_id", String(120), nullable=False),
            Column("scenario_title", String(200), nullable=False),
            Column("target_vehicle", String(120), nullable=False),
            Column("advisor_id", String(120), nullable=False, index=True),
            Column("advisor_name", String(200), nullable=False),
            Column("manager_id", String(120), nullable=False),
            Column("due_date", String(50), nullable=False),
            Column("status", String(50), nullable=False, default="pending"),
            Column("created_at", DateTime(timezone=True), nullable=False),
        )
        self._metadata = metadata
        self._schema_ready = False
        self._schema_lock = Lock()

    def _ensure_schema(self) -> None:
        if self._schema_ready:
            return
        with self._schema_lock:
            if not self._schema_ready:
                self._metadata.create_all(self._engine)
                self._schema_ready = True

    async def register(self, session_id: str, scenario_id: str, advisor_id: str) -> None:
        if not all(value.strip() for value in (session_id, scenario_id, advisor_id)):
            raise ValueError("attempt identity fields must not be blank")
        self._ensure_schema()
        with self._engine.begin() as connection:
            connection.execute(
                insert(self._attempts).values(
                    session_id=session_id,
                    scenario_id=scenario_id,
                    advisor_id=advisor_id,
                    started_at=datetime.now(UTC),
                    evaluation_status=EvaluationStatus.NOT_STARTED.value,
                )
            )

    async def mark_evaluation_failed(self, session_id: str) -> None:
        """Keep a finished attempt visible when the evaluator needs retry."""
        self._ensure_schema()
        with self._engine.begin() as connection:
            changed = connection.execute(
                update(self._attempts)
                .where(self._attempts.c.session_id == session_id)
                .where(self._attempts.c.ai_draft_json.is_(None))
                .values(completed_at=datetime.now(UTC), evaluation_status=EvaluationStatus.FAILED.value)
            )
            if changed.rowcount == 0:
                exists = connection.execute(
                    select(self._attempts.c.session_id).where(self._attempts.c.session_id == session_id)
                ).scalar_one_or_none()
                if exists is None:
                    raise AttemptNotFoundError(session_id)

    async def complete(self, session_id: str, ai_draft: SessionEvaluationResult) -> None:
        if ai_draft.session_id != session_id or ai_draft.review_status is not ReviewStatus.AI_DRAFT:
            raise ValueError("draft must match the attempt and remain provisional")
        self._ensure_schema()
        with self._engine.begin() as connection:
            attempt = connection.execute(
                select(self._attempts.c.scenario_id).where(self._attempts.c.session_id == session_id)
            ).scalar_one_or_none()
            if attempt is None:
                raise AttemptNotFoundError(session_id)
            if attempt != ai_draft.scenario_id:
                raise ValueError("draft scenario does not match the attempt")
            connection.execute(
                update(self._attempts)
                .where(self._attempts.c.session_id == session_id)
                .where(self._attempts.c.ai_draft_json.is_(None))
                .values(
                    completed_at=datetime.now(UTC),
                    evaluation_status=EvaluationStatus.COMPLETE.value,
                    ai_draft_json=ai_draft.model_dump_json(),
                )
            )

    async def history(self, advisor_id: str, scenario_id: str | None = None) -> list[AttemptSummary]:
        if not advisor_id.strip():
            raise ValueError("advisor_id must not be blank")
        self._ensure_schema()
        query = self._summary_query().where(
            self._attempts.c.advisor_id == advisor_id,
            self._attempts.c.completed_at.is_not(None),
        )
        if scenario_id is not None:
            query = query.where(self._attempts.c.scenario_id == scenario_id)
        query = query.order_by(self._attempts.c.completed_at.desc(), self._attempts.c.session_id.desc())
        with self._engine.connect() as connection:
            return [self._to_summary(row) for row in connection.execute(query).mappings()]

    async def owned_attempt(self, session_id: str, advisor_id: str) -> AttemptSummary:
        """Use the same not-found error for missing and other-advisor attempts."""
        if not advisor_id.strip():
            raise ValueError("advisor_id must not be blank")
        self._ensure_schema()
        query = self._summary_query().where(
            self._attempts.c.session_id == session_id,
            self._attempts.c.advisor_id == advisor_id,
        )
        with self._engine.connect() as connection:
            row = connection.execute(query).mappings().first()
        if row is None:
            raise AttemptNotFoundError(session_id)
        return self._to_summary(row)

    async def manager_attempt(self, session_id: str) -> AttemptSummary:
        """Caller must enforce manager role before invoking this method."""
        self._ensure_schema()
        query = self._summary_query().where(self._attempts.c.session_id == session_id)
        with self._engine.connect() as connection:
            row = connection.execute(query).mappings().first()
        if row is None:
            raise AttemptNotFoundError(session_id)
        return self._to_summary(row)

    async def review_details(self, session_id: str) -> ManagerReviewRecord | None:
        """Return the immutable AI draft and approved decision; manager-only caller."""
        self._ensure_schema()
        query = (
            select(
                self._attempts.c.ai_draft_json,
                self._reviews.c.manager_id,
                self._reviews.c.reviewed_at,
                self._reviews.c.change_reason,
                self._reviews.c.approved_result_json,
            )
            .select_from(self._attempts.join(self._reviews))
            .where(self._attempts.c.session_id == session_id)
        )
        with self._engine.connect() as connection:
            row = connection.execute(query).mappings().first()
        if row is None:
            return None
        return ManagerReviewRecord(
            session_id=session_id,
            manager_id=row.manager_id,
            reviewed_at=row.reviewed_at,
            change_reason=row.change_reason,
            ai_draft=SessionEvaluationResult.model_validate_json(row.ai_draft_json),
            approved_result=SessionEvaluationResult.model_validate_json(row.approved_result_json),
        )

    async def review_queue(self) -> list[AttemptSummary]:
        """Latest unreviewed completed attempt per advisor and scenario."""
        self._ensure_schema()
        query = (
            self._summary_query()
            .where(self._attempts.c.ai_draft_json.is_not(None))
            .where(self._reviews.c.session_id.is_(None))
            .order_by(self._attempts.c.completed_at.desc(), self._attempts.c.session_id.desc())
        )
        with self._engine.connect() as connection:
            rows = [self._to_summary(row) for row in connection.execute(query).mappings()]
        latest: dict[tuple[str, str], AttemptSummary] = {}
        for row in rows:
            latest.setdefault((row.advisor_id, row.scenario_id), row)
        return list(latest.values())

    async def manager_history(
        self, advisor_id: str | None = None, scenario_id: str | None = None, limit: int = 50, offset: int = 0
    ) -> list[AttemptSummary]:
        """Completed attempts, including older attempts hidden by the grouped review queue."""
        self._ensure_schema()
        query = self._summary_query().where(self._attempts.c.completed_at.is_not(None))
        if advisor_id:
            query = query.where(self._attempts.c.advisor_id == advisor_id)
        if scenario_id:
            query = query.where(self._attempts.c.scenario_id == scenario_id)
        query = query.order_by(self._attempts.c.completed_at.desc(), self._attempts.c.session_id.desc())
        with self._engine.connect() as connection:
            rows = connection.execute(query.limit(limit).offset(offset)).mappings()
            return [self._to_summary(row) for row in rows]

    async def team_overview(self) -> TeamOverview:
        """Summarize persisted results; skill scores use manager-approved evaluations only."""
        self._ensure_schema()
        query = self._summary_query().where(self._attempts.c.completed_at.is_not(None))
        with self._engine.connect() as connection:
            rows = list(connection.execute(query).mappings())
        approved = [row for row in rows if row.approved_result_json]
        pending = [row for row in rows if row.ai_draft_json and not row.approved_result_json]
        failed = [row for row in rows if row.evaluation_status == EvaluationStatus.FAILED.value]
        scores: dict[CriterionType, list[int]] = {criterion: [] for criterion in CriterionType}
        for row in approved:
            result = SessionEvaluationResult.model_validate_json(row.approved_result_json)
            for item in result.evaluations:
                if item.status is CriterionStatus.ASSESSED and item.score is not None:
                    scores[item.criterion].append(item.score)
        return TeamOverview(
            completed_attempts=len(rows),
            approved_attempts=len(approved),
            pending_attempts=len(pending),
            failed_evaluations=len(failed),
            active_advisors=len({row.advisor_id for row in rows}),
            skill_summaries=[
                SkillSummary(
                    criterion=criterion,
                    average_score=sum(values) / len(values),
                    assessed_count=len(values),
                )
                for criterion, values in scores.items()
                if values
            ],
        )

    async def list_assignments(self, advisor_id: str | None = None) -> list[AssignmentRecord]:
        self._ensure_schema()
        query = select(self._assignments)
        if advisor_id:
            query = query.where(self._assignments.c.advisor_id == advisor_id)
        query = query.order_by(self._assignments.c.created_at.desc())
        with self._engine.connect() as connection:
            rows = connection.execute(query).mappings().all()
            return [
                AssignmentRecord(
                    assignment_id=row.assignment_id,
                    title=row.title,
                    scenario_id=row.scenario_id,
                    scenario_title=row.scenario_title,
                    target_vehicle=row.target_vehicle,
                    advisor_id=row.advisor_id,
                    advisor_name=row.advisor_name,
                    manager_id=row.manager_id,
                    due_date=row.due_date,
                    status=row.status,
                    created_at=row.created_at.isoformat() if row.created_at else "",
                )
                for row in rows
            ]

    async def create_assignment(
        self, manager_id: str, payload: CreateAssignmentInput, scenario_title: str, advisor_name: str
    ) -> AssignmentRecord:
        self._ensure_schema()
        import uuid
        now = datetime.now(UTC)
        assignment_id = f"asg-{uuid.uuid4().hex[:8]}"
        with self._engine.begin() as connection:
            connection.execute(
                insert(self._assignments).values(
                    assignment_id=assignment_id,
                    title=payload.title,
                    scenario_id=payload.scenario_id,
                    scenario_title=scenario_title,
                    target_vehicle=payload.target_vehicle,
                    advisor_id=payload.advisor_id,
                    advisor_name=advisor_name,
                    manager_id=manager_id,
                    due_date=payload.due_date,
                    status="pending",
                    created_at=now,
                )
            )
        return AssignmentRecord(
            assignment_id=assignment_id,
            title=payload.title,
            scenario_id=payload.scenario_id,
            scenario_title=scenario_title,
            target_vehicle=payload.target_vehicle,
            advisor_id=payload.advisor_id,
            advisor_name=advisor_name,
            manager_id=manager_id,
            due_date=payload.due_date,
            status="pending",
            created_at=now.isoformat(),
        )

    async def list_advisors(self) -> list[AdvisorPerformanceView]:
        self._ensure_schema()
        query = self._summary_query().where(self._attempts.c.completed_at.is_not(None))
        with self._engine.connect() as connection:
            rows = list(connection.execute(query).mappings())

        grouped = {}
        for row in rows:
            grouped.setdefault(row.advisor_id, []).append(row)

        advisors = []
        for adv_id, adv_rows in grouped.items():
            completed = len(adv_rows)
            approved = [r for r in adv_rows if r.approved_result_json]
            scores = []
            for r in approved:
                res = SessionEvaluationResult.model_validate_json(r.approved_result_json)
                if res.overall_score is not None:
                    scores.append(res.overall_score)
            if not scores:
                for r in adv_rows:
                    if r.ai_draft_json:
                        res = SessionEvaluationResult.model_validate_json(r.ai_draft_json)
                        if res.overall_score is not None:
                            scores.append(res.overall_score)
            avg = sum(scores) / len(scores) if scores else None
            status = "top" if (avg and avg >= 2.5) else ("on_track" if (avg and avg >= 2.0) else "needs_attention")
            latest_dt = max((r.completed_at for r in adv_rows if r.completed_at), default=None)
            advisors.append(
                AdvisorPerformanceView(
                    advisor_id=adv_id,
                    advisor_name=adv_id,
                    completed_sessions=completed,
                    approved_sessions=len(approved),
                    average_score=round(avg, 1) if avg is not None else None,
                    latest_activity=latest_dt.isoformat() if latest_dt else None,
                    status=status,
                )
            )
        return advisors

    async def approve(self, session_id: str, manager_id: str, decision: ManagerReviewDecision) -> ManagerReviewRecord:
        if not manager_id.strip():
            raise ValueError("manager_id must not be blank")
        self._ensure_schema()
        with self._engine.begin() as connection:
            row = connection.execute(
                select(self._attempts.c.ai_draft_json, self._reviews.c.session_id)
                .select_from(self._attempts.outerjoin(self._reviews))
                .where(self._attempts.c.session_id == session_id)
            ).first()
            if row is None:
                raise AttemptNotFoundError(session_id)
            if row.ai_draft_json is None or row.session_id is not None:
                raise ReviewConflictError("attempt is unfinished or already reviewed")
            draft = SessionEvaluationResult.model_validate_json(row.ai_draft_json)
            approved = approved_evaluation(draft, decision)
            reviewed_at = datetime.now(UTC)
            try:
                connection.execute(
                    insert(self._reviews).values(
                        session_id=session_id,
                        manager_id=manager_id,
                        reviewed_at=reviewed_at,
                        change_reason=decision.change_reason.strip(),
                        approved_result_json=approved.model_dump_json(),
                    )
                )
            except IntegrityError as exc:
                raise ReviewConflictError("attempt is already reviewed") from exc
        return ManagerReviewRecord(
            session_id=session_id,
            manager_id=manager_id,
            reviewed_at=reviewed_at,
            change_reason=decision.change_reason.strip(),
            ai_draft=draft,
            approved_result=approved,
        )

    def _summary_query(self):
        return select(
            self._attempts.c.session_id,
            self._attempts.c.scenario_id,
            self._attempts.c.advisor_id,
            self._attempts.c.started_at,
            self._attempts.c.completed_at,
            self._attempts.c.evaluation_status,
            self._attempts.c.ai_draft_json,
            self._reviews.c.approved_result_json,
        ).select_from(self._attempts.outerjoin(self._reviews))

    @staticmethod
    def _to_summary(row) -> AttemptSummary:
        draft = SessionEvaluationResult.model_validate_json(row.ai_draft_json) if row.ai_draft_json else None
        approved = (
            SessionEvaluationResult.model_validate_json(row.approved_result_json) if row.approved_result_json else None
        )
        return AttemptSummary(
            session_id=row.session_id,
            scenario_id=row.scenario_id,
            advisor_id=row.advisor_id,
            started_at=row.started_at,
            completed_at=row.completed_at,
            evaluation_status=row.evaluation_status,
            review_status=(
                ReviewStatus.MANAGER_APPROVED
                if approved
                else ReviewStatus.PENDING_MANAGER_REVIEW
                if draft
                else ReviewStatus.AI_DRAFT
            ),
            ai_score=draft.overall_score if draft else None,
            approved_score=approved.overall_score if approved else None,
        )
