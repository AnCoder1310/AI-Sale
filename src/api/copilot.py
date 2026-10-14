"""Authenticated HTTP contracts for the agentic sales copilot."""

import asyncio
import json
import logging
import time
from datetime import date
from pathlib import Path
from typing import Annotated, Any, Literal
from uuid import uuid4

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, Response
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, StringConstraints, computed_field, field_validator
from sqlalchemy.exc import SQLAlchemyError

from src.agents.copilot.graph import copilot_agent
from src.agents.copilot.nodes import CopilotDependencyError
from src.agents.copilot.runtime import AdmissionError, BudgetExhaustedError, RuntimeBudget, bounded_io
from src.agents.copilot.state import CopilotResponse
from src.agents.copilot.summarizer import format_summary_for_context, maybe_trigger_background_summarization
from src.config import get_settings
from src.integrations.copilot_sessions import CopilotSessionConflictError, CopilotSessionNotFoundError
from src.knowledge.index_readiness import IndexNotReadyError
from src.models.auth import UserRole
from src.observability import annotate, graph_config, span
from src.services.semantic_cache import semantic_cache

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/copilot", tags=["Copilot"])
QueryText = Annotated[str, StringConstraints(strict=True, strip_whitespace=True, min_length=2, max_length=4000)]


class CopilotQueryRequest(BaseModel):
    query: QueryText
    target_date: date | None = None
    session_id: Annotated[str, StringConstraints(pattern=r"^[a-f0-9]{32}$")] | None = None
    customer_context: Annotated[str, StringConstraints(strip_whitespace=True, max_length=6000)] | None = None
    domain: Literal["all", "specs", "policy", "charging", "competitor"] = "all"

    @field_validator("target_date", mode="before")
    @classmethod
    def validate_date(cls, value: Any) -> date | None:
        if value is None or type(value) is date:
            return value
        if not isinstance(value, str):
            raise ValueError("target_date must be YYYY-MM-DD")
        parsed = date.fromisoformat(value)
        if parsed.isoformat() != value:
            raise ValueError("target_date must be YYYY-MM-DD")
        return parsed


class CopilotQueryResponse(CopilotResponse):
    session_id: str | None = None

    @computed_field
    @property
    def is_abstain(self) -> bool:
        return self.status == "abstained"

    @computed_field
    @property
    def is_clarification(self) -> bool:
        return self.status == "needs_clarification"


async def query_copilot(
    request: CopilotQueryRequest,
    *,
    history: list | None = None,
    memory_summary: str | None = None,
    runtime=None,
    snapshot=None,
    request_id=None,
    readiness_loader=None,
    progress_queue=None,
) -> CopilotQueryResponse:
    try:
        runtime = runtime or RuntimeBudget.create(get_settings())
        request_id = request_id or uuid4().hex
        started = time.perf_counter()
        result = await asyncio.wait_for(
            copilot_agent.ainvoke(
                {
                    "query": request.query,
                    "target_date": request.target_date,
                    "customer_context": request.customer_context or "",
                    "memory_summary": memory_summary,
                    "history": history or [],
                    "domain": request.domain,
                    "runtime": runtime,
                    "snapshot": snapshot,
                    "readiness_loader": readiness_loader,
                    "request_id": request_id,
                    "progress_queue": progress_queue,
                },
                config={"recursion_limit": 32, **graph_config()},
            ),
            timeout=runtime.timeout(get_settings().copilot_request_timeout_seconds),
        )
        final = CopilotResponse.model_validate(result["final_response"])
        trace = result.get("trace", [])
        llm_events = [event for event in trace if event.get("llm")]
        annotate(
            outcome=final.status,
            reason_code=final.reason_code,
            workflow_version="2",
            generation_attempt=result.get("generation_count"),
            corrective_round=result.get("corrective_retrieval_count"),
            provider_retry=runtime.provider_retries,
            tool_calls=result.get("tool_calls"),
            llm_attempts=len(llm_events),
            input_tokens=sum(e["input_tokens"] for e in llm_events)
            if llm_events and all(e.get("input_tokens") is not None for e in llm_events)
            else None,
            output_tokens=sum(e["output_tokens"] for e in llm_events)
            if llm_events and all(e.get("output_tokens") is not None for e in llm_events)
            else None,
        )
        logger.info(
            "Copilot request_id=%s status=%s llm_attempts=%s tools=%s elapsed=%.3f usage=%s",
            request_id,
            final.status,
            len(llm_events),
            result.get("tool_calls"),
            time.perf_counter() - started,
            [
                {key: event.get(key) for key in ("node", "input_tokens", "output_tokens")}
                for event in trace
                if event.get("llm")
            ],
        )
        return CopilotQueryResponse(**{**final.model_dump(), "request_id": request_id})
    except (CopilotDependencyError, BudgetExhaustedError, IndexNotReadyError, TimeoutError) as exc:
        annotate(error_type=type(exc).__name__)
        raise HTTPException(
            status_code=503, detail="Dịch vụ tra cứu tạm thời không khả dụng. Vui lòng thử lại."
        ) from exc
    except Exception as exc:
        logger.warning("Copilot request failed (%s)", type(exc).__name__)
        raise HTTPException(status_code=500, detail="Không thể xử lý câu hỏi lúc này.") from None


