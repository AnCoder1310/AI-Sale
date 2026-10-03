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
        return {"raised_objection_id": None, "decision": "reply", **self.outputs.pop(0)}


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
    assert saved.spoken_fact_message_ids["daily_distance"] == saved.messages[-1].message_id
    assert "180" in saved.messages[-1].content
    assert saved.current_topic == "daily_usage"
    assert analysis_model.calls == ["Mỗi ngày anh thường chạy khoảng bao nhiêu km?"]


@pytest.mark.asyncio
async def test_customer_discloses_mileage_once_before_claiming_it_was_spoken():
    graph, checkpoint, customer_model, _ = build_graph(
        [{"reply": "Anh đang xem VF 5."}, {"reply": "Anh muốn tính tiếp."}],
        [
            {"detected_intents": ["ask_daily_travel_distance"], "discovered_fact_ids": ["daily_distance"]},
            {},
        ],
    )
    await graph.start("session-1", "SCENARIO_01_VF5_TAXI")
    first = await graph.continue_session("session-1", "Mỗi ngày anh đi bao nhiêu km?")
    assert "180" in first["messages"][-1]["content"]
    assert len(customer_model.calls) == 1  # Disclosure is guaranteed by the scenario, not left to the model.
    await graph.continue_session("session-1", "Em sẽ tính theo quãng đường đó.")
    assert len(customer_model.calls) == 2
    assert (
        customer_model.calls[-1]["context"]["spoken_fact_message_ids"]["daily_distance"]
        == first["messages"][-1]["message_id"]
    )
    assert RoleplayState.model_validate(await checkpoint.load("session-1")).spoken_fact_message_ids


@pytest.mark.asyncio
async def test_unresolved_cost_concern_gets_two_prompts_then_customer_defers():
    cost = "OBJ_VF5_BATTERY_VS_GAS"
    graph, checkpoint, customer_model, _ = build_graph(
        [
            {"reply": "Anh lo tiền pin và tiền sạc.", "raised_objection_id": cost},
            {"reply": "Cộng tiền pin với sạc thì có đáng đổi không em?", "raised_objection_id": cost},
            {"reply": "Anh muốn biết tổng chi phí thực tế thôi.", "raised_objection_id": cost},
            {"reply": "Anh cần cân nhắc lại, em gửi thông tin cụ thể sau nhé.", "decision": "defer"},
        ],
        [
            {"factual_claims": [{"text": "Giá xe là 500 triệu", "category": "price"}]},
            {},
            {},
        ],
    )
    await graph.start("session-1", "SCENARIO_01_VF5_TAXI")
    await graph.continue_session("session-1", "Giá xe là 500 triệu")
    await graph.continue_session("session-1", "Dạ em hiểu.")
    final = await graph.continue_session("session-1", "Để em xem thêm.")

    assert [call["context"]["focus_objection_prompt_number"] for call in customer_model.calls[1:]] == [1, 2, None]
    assert len(customer_model.calls) == 4
    assert final["termination_status"] == TerminationStatus.DROPPED_OUT.value
    saved = RoleplayState.model_validate(await checkpoint.load("session-1"))
    assert saved.concern_prompt_counts["OBJ_VF5_BATTERY_VS_GAS"] == 2


@pytest.mark.asyncio
async def test_customer_acceptance_of_relevant_step_completes_session():
    cost = "OBJ_VF5_BATTERY_VS_GAS"
    graph, checkpoint, _, _ = build_graph(
        [
            {"reply": "Anh lo tiền pin và sạc.", "raised_objection_id": cost},
            {"reply": "Tiền pin và sạc có đáng đổi không?", "raised_objection_id": cost},
            {"reply": "Em tính thêm giúp anh nhé.", "raised_objection_id": cost},
            {"reply": "Ừ, em gửi bảng tính cho anh.", "decision": "accept_step"},
        ],
        [
            {"factual_claims": [{"text": "Giá xe là 500 triệu", "category": "price"}]},
            {},
            {"next_step_attempted": True, "addressed_objection_ids": [cost]},
        ],
    )
    await graph.start("session-1", "SCENARIO_01_VF5_TAXI")
    await graph.continue_session("session-1", "Giá xe là 500 triệu")
    await graph.continue_session("session-1", "Em ghi nhận điều này.")
    accepted = await graph.continue_session("session-1", "Em sẽ gửi bảng chi phí theo quãng đường anh chạy.")
    assert accepted["termination_status"] == TerminationStatus.COMPLETED.value
    assert cost in RoleplayState.model_validate(await checkpoint.load("session-1")).resolved_objections


@pytest.mark.asyncio
async def test_selected_turn_limit_is_persisted_and_enforced():
    graph, checkpoint, _, _ = build_graph(
        [{"reply": "Anh muốn tìm hiểu xe."}, *[{"reply": "Vâng."} for _ in range(11)]],
        [{} for _ in range(11)],
    )
    started = await graph.start("session-1", "SCENARIO_01_VF5_TAXI", max_turns=11)
    assert started["max_turns"] == 11
    for turn in range(11):
        final = await graph.continue_session("session-1", f"Tin nhắn {turn}")
    assert final["turn_count"] == 11
    assert final["termination_status"] == TerminationStatus.MAX_TURNS.value
    assert RoleplayState.model_validate(await checkpoint.load("session-1")).max_turns == 11


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
    assert saved.pending_customer_reply is True


