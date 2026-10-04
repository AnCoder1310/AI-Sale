from pathlib import Path

import pytest

from src.integrations.practice_persistence import SQLCheckpointRepository, normalize_database_url


def test_normalize_database_url_selects_psycopg_v3_for_hosted_postgres():
    assert normalize_database_url("postgres://user:pass@db/app") == "postgresql+psycopg://user:pass@db/app"
    assert normalize_database_url("postgresql://user:pass@db/app") == "postgresql+psycopg://user:pass@db/app"
    assert normalize_database_url("sqlite:///data/app.db") == "sqlite:///data/app.db"


@pytest.mark.asyncio
async def test_checkpoint_survives_repository_recreation(tmp_path: Path):
    database_url = f"sqlite:///{tmp_path / 'practice.db'}"
    first = SQLCheckpointRepository(database_url)
    await first.save("session-1", {"session_id": "session-1", "messages": [{"content": "Xin chào"}]})

    second = SQLCheckpointRepository(database_url)
    loaded = await second.load("session-1")

    assert loaded == {"session_id": "session-1", "messages": [{"content": "Xin chào"}]}


@pytest.mark.asyncio
async def test_checkpoint_upsert_replaces_previous_state(tmp_path: Path):
    repository = SQLCheckpointRepository(f"sqlite:///{tmp_path / 'practice.db'}")
    await repository.save("session-1", {"turn_count": 1})
    await repository.save("session-1", {"turn_count": 2})

    assert await repository.load("session-1") == {"turn_count": 2}
    assert await repository.load("missing") is None


@pytest.mark.asyncio
async def test_checkpoint_rejects_blank_session_id(tmp_path: Path):
    repository = SQLCheckpointRepository(f"sqlite:///{tmp_path / 'practice.db'}")

    with pytest.raises(ValueError, match="must not be blank"):
        await repository.save(" ", {})
    with pytest.raises(ValueError, match="must not be blank"):
        await repository.load("")