async def current_copilot_user(request: Request):
    with span("authentication"):
        identity = await request.app.state.current_user(request)
        if identity.role != UserRole.ADVISOR:
            raise HTTPException(status_code=403, detail="Advisor access required.")
        return identity


@router.post("/query", response_model=CopilotQueryResponse)
async def query_session_copilot(
    payload: CopilotQueryRequest,
    request: Request,
    background_tasks: BackgroundTasks = BackgroundTasks(),
    user=Depends(current_copilot_user),
) -> CopilotQueryResponse:
    runtime = RuntimeBudget.create(get_settings())
    admission = request.app.state.copilot_admission
    try:
        with span("admission"):
            admission.acquire(user.user_id)
    except AdmissionError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail="Đang có nhiều yêu cầu. Vui lòng thử lại sau.",
            headers={"Retry-After": str(exc.retry_after)},
        ) from exc
    try:
        response, _ = await asyncio.wait_for(
            _query_owned_session(payload, request, user, runtime, background_tasks=background_tasks),
            timeout=runtime.remaining(),
        )
        return response
    except (
        CopilotDependencyError,
        BudgetExhaustedError,
        IndexNotReadyError,
        TimeoutError,
        SQLAlchemyError,
        OSError,
    ) as exc:
        raise HTTPException(
            status_code=503, detail="Dịch vụ tra cứu tạm thời không khả dụng. Vui lòng thử lại."
        ) from exc
    finally:
        admission.release(user.user_id)


