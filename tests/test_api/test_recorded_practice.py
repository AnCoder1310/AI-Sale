"""Protected router contract with a test-only identity dependency."""

import httpx
import pytest
from fastapi import FastAPI, Header, HTTPException

from src.agents.roleplay.scenario_loader import ScenarioRepository
from src.api.auth import CurrentUserDependency, create_auth_router
from src.api.recorded_practice import create_recorded_practice_routers
from src.config import Settings
from src.integrations.auth_repository import SQLAuthRepository
from src.integrations.practice_records import SQLPracticeRecordsRepository
from src.models.auth import AuthenticatedUser, UserRole
from src.models.evaluation import CriterionType, SessionEvaluationResult
from src.services.auth import AuthService
from src.services.practice import PracticeEvaluationUnavailableError, PracticeResultView, PracticeSessionView
from src.services.recorded_practice import RecordedPracticeService


class StubPractice:
    def __init__(self):
        self.sessions = {}
        self.counter = 0

    def list_scenarios(self):
        return ScenarioRepository().list_public()

    async def start_session(self, scenario_id, max_turns=None):
        self.counter += 1
        session_id = f"session-{self.counter}"
        session = PracticeSessionView(
            session_id=session_id,
            scenario_id=scenario_id,
            difficulty="Medium",
            conversation_stage="opening",
            turn_count=0,
            max_turns=max_turns or 10,
            visible_context="Customer asks about a car.",
            termination_status="active",
            messages=[],
        )
        self.sessions[session_id] = session
        return session

    async def get_session(self, session_id):
        return self.sessions[session_id]

    async def retry_customer_reply(self, session_id):
        session = self.sessions[session_id]
        session.pending_customer_reply = False
        return session

    async def get_result(self, session_id):
        return PracticeResultView(session_id=session_id, evaluation_status="not_started")

    async def finish_session(self, session_id):
        raise PracticeEvaluationUnavailableError("Evaluator is unavailable")


async def fake_identity(x_test_identity: str | None = Header(None)) -> AuthenticatedUser:
    if not x_test_identity:
        raise HTTPException(status_code=401, detail="Authentication required.")
    user_id, role = x_test_identity.split(":", 1)
    return AuthenticatedUser(
        user_id=user_id,
        username=f"{user_id}.test",
        display_name=user_id,
        role=role,
    )


@pytest.mark.asyncio
async def test_history_and_review_routes_enforce_identity_and_ownership(tmp_path):
    records = SQLPracticeRecordsRepository(f"sqlite:///{tmp_path / 'records.db'}")
    service = RecordedPracticeService(StubPractice(), records)
    practice_router, manager_router = create_recorded_practice_routers(service, fake_identity)
    app = FastAPI()
    app.include_router(practice_router, prefix="/api/v1")
    app.include_router(manager_router, prefix="/api/v1")
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        assert (await client.get("/api/v1/practice/history")).status_code == 401
        created = await client.post(
            "/api/v1/practice/sessions",
            headers={"X-Test-Identity": "advisor-a:advisor"},
            json={"scenario_id": "SCENARIO_01_VF5_TAXI", "max_turns": 15},
        )
        assert created.status_code == 201
        assert created.json()["max_turns"] == 15
        session_id = created.json()["session_id"]
        # Ownership exists at start, but history only lists finished/evaluated attempts.
        await records.complete(session_id, draft_for(session_id))
        own = await client.get("/api/v1/practice/history", headers={"X-Test-Identity": "advisor-a:advisor"})
        other = await client.get("/api/v1/practice/history", headers={"X-Test-Identity": "advisor-b:advisor"})
        assert [item["session_id"] for item in own.json()] == [session_id]
        assert other.json() == []
        assert (
            await client.get(f"/api/v1/practice/{session_id}/attempt", headers={"X-Test-Identity": "advisor-b:advisor"})
        ).status_code == 404
        assert (
            await client.get("/api/v1/manager/reviews", headers={"X-Test-Identity": "advisor-a:advisor"})
        ).status_code == 403
        assert (
            await client.get("/api/v1/practice/history", headers={"X-Test-Identity": "manager-a:manager"})
        ).status_code == 403
        manager_queue = await client.get("/api/v1/manager/reviews", headers={"X-Test-Identity": "manager-a:manager"})
        assert [item["session_id"] for item in manager_queue.json()] == [session_id]


