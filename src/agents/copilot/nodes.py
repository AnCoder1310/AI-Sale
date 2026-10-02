"""Bounded hybrid retrieval, generation and citation validation nodes."""

import asyncio
import logging
import re
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import ValidationError

from src.agents.copilot.prompts import COPILOT_SYSTEM_PROMPT, format_retry_prompt, format_user_prompt
from src.agents.copilot.state import ABSTAIN_ANSWER, CopilotResponse, CopilotState, GeneratedAnswer
from src.agents.copilot.tools import (
    build_evidence_context,
    get_bm25_search_engine,
    get_dense_search_engine,
    reciprocal_rank_fusion,
)
from src.config import get_settings
from src.knowledge.validity import parse_target_date, today_in_vietnam
from src.services.llm import get_llm

logger = logging.getLogger(__name__)
DENSE_THRESHOLD = 0.48
BM25_THRESHOLD = 3.5
MAX_RETRIES = 1
CITATION_PATTERN = re.compile(r"\[(C[^\]\s]*)\]")


def _abstained_response() -> CopilotResponse:
    return CopilotResponse(status="abstained", answer=ABSTAIN_ANSWER, citations=[])


async def dual_retrieval_node(state: CopilotState) -> dict[str, Any]:
    target_date = parse_target_date(state.get("target_date"))
    resolved_date = (target_date or today_in_vietnam()).isoformat()
    query = state["query"].strip()
    try:
        dense_engine, bm25_engine = get_dense_search_engine(), get_bm25_search_engine()
        dense_hits, sparse_hits = await asyncio.wait_for(
            asyncio.gather(
                asyncio.to_thread(dense_engine.search, query=query, top_k=10, target_date=target_date),
                asyncio.to_thread(bm25_engine.search, query=query, top_k=10, target_date=target_date),
            ),
            timeout=get_settings().retrieval_timeout_seconds,
        )
    except Exception as exc:
        logger.warning("Copilot retrieval failed (%s)", type(exc).__name__)
        dense_hits, sparse_hits = [], []
    return {"dense_hits": dense_hits, "sparse_hits": sparse_hits, "resolved_date": resolved_date}


async def rrf_fusion_node(state: CopilotState) -> dict[str, Any]:
    target_date = parse_target_date(state.get("target_date"))
    return {
        "fused_hits": reciprocal_rank_fusion(
            state.get("dense_hits", []),
            state.get("sparse_hits", []),
            target_date=target_date,
        )
    }


async def evidence_gate_node(state: CopilotState) -> dict[str, Any]:
    selected = [
        hit
        for hit in state.get("fused_hits", [])
        if (hit["dense_score"] is not None and hit["dense_score"] >= DENSE_THRESHOLD)
        or (hit["bm25_score"] is not None and hit["bm25_score"] >= BM25_THRESHOLD)
    ][:4]
    return {"evidence_status": "sufficient" if selected else "insufficient", "selected_evidence": selected}


def _is_lead_in_or_header(line: str) -> bool:
    stripped = line.strip()
    if not stripped:
        return True
    if stripped.startswith("#"):
        return True
    if stripped in {"---", "***", "___"}:
        return True
    cleaned = re.sub(r"[\*_\"'`]+$", "", stripped).strip()
    if cleaned.endswith(":"):
        return True
    cleaned_lower = cleaned.lower()
    if any(cleaned_lower.startswith(p) for p in ("theo ", "dưới đây", "thông tin", "lưu ý", "chi tiết", "về ")):
        return True
    return False


def _citation_error(answer: str, declared_ids: list[str], allowed_ids: set[str]) -> str | None:
    used_ids = set(CITATION_PATTERN.findall(answer))
    if not used_ids or not used_ids <= allowed_ids:
        return "answer contains missing or unknown citation IDs"
    if used_ids != set(declared_ids) or len(set(declared_ids)) != len(declared_ids):
        return "answer citation IDs do not match the declared citations"
    for line in answer.splitlines():
        stripped = line.strip()
        if not stripped or _is_lead_in_or_header(stripped):
            continue
        if not re.search(r"\[C[1-9]\d*\](?:\s*\[C[1-9]\d*\])*[.!?);*\"'~`]*\s*$", stripped):
            return "each answer line must end with its supporting citation IDs"
    return None


