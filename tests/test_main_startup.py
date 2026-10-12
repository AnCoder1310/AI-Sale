"""Production startup must not wait indefinitely for first-time knowledge ingestion."""

import asyncio
from types import SimpleNamespace

import pytest

from src import main


@pytest.mark.asyncio
async def test_production_startup_times_out_on_ingestion(monkeypatch: pytest.MonkeyPatch) -> None:
    class AuthStub:
        async def bootstrap_manager(self, **_kwargs):
            return False

    async def slow_ingestion(*_args, **_kwargs):
        await asyncio.sleep(10)

    settings = SimpleNamespace(
        app_name="test",
        app_env="production",
        bootstrap_manager_username="manager",
        bootstrap_manager_display_name="Manager",
        bootstrap_manager_password="test-password",
        knowledge_startup_timeout_seconds=0.01,
    )
    retriever = SimpleNamespace(vector_store=SimpleNamespace(count=lambda: 0), ingest_corpus=lambda **_kwargs: 1)
    monkeypatch.setattr(main, "get_settings", lambda: settings)
    monkeypatch.setattr(main, "auth_service", AuthStub())
    monkeypatch.setattr(main, "get_retrieval_service", lambda: retriever)
    monkeypatch.setattr(main.asyncio, "to_thread", slow_ingestion)

    with pytest.raises(TimeoutError):
        async with main.lifespan(main.app):
            pass