@pytest.mark.asyncio
async def test_pending_reply_retry_is_owner_only(tmp_path):
    records = SQLPracticeRecordsRepository(f"sqlite:///{tmp_path / 'records.db'}")
    stub = StubPractice()
    service = RecordedPracticeService(stub, records)
    practice_router, _ = create_recorded_practice_routers(service, fake_identity)
    app = FastAPI()
    app.include_router(practice_router, prefix="/api/v1")
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        created = await client.post(
            "/api/v1/practice/sessions",
            headers={"X-Test-Identity": "advisor-a:advisor"},
            json={"scenario_id": "SCENARIO_01_VF5_TAXI"},
        )
        session_id = created.json()["session_id"]
        stub.sessions[session_id].pending_customer_reply = True
        route = f"/api/v1/practice/{session_id}/retry-reply"
        assert (await client.post(route, headers={"X-Test-Identity": "advisor-b:advisor"})).status_code == 404
        assert (await client.post(route, headers={"X-Test-Identity": "manager-a:manager"})).status_code == 403
        own = await client.post(route, headers={"X-Test-Identity": "advisor-a:advisor"})
        assert own.status_code == 200
        assert own.json()["pending_customer_reply"] is False


@pytest.mark.asyncio
async def test_manager_can_review_finished_attempt_once_and_advisor_sees_result(tmp_path):
    records = SQLPracticeRecordsRepository(f"sqlite:///{tmp_path / 'records.db'}")
    service = RecordedPracticeService(StubPractice(), records)
    practice_router, manager_router = create_recorded_practice_routers(service, fake_identity)
    app = FastAPI()
    app.include_router(practice_router, prefix="/api/v1")
    app.include_router(manager_router, prefix="/api/v1")
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        created = await client.post(
            "/api/v1/practice/sessions",
            headers={"X-Test-Identity": "advisor-a:advisor"},
            json={"scenario_id": "SCENARIO_01_VF5_TAXI"},
        )
        session_id = created.json()["session_id"]
        await records.complete(session_id, draft_for(session_id))
        assert [
            item["session_id"]
            for item in (
                await client.get("/api/v1/manager/reviews", headers={"X-Test-Identity": "manager-a:manager"})
            ).json()
        ] == [session_id]
        approved = await client.patch(
            f"/api/v1/manager/reviews/{session_id}",
            headers={"X-Test-Identity": "manager-a:manager"},
            json={"score_overrides": {"need_discovery": 2}, "change_reason": "Follow-up was strong."},
        )
        assert approved.status_code == 200
        assert approved.json()["ai_draft"]["overall_score"] == 3
        assert approved.json()["approved_result"]["overall_score"] == 2
        assert (
            await client.patch(
                f"/api/v1/manager/reviews/{session_id}",
                headers={"X-Test-Identity": "manager-a:manager"},
                json={"change_reason": "Duplicate."},
            )
        ).status_code == 409
        history = await client.get("/api/v1/practice/history", headers={"X-Test-Identity": "advisor-a:advisor"})
        assert history.json()[0]["review_status"] == "manager_approved"


@pytest.mark.asyncio
async def test_failed_evaluation_attempt_remains_in_history_but_not_review_queue(tmp_path):
    records = SQLPracticeRecordsRepository(f"sqlite:///{tmp_path / 'records.db'}")
    service = RecordedPracticeService(StubPractice(), records)
    practice_router, manager_router = create_recorded_practice_routers(service, fake_identity)
    app = FastAPI()
    app.include_router(practice_router, prefix="/api/v1")
    app.include_router(manager_router, prefix="/api/v1")
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        created = await client.post(
            "/api/v1/practice/sessions",
            headers={"X-Test-Identity": "advisor-a:advisor"},
            json={"scenario_id": "SCENARIO_01_VF5_TAXI"},
        )
        session_id = created.json()["session_id"]
        failed = await client.post(
            f"/api/v1/practice/{session_id}/finish", headers={"X-Test-Identity": "advisor-a:advisor"}
        )
        assert failed.status_code == 503
        history = await client.get("/api/v1/practice/history", headers={"X-Test-Identity": "advisor-a:advisor"})
        assert history.json()[0]["evaluation_status"] == "failed"
        queue = await client.get("/api/v1/manager/reviews", headers={"X-Test-Identity": "manager-a:manager"})
        assert queue.json() == []


