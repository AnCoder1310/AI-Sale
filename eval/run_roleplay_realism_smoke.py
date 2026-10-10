"""Repeatable, small real-model role-play behavior probe using synthetic advisor turns.

Run from the repository root. This uses the configured chat provider, writes no
real customer data, and does not call the evaluator or the product API.
"""

import argparse
import asyncio
import json
import re
from datetime import UTC, datetime
from pathlib import Path
from tempfile import TemporaryDirectory

from src.agents.roleplay.customer_agent import CustomerAgent
from src.agents.roleplay.graph import RoleplayGraph
from src.agents.roleplay.scenario_loader import ScenarioRepository
from src.agents.roleplay.turn_analyzer import TurnAnalyzer
from src.integrations.practice_persistence import SQLCheckpointRepository
from src.integrations.practice_runtime import SharedLLMCustomerModel, SharedLLMTurnAnalysisModel

SCENARIO_ID = "SCENARIO_01_VF5_TAXI"
RUNS = {
    "helpful_advisor": [
        "Anh thường chạy khoảng bao nhiêu km mỗi ngày hoặc mỗi tháng ạ?",
        "Cảm ơn anh. Chi phí đổi xe cần nhìn cả tiền xe, pin, sạc và bảo dưỡng; em chưa muốn hứa mức tiết kiệm khi chưa kiểm tra chính sách đang áp dụng cho xe của anh.",
        "Em có thể lập bảng so sánh theo 5.000 km mỗi tháng, ghi rõ giả định tiền xăng và điều kiện sạc, rồi gửi anh xem trước khi quyết định.",
        "Ngoài chi phí, anh có lo việc dừng sạc trong ca chạy khách không? Mình có thể kiểm tra trạm gần tuyến anh chạy và hẹn trải nghiệm thực tế.",
    ],
    "missed_concern": [
        "Xe điện nhiều công nghệ hay lắm anh ạ.",
        "Dạ xe rất đẹp và đi êm anh nhé.",
        "Mình cứ xem màu xe trước anh nhé.",
        "Em gửi hình xe cho anh.",
    ],
    "discovery_and_next_step": [
        "Mỗi ngày anh chạy quãng đường khoảng bao nhiêu và chủ yếu ở đâu ạ?",
        "Anh thường nghỉ giữa ca ở khu vực nào, có tiện dừng sạc không ạ?",
        "Để so sát với Vios, em sẽ kiểm tra chính sách pin và sạc theo ngày mua xe, rồi tính một khoảng chi phí theo số km anh vừa chia sẻ; em chưa chốt một con số khi thiếu dữ liệu.",
        "Nếu anh thấy hướng này hợp lý, mình hẹn 15 phút xem xe và đối chiếu bảng chi phí theo ca chạy thực tế của anh nhé?",
    ],
}


async def run_one(name: str, advisor_turns: list[str]) -> dict:
    with TemporaryDirectory(prefix="p043-roleplay-realism-") as temp:
        graph = RoleplayGraph(
            ScenarioRepository(),
            TurnAnalyzer(SharedLLMTurnAnalysisModel()),
            CustomerAgent(SharedLLMCustomerModel()),
            SQLCheckpointRepository(f"sqlite:///{temp}/checkpoints.db"),
        )
        session_id = f"realism-{name}"
        try:
            await graph.start(session_id, SCENARIO_ID, max_turns=10)
            for advisor_turn in advisor_turns:
                state = await graph.get_session_state(session_id)
                if state.termination_status.value != "active":
                    break
                await graph.continue_session(session_id, advisor_turn)
            state = await graph.get_session_state(session_id)
            transcript = [message.model_dump() for message in state.messages]
            prior_customer = []
            false_mileage_memory = False
            for message in transcript:
                if message["role"] != "customer":
                    continue
                text = message["content"].casefold()
                if re.search(r"anh (?:vừa|đã) nói|anh nói rồi", text) and re.search(r"180|200|5[.,]?000", text):
                    if not any(re.search(r"180|200|5[.,]?000", older) for older in prior_customer):
                        false_mileage_memory = True
                prior_customer.append(text)
            return {
                "run": name,
                "status": "completed",
                "turns": state.turn_count,
                "termination": state.termination_status.value,
                "concern_prompt_counts": state.concern_prompt_counts,
                "spoken_fact_message_ids": state.spoken_fact_message_ids,
                "customer_decisions": [event.model_dump() for event in state.customer_decisions],
                "false_mileage_memory_detected": false_mileage_memory,
                "transcript": transcript,
            }
        except Exception as exc:
            return {"run": name, "status": "error", "error_type": type(exc).__name__, "error": str(exc)}


async def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, help="JSON result path; defaults to a timestamped file")
    args = parser.parse_args()
    results = [await run_one(name, turns) for name, turns in RUNS.items()]
    output = args.output or Path(f"eval/results/roleplay_realism_smoke_{datetime.now(UTC):%Y-%m-%dT%H-%M-%SZ}.json")
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(
        json.dumps({"date_utc": datetime.now(UTC).isoformat(), "runs": results}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    for result in results:
        print(
            result["run"],
            result["status"],
            result.get("turns"),
            result.get("termination"),
            result.get("concern_prompt_counts"),
        )
    print(output)


if __name__ == "__main__":
    asyncio.run(main())
