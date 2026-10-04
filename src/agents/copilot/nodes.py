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
# BM25 scores depend on query length. A two-term product query such as
# "giá vf8" scores relevant price-list chunks around 2.5 on the MVP corpus.
BM25_THRESHOLD = 2.4
MAX_RETRIES = 1
CITATION_PATTERN = re.compile(r"\[(C[^\]\s]*)\]")


class CopilotDependencyError(RuntimeError):
    """Retrieval or generation is unavailable; this is not a knowledge gap."""


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
                asyncio.to_thread(dense_engine.search, query=query, top_k=20, target_date=target_date),
                asyncio.to_thread(bm25_engine.search, query=query, top_k=20, target_date=target_date),
            ),
            timeout=get_settings().retrieval_timeout_seconds,
        )
    except Exception as exc:
        logger.exception("Copilot retrieval failed")
        raise CopilotDependencyError("retrieval unavailable") from exc
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
    eligible = [
        hit
        for hit in state.get("fused_hits", [])
        if (hit["dense_score"] is not None and hit["dense_score"] >= DENSE_THRESHOLD)
        or (hit["bm25_score"] is not None and hit["bm25_score"] >= BM25_THRESHOLD)
    ]
    # Dense retrieval can return many adjacent chunks from one document. Give
    # other eligible sources a place before filling the remaining context slots.
    selected: list[Any] = []
    seen_documents: set[str] = set()
    for hit in eligible:
        if hit["document_id"] not in seen_documents:
            selected.append(hit)
            seen_documents.add(hit["document_id"])
            if len(selected) == 4:
                break
    if len(selected) < 4:
        selected_ids = {hit["chunk_id"] for hit in selected}
        selected.extend(hit for hit in eligible if hit["chunk_id"] not in selected_ids)
        selected = selected[:4]
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


def _safe_suggestions(parsed: GeneratedAnswer, allowed_ids: set[str]) -> tuple[list[str], str | None, str | None]:
    """Do not surface new factual talking points outside the cited answer."""
    answer_lines = {line.strip() for line in parsed.answer.splitlines() if line.strip()}
    talking_points = []
    for point in parsed.talking_points:
        cited_ids = list(dict.fromkeys(CITATION_PATTERN.findall(point)))
        if point in answer_lines and _citation_error(point, cited_ids, allowed_ids) is None:
            talking_points.append(point)

    # The other two fields are conversational aids, not a place for new prices,
    # specifications, or policy numbers. Prompt rules constrain their wording;
    # the code also drops obvious quantified claims instead of showing them.
    message = parsed.suggested_message
    message_without_model = re.sub(r"\bVF[\s-]*\d+\b", "", message or "", flags=re.I)
    if message and re.search(
        r"\d|%|₫|vnđ|triệu|tỷ|cam kết|miễn phí|giảm giá|bảo hành|ưu đãi|kèm pin",
        message_without_model,
        re.I,
    ):
        message = None
    next_question = parsed.suggested_next_question
    question_without_model = re.sub(r"\bVF[\s-]*\d+\b", "", next_question or "", flags=re.I)
    if next_question and (not next_question.endswith("?") or re.search(r"\d|%|₫|vnđ", question_without_model, re.I)):
        next_question = None
    return talking_points, message, next_question


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
        logger.exception("Copilot generation failed")
        raise CopilotDependencyError("generation unavailable") from exc

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

        # A retry asks the model to repair its own answer; code must not attach
        # a source to a claim merely because the source ID exists.
        error = _citation_error(parsed.answer, parsed.citation_ids, set(citation_map))

        if error:
            raise ValueError(error)
        talking_points, suggested_message, suggested_next_question = _safe_suggestions(parsed, set(citation_map))
        draft = CopilotResponse(
            status="answered",
            answer=parsed.answer,
            citations=[citation_map[cid] for cid in parsed.citation_ids],
            talking_points=talking_points,
            suggested_message=suggested_message,
            suggested_next_question=suggested_next_question,
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