def draft_for(session_id: str) -> SessionEvaluationResult:
    evaluations = [
        {
            "criterion": criterion,
            "status": "assessed" if criterion is CriterionType.NEED_DISCOVERY else "unassessed",
            "score": 3 if criterion is CriterionType.NEED_DISCOVERY else None,
            "evidence": (
                [{"message_id": "a-1", "quote": "What matters most?"}]
                if criterion is CriterionType.NEED_DISCOVERY
                else []
            ),
            "reason": "Transcript checked.",
        }
        for criterion in CriterionType
    ]
    return SessionEvaluationResult(
        session_id=session_id,
        scenario_id="SCENARIO_01_VF5_TAXI",
        rubric_version="test-v1",
        assessed_criteria_count=1,
        overall_score=3,
        evaluations=evaluations,
    )


@pytest.mark.asyncio
async def test_real_auth_cookie_is_used_for_practice_ownership_and_manager_access(tmp_path):
    database_url = f"sqlite:///{tmp_path / 'vertical.db'}"
    settings = Settings(
        _env_file=None,
        database_url=database_url,
        embedding_provider="hash",
        app_env="test",
    )
    auth = AuthService(SQLAuthRepository(database_url))
    for user_id, username, role in (
        ("advisor-a", "advisor.a", UserRole.ADVISOR),
        ("advisor-b", "advisor.b", UserRole.ADVISOR),
        ("manager-a", "manager.a", UserRole.MANAGER),
    ):
        await auth.seed_user(
            user_id=user_id,
            username=username,
            display_name=user_id,
            role=role,
            password="correct horse battery staple",
        )
    records = SQLPracticeRecordsRepository(database_url)
    service = RecordedPracticeService(StubPractice(), records)
    current_user = CurrentUserDependency(auth, settings.auth_cookie_name)
    practice_router, manager_router = create_recorded_practice_routers(service, current_user)
    app = FastAPI()
    app.include_router(create_auth_router(auth, settings), prefix="/api/v1")
    app.include_router(practice_router, prefix="/api/v1")
    app.include_router(manager_router, prefix="/api/v1")

    transport = httpx.ASGITransport(app=app)
    async with (
        httpx.AsyncClient(transport=transport, base_url="http://test") as advisor_a,
        httpx.AsyncClient(transport=transport, base_url="http://test") as advisor_b,
        httpx.AsyncClient(transport=transport, base_url="http://test") as manager,
    ):
        for client, username in (
            (advisor_a, "advisor.a"),
            (advisor_b, "advisor.b"),
            (manager, "manager.a"),
        ):
            response = await client.post(
                "/api/v1/auth/login",
                json={"username": username, "password": "correct horse battery staple"},
            )
            assert response.status_code == 200

        created = await advisor_a.post(
            "/api/v1/practice/sessions",
            json={"scenario_id": "SCENARIO_01_VF5_TAXI"},
        )
        assert created.status_code == 201
        session_id = created.json()["session_id"]
        await records.complete(session_id, draft_for(session_id))

        assert [item["session_id"] for item in (await advisor_a.get("/api/v1/practice/history")).json()] == [session_id]
        assert (await advisor_b.get("/api/v1/practice/history")).json() == []
        assert (await advisor_b.get(f"/api/v1/practice/{session_id}/attempt")).status_code == 404
        assert (await advisor_a.get("/api/v1/manager/reviews")).status_code == 403
        assert (await manager.get("/api/v1/practice/history")).status_code == 403
        assert [item["session_id"] for item in (await manager.get("/api/v1/manager/reviews")).json()] == [session_id]
        assert (await manager.get(f"/api/v1/manager/reviews/{session_id}")).status_code == 200