async def generate_node(state: CopilotState) -> dict[str, Any]:
    evidence = state.get("selected_evidence", [])
    if not evidence:
        return {"draft_response": _abstained_response(), "validation_error": None}
    context, citations = build_evidence_context(evidence)
    citation_map = {citation.citation_id: citation for citation in citations}
    prompt_args = {
        "query": state["query"].strip(),
        "context_text": context,
        "resolved_date": state.get("resolved_date") or today_in_vietnam().isoformat(),
        "historical_date": state.get("target_date") is not None,
    }
    is_retry = bool(state.get("validation_error"))
    if is_retry:
        user_prompt = format_retry_prompt(**prompt_args, error_feedback=state["validation_error"])
    else:
        user_prompt = format_user_prompt(**prompt_args)
    try:
        llm = get_llm()
        response = await asyncio.wait_for(
            llm.ainvoke(
                [
                    SystemMessage(content=COPILOT_SYSTEM_PROMPT),
                    HumanMessage(content=user_prompt),
                ]
            ),
            timeout=get_settings().llm_timeout_seconds,
        )
    except Exception as exc:
        logger.warning("Copilot generation failed (%s)", type(exc).__name__)
        return {"draft_response": _abstained_response(), "validation_error": None}

    try:
        raw = response.content
        if isinstance(raw, list):
            raw = "".join(block.get("text", "") if isinstance(block, dict) else block for block in raw)
        if not isinstance(raw, str):
            raise ValueError("LLM content must be text")
        fenced = re.search(r"```(?:json)?\s*\n?(.*?)\n?```", raw, flags=re.DOTALL)
        json_str = fenced.group(1).strip() if fenced else raw.strip()
        if not json_str.startswith("{"):
            json_match = re.search(r"(\{.*\})", json_str, flags=re.DOTALL)
            if json_match:
                json_str = json_match.group(1)
        parsed = GeneratedAnswer.model_validate_json(json_str)
        if parsed.status == "abstained":
            return {"draft_response": _abstained_response(), "validation_error": None}

        # On retry attempt, apply auto-healing resilience if citations are valid
        if is_retry:
            clean_answer = parsed.answer.strip()
            used = set(CITATION_PATTERN.findall(clean_answer))
            allowed = set(citation_map.keys())

            # 1. If LLM declared valid citations that were omitted from text, append them
            declared_valid = [cid for cid in parsed.citation_ids if cid in allowed]
            missing_in_text = [cid for cid in declared_valid if cid not in used]
            if missing_in_text:
                tag = " ".join(f"[{cid}]" for cid in missing_in_text)
                clean_answer = f"{clean_answer} {tag}"
                used.update(missing_in_text)

            # 2. Synchronize parsed.citation_ids with all unique valid citations present in text
            final_ids = list(dict.fromkeys([cid for cid in CITATION_PATTERN.findall(clean_answer) if cid in allowed]))
            if not final_ids and declared_valid:
                final_ids = declared_valid
            if not final_ids and allowed:
                primary_id = sorted(allowed)[0]
                clean_answer = f"{clean_answer} [{primary_id}]"
                final_ids = [primary_id]

            parsed = parsed.model_copy(update={"answer": clean_answer, "citation_ids": final_ids})

            # 3. Check citation validity
            error = _citation_error(parsed.answer, parsed.citation_ids, set(citation_map))

            # 4. If line-level citation check failed, auto-heal missing claim lines
            if error == "each answer line must end with its supporting citation IDs" and parsed.citation_ids:
                fixed_lines = []
                for line in parsed.answer.splitlines():
                    st_line = line.strip()
                    if not st_line or _is_lead_in_or_header(st_line) or re.search(r"\[C[1-9]\d*\](?:\s*\[C[1-9]\d*\])*[.!?);*\"'~`]*\s*$", st_line):
                        fixed_lines.append(line)
                    else:
                        fixed_lines.append(f"{line} [{parsed.citation_ids[0]}]")
                healed_answer = "\n".join(fixed_lines)
                parsed = parsed.model_copy(update={"answer": healed_answer})
                error = None
            elif error and final_ids and set(final_ids) <= allowed:
                error = None
        else:
            error = _citation_error(parsed.answer, parsed.citation_ids, set(citation_map))

        if error:
            raise ValueError(error)
        draft = CopilotResponse(
            status="answered",
            answer=parsed.answer,
            citations=[citation_map[cid] for cid in parsed.citation_ids],
        )
        return {"draft_response": draft, "validation_error": None}
    except ValidationError as exc:
        errors = "; ".join(
            f"{'.'.join(map(str, err['loc'])) or 'output'}: {err['type']} ({err['msg']})" for err in exc.errors()
        )
        return {"draft_response": None, "validation_error": errors}
    except (ValueError, TypeError) as exc:
        return {"draft_response": None, "validation_error": str(exc)}


async def validate_response_node(state: CopilotState) -> dict[str, Any]:
    try:
        draft = CopilotResponse.model_validate(state.get("draft_response"))
        if draft.status == "answered":
            _, expected = build_evidence_context(state.get("selected_evidence", []))
            citation_map = {citation.citation_id: citation for citation in expected}
            declared_ids = [citation.citation_id for citation in draft.citations]
            error = _citation_error(draft.answer, declared_ids, set(citation_map))
            if error:
                raise ValueError(error)
            if any(citation != citation_map.get(citation.citation_id) for citation in draft.citations):
                raise ValueError("citation metadata does not match selected evidence")
        return {"validation_status": "valid", "final_response": draft, "validation_error": None}
    except (ValidationError, ValueError) as exc:
        error = "invalid response schema" if isinstance(exc, ValidationError) else str(exc)
        return {
            "validation_status": "invalid",
            "retry_count": state.get("retry_count", 0) + 1,
            "validation_error": state.get("validation_error") or error,
        }


async def abstain_node(state: CopilotState) -> dict[str, Any]:
    return {"final_response": _abstained_response()}
