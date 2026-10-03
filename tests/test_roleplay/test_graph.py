import asyncio
from copy import deepcopy
from pathlib import Path

import pytest

from src.agents.roleplay.customer_agent import CustomerAgent, CustomerResponseError
from src.agents.roleplay.graph import (
    RoleplayGraph,
    RoleplaySessionConflictError,
    RoleplaySessionNotFoundError,
)
from src.agents.roleplay.scenario_loader import ScenarioRepository
from src.agents.roleplay.state import EvaluationStatus, RoleplayState, TerminationStatus
from src.agents.roleplay.turn_analyzer import TurnAnalyzer

SCENARIOS = Path("data/scenarios/scenarios.json")


class InMemoryCheckpoint:
    def __init__(self):
        self.states = {}
        self.save_count = 0

    async def save(self, session_id, state):
        self.states[session_id] = deepcopy(state)
        self.save_count += 1

    async def load(self, session_id):
        state = self.states.get(session_id)
        return deepcopy(state) if state is not None else None


class QueueCustomerModel:
    def __init__(self, outputs):
        self.outputs = list(outputs)
        self.calls = []

    async def generate(self, *, system_prompt, context):
        self.calls.append({"system_prompt": system_prompt, "context": context})
        return self.outputs.pop(0)


class QueueAnalysisModel:
    def __init__(self, outputs):
        self.outputs = list(outputs)
        self.calls = []

    async def analyze(self, advisor_message, scenario, state):
        self.calls.append(advisor_message)
        return self.outputs.pop(0)


def build_graph(customer_outputs, analysis_outputs):
    checkpoint = InMemoryCheckpoint()
    customer_model = QueueCustomerModel(customer_outputs)
    analysis_model = QueueAnalysisModel(analysis_outputs)
    graph = RoleplayGraph(
        ScenarioRepository(SCENARIOS),
        TurnAnalyzer(analysis_model),
        CustomerAgent(customer_model),
        checkpoint,
    )
    return graph, checkpoint, customer_model, analysis_model


@pytest.mark.asyncio
async def test_start_creates_session_and_is_idempotent():
    graph, checkpoint, customer_model, _ = build_graph(
        [{"reply": "Anh đang cân nhắc đổi sang xe điện."}],
        [],
    )

    first = await graph.start("session-1", "SCENARIO_01_VF5_TAXI")
    second = await graph.start("session-1", "SCENARIO_01_VF5_TAXI")

    assert first == second
    assert first["session_id"] == "session-1"
    assert first["messages"][0]["role"] == "customer"
    assert len(customer_model.calls) == 1
    assert checkpoint.save_count == 2


@pytest.mark.asyncio
async def test_continue_session_updates_state_and_preserves_history():
    graph, checkpoint, _, analysis_model = build_graph(
        [
            {"reply": "Anh đang cân nhắc đổi sang xe điện."},
            {"reply": "Mỗi ngày anh chạy khoảng 180 cây số."},
        ],
        [
            {
                "detected_intents": ["ask_daily_travel_distance"],
                "discovered_fact_ids": ["daily_distance"],
                "current_topic": "daily_usage",
            }
        ],
    )
    await graph.start("session-1", "SCENARIO_01_VF5_TAXI")

    result = await graph.continue_session(
        "session-1",
        "Mỗi ngày anh thường chạy khoảng bao nhiêu km?",
    )

    saved = RoleplayState.model_validate(await checkpoint.load("session-1"))
    assert result["turn_count"] == 1
    assert [message["role"] for message in result["messages"]] == [
        "customer",
        "advisor",
        "customer",
    ]
    assert saved.revealed_facts == ["daily_distance"]
    assert saved.current_topic == "daily_usage"
    assert analysis_model.calls == ["Mỗi ngày anh thường chạy khoảng bao nhiêu km?"]


@pytest.mark.asyncio
async def test_session_keeps_five_advisor_turns_of_history():
    customer_outputs = [
        {"reply": "Anh muốn tìm hiểu xe."},
        *[{"reply": f"Phản hồi khách hàng {index}."} for index in range(1, 6)],
    ]
    graph, checkpoint, _, _ = build_graph(
        customer_outputs,
        [{} for _ in range(5)],
    )
    await graph.start("session-1", "SCENARIO_01_VF5_TAXI")

    for index in range(1, 6):
        await asyncio.wait_for(
            graph.continue_session("session-1", f"Tin nhắn tư vấn {index}"),
            timeout=2,
        )

    saved = RoleplayState.model_validate(await checkpoint.load("session-1"))
    assert saved.turn_count == 5
    assert len(saved.messages) == 11
    assert [message.content for message in saved.messages if message.role == "advisor"] == [
        f"Tin nhắn tư vấn {index}" for index in range(1, 6)
    ]


