import asyncio
from copy import deepcopy
from pathlib import Path

import pytest

from src.agents.roleplay.customer_agent import CustomerAgent
from src.agents.roleplay.graph import RoleplayGraph, RoleplaySessionConflictError
from src.agents.roleplay.scenario_loader import ScenarioRepository
from src.agents.roleplay.state import EvaluationStatus, RoleplayState, TerminationStatus
from src.agents.roleplay.turn_analyzer import TurnAnalyzer
from src.models.evaluation import (
    CriterionEvaluation,
    CriterionStatus,
    CriterionType,
    SessionEvaluationResult,
)
from src.services.practice import PracticeEvaluationUnavailableError, PracticeService

SCENARIOS = Path("data/scenarios/scenarios.json")


class RecordingGraph:
    def __init__(self, response):
        self.response = response
        self.start_calls = []
        self.continue_calls = []

    async def start(self, session_id, scenario_id):
        self.start_calls.append((session_id, scenario_id))
        return {**self.response, "session_id": session_id, "scenario_id": scenario_id}

    async def continue_session(self, session_id, advisor_message):
        self.continue_calls.append((session_id, advisor_message))
        return {**self.response, "session_id": session_id}


def session_response():
    return {
        "session_id": "ignored",
        "scenario_id": "SCENARIO_01_VF5_TAXI",
        "difficulty": "Medium",
        "sales_channel": "Fanpage",
        "training_objective": "Practice discovery",
        "conversation_stage": "opening",
        "turn_count": 0,
        "visible_context": "A customer asks about switching cars.",
        "termination_status": "active",
        "termination_reason": None,
        "messages": [],
    }


def build_service():
    graph = RecordingGraph(session_response())
    service = PracticeService(
        graph,
        ScenarioRepository(SCENARIOS),
        session_id_factory=lambda: "generated-session-id",
    )
    return service, graph


def test_list_scenarios_returns_only_public_summaries():
    service, _ = build_service()

    summaries = [summary.model_dump() for summary in service.list_scenarios()]

    assert len(summaries) == 3
    assert all("hidden_facts" not in summary for summary in summaries)


@pytest.mark.asyncio
async def test_start_session_generates_identifier_and_validates_response():
    service, graph = build_service()

    result = await service.start_session("SCENARIO_01_VF5_TAXI")

    assert result.session_id == "generated-session-id"
    assert graph.start_calls == [("generated-session-id", "SCENARIO_01_VF5_TAXI")]


@pytest.mark.asyncio
async def test_send_message_keeps_session_identifier():
    service, graph = build_service()

    result = await service.send_message("session-1", "Xin chào anh")

    assert result.session_id == "session-1"
    assert graph.continue_calls == [("session-1", "Xin chào anh")]


class MemoryCheckpoint:
    def __init__(self):
        self.states = {}

    async def load(self, session_id):
        return deepcopy(self.states.get(session_id))

    async def save(self, session_id, state):
        self.states[session_id] = deepcopy(state)


class OpeningCustomerModel:
    async def generate(self, *, system_prompt, context):
        return {"reply": "Anh đang cân nhắc mua xe điện."}


class UnusedAnalysisModel:
    async def analyze(self, advisor_message, scenario, state):
        return {}


class EvidenceProvider:
    async def for_session(self, scenario, state):
        return []


class RecordingEvaluator:
    def __init__(self):
        self.calls = 0
        self.fail_next = False

    async def evaluate(self, scenario, state, knowledge_evidence):
        self.calls += 1
        await asyncio.sleep(0)
        if self.fail_next:
            self.fail_next = False
            raise TimeoutError("provider timed out")
        return SessionEvaluationResult(
            session_id=state.session_id,
            scenario_id=scenario.scenario_id,
            rubric_version="test-v1",
            assessed_criteria_count=0,
            evaluations=[
                CriterionEvaluation(
                    criterion=criterion,
                    status=CriterionStatus.NOT_OBSERVED,
                    reason="No opportunity to assess this skill.",
                )
                for criterion in CriterionType
            ],
        )


def build_lifecycle_service():
    checkpoint = MemoryCheckpoint()
    graph = RoleplayGraph(
        ScenarioRepository(SCENARIOS),
        TurnAnalyzer(UnusedAnalysisModel()),
        CustomerAgent(OpeningCustomerModel()),
        checkpoint,
    )
    evaluator = RecordingEvaluator()
    service = PracticeService(
        graph,
        ScenarioRepository(SCENARIOS),
        session_id_factory=lambda: "session-1",
        evaluator=evaluator,
        knowledge_evidence=EvidenceProvider(),
    )
    return service, checkpoint, evaluator


@pytest.mark.asyncio
async def test_finish_persists_one_result_and_reuses_it_on_retry():
    service, checkpoint, evaluator = build_lifecycle_service()
    await service.start_session("SCENARIO_01_VF5_TAXI")

    first, second = await asyncio.gather(service.finish_session("session-1"), service.finish_session("session-1"))
    saved = RoleplayState.model_validate(await checkpoint.load("session-1"))

    assert first == second
    assert first.evaluation_status is EvaluationStatus.COMPLETE
    assert first.result.review_status == "ai_draft"
    assert evaluator.calls == 1
    assert saved.evaluation_result == first.result
    assert saved.termination_status is TerminationStatus.ADVISOR_ENDED
    assert await service.get_result("session-1") == first
    with pytest.raises(RoleplaySessionConflictError):
        await service.send_message("session-1", "Tin nhắn sau Finish")


@pytest.mark.asyncio
async def test_evaluator_failure_keeps_frozen_transcript_and_allows_retry():
    service, checkpoint, evaluator = build_lifecycle_service()
    await service.start_session("SCENARIO_01_VF5_TAXI")
    evaluator.fail_next = True

    with pytest.raises(PracticeEvaluationUnavailableError):
        await service.finish_session("session-1")

    failed = RoleplayState.model_validate(await checkpoint.load("session-1"))
    assert failed.evaluation_status is EvaluationStatus.FAILED
    assert failed.termination_status is TerminationStatus.ADVISOR_ENDED
    assert [message.role for message in failed.messages] == ["customer"]
    assert (await service.get_result("session-1")).result is None

    retried = await service.finish_session("session-1")
    assert retried.evaluation_status is EvaluationStatus.COMPLETE
    assert evaluator.calls == 2
