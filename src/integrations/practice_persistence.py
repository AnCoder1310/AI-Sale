"""Database-backed persistence adapters for Practice sessions."""

from __future__ import annotations

import json
from datetime import UTC, datetime
from threading import Lock
from typing import Any

from sqlalchemy import Column, DateTime, MetaData, String, Table, Text, create_engine, insert, select, update
from sqlalchemy.engine import Engine


def normalize_database_url(database_url: str) -> str:
    """Select the psycopg v3 dialect for common hosted PostgreSQL URLs."""
    if database_url.startswith("postgres://"):
        return "postgresql+psycopg://" + database_url.removeprefix("postgres://")
    if database_url.startswith("postgresql://"):
        return "postgresql+psycopg://" + database_url.removeprefix("postgresql://")
    return database_url


class SQLCheckpointRepository:
    """Persist validated role-play state as JSON behind the checkpoint contract."""

    def __init__(self, database_url: str, *, engine: Engine | None = None) -> None:
        self._engine = engine or create_engine(normalize_database_url(database_url), pool_pre_ping=True)
        self._metadata = MetaData()
        self._table = Table(
            "practice_checkpoints",
            self._metadata,
            # Session IDs are generated UUIDs, but the wider contract permits up to 120 chars.
            Column("session_id", String(120), primary_key=True),
            Column("state_json", Text, nullable=False),
            Column("updated_at", DateTime(timezone=True), nullable=False),
        )
        self._schema_ready = False
        self._schema_lock = Lock()

    def _ensure_schema(self) -> None:
        if self._schema_ready:
            return
        with self._schema_lock:
            if not self._schema_ready:
                self._metadata.create_all(self._engine)
                self._schema_ready = True

    async def save(self, session_id: str, state: dict[str, Any]) -> None:
        if not session_id.strip():
            raise ValueError("session_id must not be blank")
        payload = json.dumps(state, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
        now = datetime.now(UTC)
        self._ensure_schema()
        with self._engine.begin() as connection:
            exists = connection.execute(
                select(self._table.c.session_id).where(self._table.c.session_id == session_id)
            ).first()
            if exists is None:
                connection.execute(
                    insert(self._table).values(session_id=session_id, state_json=payload, updated_at=now)
                )
            else:
                connection.execute(
                    update(self._table)
                    .where(self._table.c.session_id == session_id)
                    .values(state_json=payload, updated_at=now)
                )

    async def load(self, session_id: str) -> dict[str, Any] | None:
        if not session_id.strip():
            raise ValueError("session_id must not be blank")
        self._ensure_schema()
        with self._engine.connect() as connection:
            payload = connection.execute(
                select(self._table.c.state_json).where(self._table.c.session_id == session_id)
            ).scalar_one_or_none()
        if payload is None:
            return None
        loaded = json.loads(payload)
        if not isinstance(loaded, dict):
            raise ValueError("stored practice checkpoint must be a JSON object")
        return loaded