@pytest.mark.asyncio
async def test_explicit_finish_skips_another_customer_generation():
    graph, checkpoint, customer_model, _ = build_graph(
        [{"reply": "Anh muốn tìm hiểu xe."}],
        [{"advisor_requested_finish": True}],
    )
    await graph.start("session-1", "SCENARIO_01_VF5_TAXI")

    result = await graph.continue_session("session-1", "Kết thúc bài luyện tập.")

    saved = RoleplayState.model_validate(await checkpoint.load("session-1"))
    assert result["termination_status"] == TerminationStatus.ADVISOR_ENDED.value
    assert saved.termination_status is TerminationStatus.ADVISOR_ENDED
    assert len(customer_model.calls) == 1


@pytest.mark.asyncio
async def test_finish_freezes_session_without_adding_a_fake_advisor_message():
    graph, checkpoint, customer_model, analysis_model = build_graph(
        [{"reply": "Anh muốn tìm hiểu xe."}],
        [],
    )
    await graph.start("session-1", "SCENARIO_01_VF5_TAXI")

    first = await graph.finish_session("session-1")
    saves_after_first_finish = checkpoint.save_count
    second = await graph.finish_session("session-1")

    assert first.termination_status is TerminationStatus.ADVISOR_ENDED
    assert first.evaluation_status is EvaluationStatus.PENDING
    assert second == first
    assert checkpoint.save_count == saves_after_first_finish
    assert [message.role for message in first.messages] == ["customer"]
    assert len(customer_model.calls) == 1
    with pytest.raises(RoleplaySessionConflictError):
        await graph.continue_session("session-1", "Một tin nhắn sau khi kết thúc")
    assert analysis_model.calls == []


@pytest.mark.asyncio
async def test_finish_accepts_session_already_ended_by_turn_limit():
    graph, checkpoint, _, _ = build_graph(
        [{"reply": "Anh muốn tìm hiểu xe."}],
        [{"advisor_requested_finish": True}],
    )
    await graph.start("session-1", "SCENARIO_01_VF5_TAXI")
    await graph.continue_session("session-1", "Kết thúc bài luyện tập.")

    finished = await graph.finish_session("session-1")

    assert finished.termination_status is TerminationStatus.ADVISOR_ENDED
    assert finished.evaluation_status is EvaluationStatus.PENDING
    assert len(RoleplayState.model_validate(await checkpoint.load("session-1")).messages) == 2


@pytest.mark.asyncio
async def test_customer_provider_failure_does_not_lose_advisor_turn():
    graph, checkpoint, _, _ = build_graph(
        [
            {"reply": "Anh muốn tìm hiểu xe."},
            {"reply": "", "unexpected": "field"},
        ],
        [{}],
    )
    await graph.start("session-1", "SCENARIO_01_VF5_TAXI")

    with pytest.raises(CustomerResponseError):
        await graph.continue_session("session-1", "Anh cần em tư vấn thêm.")

    saved = RoleplayState.model_validate(await checkpoint.load("session-1"))
    assert saved.turn_count == 1
    assert saved.messages[-1].role == "advisor"
    assert saved.messages[-1].content == "Anh cần em tư vấn thêm."


@pytest.mark.asyncio
async def test_unknown_session_has_a_domain_specific_error():
    graph, _, _, _ = build_graph([], [])

    with pytest.raises(RoleplaySessionNotFoundError, match="unknown session_id"):
        await graph.continue_session("missing", "Xin chào")


@pytest.mark.asyncio
async def test_session_id_cannot_be_reused_for_another_scenario():
    graph, _, _, _ = build_graph(
        [{"reply": "Anh muốn tìm hiểu xe."}],
        [],
    )
    await graph.start("session-1", "SCENARIO_01_VF5_TAXI")

    with pytest.raises(RoleplaySessionConflictError, match="different scenario"):
        await graph.start("session-1", "SCENARIO_02_VF7_VS_CX5")
