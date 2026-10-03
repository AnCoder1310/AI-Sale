from datetime import timedelta

import httpx
import pytest
from fastapi import FastAPI

from src.api.auth import create_auth_router
from src.config import Settings
from src.integrations.auth_repository import SQLAuthRepository
from src.models.auth import UserRole
from src.services.auth import AuthService


async def build_test_app(tmp_path, *, secure_cookie: bool = False) -> FastAPI:
    settings = Settings(
        database_url=f"sqlite:///{tmp_path / 'auth.db'}",
        auth_cookie_secure=secure_cookie,
        embedding_provider="hash",
        app_env="test",
    )
    service = AuthService(SQLAuthRepository(settings.database_url), session_ttl=timedelta(hours=2))
    await service.seed_user(
        user_id="advisor-1",
        username="advisor.one",
        display_name="Advisor One",
        role=UserRole.ADVISOR,
        password="correct horse battery staple",
    )
    app = FastAPI()
    app.include_router(create_auth_router(service, settings), prefix="/api/v1")
    return app


@pytest.mark.asyncio
async def test_login_me_logout_cookie_flow(tmp_path):
    app = await build_test_app(tmp_path)
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        assert (await client.get("/api/v1/auth/me")).status_code == 401
        rejected = await client.post(
            "/api/v1/auth/login",
            json={"username": "advisor.one", "password": "wrong password"},
        )
        assert rejected.status_code == 401
        assert rejected.json() == {"detail": "Invalid username or password."}

        login = await client.post(
            "/api/v1/auth/login",
            json={"username": " Advisor.One ", "password": "correct horse battery staple"},
        )
        assert login.status_code == 200
        assert login.json() == {
            "user_id": "advisor-1",
            "username": "advisor.one",
            "display_name": "Advisor One",
            "role": "advisor",
        }
        cookie = login.headers["set-cookie"].lower()
        assert "httponly" in cookie
        assert "samesite=lax" in cookie
        assert "secure" not in cookie
        assert (await client.get("/api/v1/auth/me")).json()["user_id"] == "advisor-1"

        logout = await client.post("/api/v1/auth/logout")
        assert logout.status_code == 204
        assert logout.content == b""
        assert (await client.get("/api/v1/auth/me")).status_code == 401


@pytest.mark.asyncio
async def test_production_cookie_can_be_marked_secure(tmp_path):
    app = await build_test_app(tmp_path, secure_cookie=True)
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="https://test") as client:
        login = await client.post(
            "/api/v1/auth/login",
            json={"username": "advisor.one", "password": "correct horse battery staple"},
        )
        assert "secure" in login.headers["set-cookie"].lower()
