from datetime import UTC, datetime, timedelta

import pytest

from src.integrations.auth_repository import SQLAuthRepository
from src.models.auth import UserRole
from src.services.auth import AuthenticationRequiredError, AuthService, InvalidCredentialsError


class MutableClock:
    def __init__(self, current: datetime) -> None:
        self.current = current

    def __call__(self) -> datetime:
        return self.current


@pytest.mark.asyncio
async def test_login_persists_only_hashed_token_and_survives_repository_restart(tmp_path):
    database_url = f"sqlite:///{tmp_path / 'auth.db'}"
    token = "raw-session-token"
    service = AuthService(SQLAuthRepository(database_url), token_factory=lambda: token)
    await service.seed_user(
        user_id="advisor-1",
        username="Advisor.One",
        display_name="Advisor One",
        role=UserRole.ADVISOR,
        password="correct horse battery staple",
    )

    returned_token, user = await service.login("ADVISOR.ONE", "correct horse battery staple")

    assert returned_token == token
    assert user.model_dump() == {
        "user_id": "advisor-1",
        "username": "advisor.one",
        "display_name": "Advisor One",
        "role": UserRole.ADVISOR,
    }
    restarted_service = AuthService(SQLAuthRepository(database_url))
    assert (await restarted_service.current_user(token)).user_id == "advisor-1"
    database_bytes = (tmp_path / "auth.db").read_bytes()
    assert token.encode() not in database_bytes
    assert AuthService.hash_token(token).encode() in database_bytes


@pytest.mark.asyncio
async def test_invalid_credentials_have_one_generic_error(tmp_path):
    service = AuthService(SQLAuthRepository(f"sqlite:///{tmp_path / 'auth.db'}"))
    await service.seed_user(
        user_id="advisor-1",
        username="advisor.one",
        display_name="Advisor One",
        role=UserRole.ADVISOR,
        password="correct horse battery staple",
    )

    with pytest.raises(InvalidCredentialsError, match="invalid username or password"):
        await service.login("missing", "wrong password")
    with pytest.raises(InvalidCredentialsError, match="invalid username or password"):
        await service.login("advisor.one", "wrong password")


@pytest.mark.asyncio
async def test_expired_and_logged_out_sessions_are_rejected(tmp_path):
    clock = MutableClock(datetime(2026, 10, 3, tzinfo=UTC))
    service = AuthService(
        SQLAuthRepository(f"sqlite:///{tmp_path / 'auth.db'}"),
        session_ttl=timedelta(hours=1),
        clock=clock,
        token_factory=lambda: "expiring-token",
    )
    await service.seed_user(
        user_id="manager-1",
        username="manager.one",
        display_name="Manager One",
        role=UserRole.MANAGER,
        password="correct horse battery staple",
    )
    token, _ = await service.login("manager.one", "correct horse battery staple")
    clock.current += timedelta(hours=2)
    with pytest.raises(AuthenticationRequiredError):
        await service.current_user(token)

    service._token_factory = lambda: "logout-token"
    token, _ = await service.login("manager.one", "correct horse battery staple")
    await service.logout(token)
    with pytest.raises(AuthenticationRequiredError):
        await service.current_user(token)


@pytest.mark.asyncio
async def test_reseeding_account_invalidates_existing_sessions(tmp_path):
    database_url = f"sqlite:///{tmp_path / 'auth.db'}"
    service = AuthService(SQLAuthRepository(database_url), token_factory=lambda: "old-token")
    account = {
        "user_id": "advisor-1",
        "username": "advisor.one",
        "display_name": "Advisor One",
        "role": UserRole.ADVISOR,
    }
    await service.seed_user(**account, password="first secure password")
    old_token, _ = await service.login("advisor.one", "first secure password")
    await service.seed_user(**account, password="second secure password")

    with pytest.raises(AuthenticationRequiredError):
        await service.current_user(old_token)
    with pytest.raises(InvalidCredentialsError):
        await service.login("advisor.one", "first secure password")
    _, user = await service.login("advisor.one", "second secure password")
    assert user.role is UserRole.ADVISOR


@pytest.mark.asyncio
async def test_assignment_directory_lists_only_advisors_without_password_data(tmp_path):
    service = AuthService(SQLAuthRepository(f"sqlite:///{tmp_path / 'auth.db'}"))
    for user_id, role in (("advisor-1", UserRole.ADVISOR), ("manager-1", UserRole.MANAGER)):
        await service.seed_user(
            user_id=user_id,
            username=user_id,
            display_name=user_id,
            role=role,
            password="correct horse battery staple",
        )
    advisors = await service.active_advisors()
    assert [user.user_id for user in advisors] == ["advisor-1"]
    assert "password_hash" not in advisors[0].model_dump()
    assert (await service.active_advisor("advisor-1")).user_id == "advisor-1"
    assert await service.active_advisor("manager-1") is None
