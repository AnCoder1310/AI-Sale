"""Tests for Copilot SSE Streaming endpoint."""

from types import SimpleNamespace
import pytest

from src.agents.copilot.runtime import CopilotAdmission
from src.agents.copilot.state import Citation, CopilotResponse
from src.api.copilot import current_copilot_user
from src.config import get_settings
from src.integrations.copilot_sessions import SQLCopilotSessionsRepository
from src.knowledge.index_readiness import load_snapshot
from src.main import app


@pytest.fixture
def sessions(tmp_path, monkeypatch):
    repository = SQLCopilotSessionsRepository(f"sqlite:///{tmp_path / 'stream_test.db'}")
    monkeypatch.setattr(app.state, "copilot_sessions", repository)
    monkeypatch.setattr(app.state, "copilot_readiness", load_snapshot)
    monkeypatch.setattr(app.state, "copilot_admission", CopilotAdmission(get_settings()))
    yield repository
    repository.engine.dispose()


@pytest.fixture
def owner():
    identity = SimpleNamespace(user_id="sales-stream-tester")

    async def authenticated():
        return identity

    app.dependency_overrides[current_copilot_user] = authenticated
    yield identity
    app.dependency_overrides.pop(current_copilot_user, None)


@pytest.mark.asyncio
async def test_stream_requires_authentication(client):
    response = await client.post("/api/v1/copilot/query/stream", json={"query": "VF 5?"})
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_stream_returns_sse_events(client, sessions, owner, monkeypatch):
    async def mock_graph(state, **kwargs):
        return {
            "final_response": CopilotResponse(
                status="answered",
                answer="Giá VF 5 Plus là 496 triệu đồng [C1].",
                citations=[
                    Citation(
                        citation_id="C1",
                        document_id="vf5_specs",
                        chunk_id="chunk-1",
                        title="Bảng giá VF 5 Plus",
                        excerpt="Giá 496 triệu",
                    )
                ],
            )
        }

    monkeypatch.setattr("src.api.copilot.copilot_agent.ainvoke", mock_graph)

    resp = await client.post(
        "/api/v1/copilot/query/stream",
        json={"query": "VF 5 Plus giá bao nhiêu?", "domain": "specs"},
    )
    assert resp.status_code == 200
    assert "text/event-stream" in resp.headers["content-type"]

    body = resp.text
    assert "event: status" in body
    assert "event: delta" in body
    assert "event: final" in body
    assert "event: done" in body
    assert "496 triệu đồng" in body