@pytest.mark.asyncio
async def test_failed_customer_reply_resumes_without_duplicate_advisor_turn():
    graph, checkpoint, customer_model, analysis_model = build_graph(
        [
            {"reply": "Anh muốn tìm hiểu xe."},
            {"reply": "", "raised_objection_id": None, "decision": "reply"},
            {"reply": "Anh hiểu rồi, em nói tiếp đi."},
        ],
        [{}],
    )
    await graph.start("session-1", "SCENARIO_01_VF5_TAXI")
    with pytest.raises(CustomerResponseError):
        await graph.continue_session("session-1", "Mình cùng xem chi phí nhé anh.")
    with pytest.raises(RoleplaySessionConflictError, match="pending"):
        await graph.continue_session("session-1", "Tin nhắn khác")
    with pytest.raises(RoleplaySessionConflictError, match="pending"):
        await graph.finish_session("session-1")

    result = await graph.continue_session("session-1", "Mình cùng xem chi phí nhé anh.")
    saved = RoleplayState.model_validate(await checkpoint.load("session-1"))
    assert result["pending_customer_reply"] is False
    assert [message.role for message in saved.messages] == ["customer", "advisor", "customer"]
    assert [event.decision for event in saved.customer_decisions] == ["reply", "reply"]
    assert saved.turn_count == 1
    assert analysis_model.calls == ["Mình cùng xem chi phí nhé anh."]
    assert len(customer_model.calls) == 3


@pytest.mark.asyncio
async def test_accepting_unrelated_proposal_does_not_clear_cost_concern():
    cost = "OBJ_VF5_BATTERY_VS_GAS"
    graph, checkpoint, _, _ = build_graph(
        [
            {"reply": "Anh lo tổng chi phí.", "raised_objection_id": cost},
            {"reply": "Được, mình xem xe trước.", "decision": "accept_step"},
        ],
        [{"next_step_attempted": True}],
    )
    await graph.start("session-1", "SCENARIO_01_VF5_TAXI")
    result = await graph.continue_session("session-1", "Mình hẹn xem màu xe nhé?")
    saved = RoleplayState.model_validate(await checkpoint.load("session-1"))
    assert result["termination_status"] == TerminationStatus.ACTIVE.value
    assert saved.active_objections == [cost]
    assert saved.resolved_objections == []


@pytest.mark.asyncio
async def test_unlabeled_reply_does_not_consume_concern_follow_up():
    cost = "OBJ_VF5_BATTERY_VS_GAS"
    graph, checkpoint, _, _ = build_graph(
        [{"reply": "Anh lo tổng chi phí.", "raised_objection_id": cost}, {"reply": "Để anh nghe thêm."}],
        [{}],
    )
    await graph.start("session-1", "SCENARIO_01_VF5_TAXI")
    await graph.continue_session("session-1", "Em sẽ giải thích theo lịch chạy của anh.")
    saved = RoleplayState.model_validate(await checkpoint.load("session-1"))
    assert saved.concern_prompt_counts.get(cost, 0) == 0


@pytest.mark.asyncio
async def test_final_allowed_advisor_turn_receives_customer_reply():
    graph, checkpoint, _, _ = build_graph(
        [{"reply": "Anh đang xem xe."}, {"reply": "Anh hiểu, cảm ơn em."}],
        [{}],
    )
    await graph.start("session-1", "SCENARIO_01_VF5_TAXI", max_turns=1)
    result = await graph.continue_session("session-1", "Em gửi anh bảng chi phí nhé.")
    saved = RoleplayState.model_validate(await checkpoint.load("session-1"))
    assert result["termination_status"] == TerminationStatus.MAX_TURNS.value
    assert [message.role for message in saved.messages] == ["customer", "advisor", "customer"]
    assert saved.messages[-1].content == "Anh hiểu, cảm ơn em."


@pytest.mark.asyncio
async def test_session_uses_its_scenario_snapshot_after_catalog_changes():
    graph, _, customer_model, _ = build_graph(
        [{"reply": "Anh đang xem xe."}, {"reply": "Em nói thêm đi."}],
        [{}],
    )
    await graph.start("session-1", "SCENARIO_01_VF5_TAXI")
    graph._repository._scenarios["SCENARIO_01_VF5_TAXI"].persona["name"] = "Different buyer"
    await graph.continue_session("session-1", "Em gửi thêm thông tin nhé.")
    assert customer_model.calls[-1]["context"]["persona"]["name"] == "Anh Nam"


@pytest.mark.asyncio
async def test_customer_memory_contains_only_spoken_charging_location():
    graph, checkpoint, _, _ = build_graph(
        [{"reply": "Anh đang xem VF 6."}],
        [{"detected_intents": ["ask_living_location"], "discovered_fact_ids": ["charging_access"]}],
    )
    await graph.start("session-1", "SCENARIO_03_VF6_APARTMENT")
    await graph.continue_session("session-1", "Anh ở khu nào ạ?")
    saved = RoleplayState.model_validate(await checkpoint.load("session-1"))
    spoken = saved.customer_prompt_context()["revealed_facts"]["charging_access"]
    assert "Vincom Trần Duy Hưng" in spoken
    assert "800m" not in spoken
    assert "V-GREEN" not in spoken


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