async def _query_owned_session(
    payload,
    request,
    user,
    runtime,
    background_tasks: BackgroundTasks | None = None,
    progress_queue: asyncio.Queue | None = None,
) -> tuple[CopilotQueryResponse, bool]:
    repository = request.app.state.copilot_sessions
    history, revision, context = [], None, payload.customer_context or ""
    session_id = payload.session_id or uuid4().hex
    from_cache = False

    stored_mem_summary = None
    if payload.session_id:
        try:
            with span("session.load", backend="session"):
                stored = await bounded_io(lambda: repository.load(session_id, user.user_id), runtime.timeout(20))
        except CopilotSessionNotFoundError as exc:
            raise HTTPException(status_code=404, detail="Không tìm thấy phiên Copilot.") from exc
        history, revision = stored["history"], stored["revision"]
        context = stored["customer_context"] if payload.customer_context is None else payload.customer_context
        stored_mem_summary = stored.get("memory_summary")

    # 1. Exact Cache check for standalone questions without active session
    is_standalone = not payload.session_id and not (context and len(context.strip()) > 0)
    result = None
    if is_standalone:
        cached = await semantic_cache.get(
            query=payload.query,
            domain=payload.domain or "all",
            target_date=payload.target_date,
            customer_context="",
            session_id=None,
            history=[],
            memory_summary=None,
            readiness_loader=request.app.state.copilot_readiness,
        )
        if cached:
            cached_resp = CopilotResponse.model_validate(cached)
            request_id = getattr(request.state, "request_id", None) or uuid4().hex
            result = CopilotQueryResponse(
                **{**cached_resp.model_dump(), "request_id": request_id, "session_id": session_id}
            )
            from_cache = True

    if result is None:
        formatted_summary = format_summary_for_context(stored_mem_summary) if stored_mem_summary else None
        annotate(query_characters=len(payload.query), history_count=len(history))
        result = await query_copilot(
            payload.model_copy(update={"customer_context": context}),
            history=history,
            memory_summary=formatted_summary,
            runtime=runtime,
            readiness_loader=request.app.state.copilot_readiness,
            request_id=getattr(request.state, "request_id", None),
            progress_queue=progress_queue,
        )

    if result.reason_code == "input_blocked":
        return result.model_copy(update={"session_id": payload.session_id}), from_cache

    dialogue = [
        *history,
        {"role": "user", "content": payload.query},
        {"role": "assistant", "content": result.answer[:4000]},
    ]
    with span("session.save", backend="session"):
        try:
            await bounded_io(
                lambda: repository.save(
                    session_id,
                    user.user_id,
                    dialogue,
                    context,
                    revision,
                    rich_turn={
                        "request_id": result.request_id or getattr(request.state, "request_id", None) or uuid4().hex,
                        "user_query": payload.query,
                        "response_data": result.model_dump(),
                    },
                ),
                runtime.timeout(20),
            )
        except TypeError:
            await bounded_io(
                lambda: repository.save(session_id, user.user_id, dialogue, context, revision), runtime.timeout(20)
            )
        except CopilotSessionConflictError as exc:
            raise HTTPException(status_code=409, detail="Phiên đã thay đổi. Vui lòng gửi lại câu hỏi.") from exc

    # Save to exact cache if standalone, verified answered, and not already from cache
    if is_standalone and not from_cache and result.status == "answered" and result.citations:
        try:
            semantic_cache.put(
                query=payload.query,
                response_data=result.model_dump(),
                domain=payload.domain or "all",
                target_date=payload.target_date,
                customer_context="",
                session_id=None,
                history=[],
                memory_summary=None,
                readiness_loader=request.app.state.copilot_readiness,
            )
        except Exception as cache_err:
            logger.debug("Failed to put in exact cache: %s", cache_err)

    # Check background summarization
    if background_tasks:
        try:
            total_msgs = repository.get_conversation_last_seq(session_id) or len(dialogue)
            maybe_trigger_background_summarization(
                session_id=session_id,
                repository=repository,
                background_tasks=background_tasks,
                current_message_count=total_msgs,
            )
        except Exception as bg_err:
            logger.debug("Failed to trigger background summarization: %s", bg_err)

    return result.model_copy(update={"session_id": session_id}), from_cache


@router.post("/query/stream")
async def stream_copilot_query(
    payload: CopilotQueryRequest,
    request: Request,
    background_tasks: BackgroundTasks = BackgroundTasks(),
    user=Depends(current_copilot_user),
):
    runtime = RuntimeBudget.create(get_settings())
    admission = request.app.state.copilot_admission
    try:
        with span("admission"):
            admission.acquire(user.user_id)
    except AdmissionError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail="Đang có nhiều yêu cầu. Vui lòng thử lại sau.",
            headers={"Retry-After": str(exc.retry_after)},
        ) from exc

    progress_queue: asyncio.Queue[dict] = asyncio.Queue(maxsize=32)
    worker_task = asyncio.create_task(
        _query_owned_session(
            payload,
            request,
            user,
            runtime,
            background_tasks=background_tasks,
            progress_queue=progress_queue,
        )
    )

    async def event_generator():
        try:
            yield f"event: status\ndata: {json.dumps({'step': 'analyzing', 'text': 'Đang phân tích câu hỏi & đối chiếu ngữ cảnh...'}, ensure_ascii=False)}\n\n"

            # Emit live progress status events as nodes run in the background worker
            while not worker_task.done():
                try:
                    item = await asyncio.wait_for(progress_queue.get(), timeout=0.1)
                    yield f"event: status\ndata: {json.dumps(item, ensure_ascii=False)}\n\n"
                except TimeoutError:
                    pass

            # Drain any remaining progress events
            while not progress_queue.empty():
                try:
                    item = progress_queue.get_nowait()
                    yield f"event: status\ndata: {json.dumps(item, ensure_ascii=False)}\n\n"
                except Exception:
                    break

            result, from_cache = await worker_task

            if from_cache:
                yield f"event: status\ndata: {json.dumps({'step': 'cached', 'text': 'Phản hồi từ bộ nhớ đệm xác thực'}, ensure_ascii=False)}\n\n"

            ans_text = result.answer
            for i in range(0, len(ans_text), 256):
                chunk = ans_text[i : i + 256]
                yield f"event: delta\ndata: {json.dumps({'text': chunk}, ensure_ascii=False)}\n\n"

            final_data = result.model_dump()
            yield f"event: final\ndata: {json.dumps(final_data, ensure_ascii=False)}\n\n"
            if result.product_insights:
                insights_payload = {
                    "product_insights": [pi.model_dump() for pi in result.product_insights],
                    "request_id": result.request_id,
                    "session_id": result.session_id,
                }
                yield f"event: insights\ndata: {json.dumps(insights_payload, ensure_ascii=False)}\n\n"
            yield "event: done\ndata: {}\n\n"
        except (
            CopilotDependencyError,
            BudgetExhaustedError,
            IndexNotReadyError,
            TimeoutError,
            SQLAlchemyError,
            OSError,
        ) as exc:
            logger.error("Error during streaming query: %s", exc)
            detail = "Dịch vụ tra cứu tạm thời không khả dụng. Vui lòng thử lại."
            yield f"event: error\ndata: {json.dumps({'error': detail, 'detail': detail, 'status': 'error'}, ensure_ascii=False)}\n\n"
        except HTTPException as exc:
            logger.error("HTTPException during streaming query: %s", exc.detail)
            detail = str(exc.detail)
            yield f"event: error\ndata: {json.dumps({'error': detail, 'detail': detail, 'status': 'error'}, ensure_ascii=False)}\n\n"
        except Exception as exc:
            logger.error("Unexpected error during streaming query: %s", exc)
            detail = getattr(exc, "detail", "Không thể xử lý câu hỏi lúc này.")
            yield f"event: error\ndata: {json.dumps({'error': detail, 'detail': detail, 'status': 'error'}, ensure_ascii=False)}\n\n"
        finally:
            if worker_task and not worker_task.done():
                worker_task.cancel()
                try:
                    await worker_task
                except (asyncio.CancelledError, Exception):
                    pass
            admission.release(user.user_id)

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.get("/sessions")
async def list_copilot_sessions(
    request: Request, user=Depends(current_copilot_user)
) -> list[dict[str, Any]]:
    repository = request.app.state.copilot_sessions
    return await asyncio.to_thread(repository.list_conversations, user.user_id)


@router.get("/sessions/{session_id}")
async def get_copilot_session_detail(
    session_id: str, request: Request, user=Depends(current_copilot_user)
) -> dict[str, Any]:
    repository = request.app.state.copilot_sessions
    try:
        return await asyncio.to_thread(repository.get_conversation_detail, session_id, user.user_id)
    except CopilotSessionNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Không tìm thấy phiên Copilot.") from exc


@router.delete("/sessions/{session_id}", status_code=204)
async def delete_copilot_session(session_id: str, request: Request, user=Depends(current_copilot_user)):
    try:
        await asyncio.to_thread(request.app.state.copilot_sessions.delete, session_id, user.user_id)
    except CopilotSessionNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Không tìm thấy phiên Copilot.") from exc
    return Response(status_code=204)


@router.get("/sources/{document_id}")
async def get_source_document(
    document_id: str, chunk_id: str | None = None, user=Depends(current_copilot_user)
) -> dict[str, Any]:
    path = Path("data/knowledge/corpus.json")
    if not path.exists():
        raise HTTPException(status_code=404, detail="Không tìm thấy kho tài liệu.")
    try:
        items = json.loads(await asyncio.to_thread(path.read_text, encoding="utf-8"))
        for item in items:
            if item.get("document_id") == document_id:
                result = dict(item)
                if chunk_id:
                    from src.knowledge.chunking import load_and_chunk_corpus

                    chunks = await asyncio.to_thread(load_and_chunk_corpus, path)
                    target_chunk = next((c for c in chunks if c.chunk_id == chunk_id), None)
                    if target_chunk:
                        result["chunk"] = {
                            "chunk_id": target_chunk.chunk_id,
                            "content": target_chunk.content,
                            "section": getattr(target_chunk.metadata, "section", None),
                            "headers": getattr(target_chunk.metadata, "headers", None),
                        }
                return result
    except Exception as exc:
        logger.warning("Source lookup failed (%s)", type(exc).__name__)
        raise HTTPException(status_code=500, detail="Không thể đọc tài liệu lúc này.") from None
    raise HTTPException(status_code=404, detail="Không tìm thấy tài liệu.")
