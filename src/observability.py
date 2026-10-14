"""Copilot-only tracing. Only explicitly selected data reaches the exporter."""

from __future__ import annotations

import contextvars
import json
import logging
import os
import random
import re
import sys
import threading
import time
from contextlib import contextmanager
from copy import copy
from dataclasses import dataclass, field
from datetime import UTC, datetime
from functools import wraps
from uuid import UUID, uuid4

from langchain_core.tracers.langchain import LangChainTracer
from langsmith import Client, tracing_context
from langsmith.run_helpers import get_current_run_tree
from langsmith.run_trees import RunTree
from urllib3.util.retry import Retry

logger = logging.getLogger("src.telemetry")
_request = contextvars.ContextVar("copilot_telemetry", default=None)
_log_span = contextvars.ContextVar("copilot_log_span", default=None)
worker_timeout = contextvars.ContextVar("copilot_worker_timeout", default=None)
_warning_lock = threading.Lock()
_last_warning = 0.0
_META = {
    "request_id",
    "app_env",
    "http_status",
    "outcome",
    "reason_code",
    "node",
    "attempt",
    "provider",
    "model",
    "ls_provider",
    "ls_model_name",
    "usage_metadata",
    "input_tokens",
    "output_tokens",
    "total_tokens",
    "search_index",
    "retrieval_round",
    "branch",
    "top_k",
    "fetch_k",
    "candidate_count",
    "result_count",
    "iterations",
    "backend",
    "operation",
    "corpus_hash",
    "document_count",
    "chunk_count",
    "decision_count",
    "tool_calls",
    "llm_attempts",
    "late_completion",
    "error_type",
    "retry",
    "query_characters",
    "history_count",
    "duration_ms",
    "workflow_version",
    "route",
    "profile",
    "selected_count",
    "context_characters",
    "reasoning_tokens",
    "finish_reason",
    "coverage_count",
    "supported_count",
    "generation_attempt",
    "corrective_round",
    "provider_retry",
    "recovery",
    "failure_stage",
    "failure_kind",
    "validation_code",
    "provider_status",
    "provider_error_kind",
    "requirement_id",
    "source_hash",
    "citation_id",
    "evidence_stage",
    "affinity",
    "missing_count",
    "claim_index",
    "verdict",
}


def safe_metadata(values):
    result = {}
    for key, value in (values or {}).items():
        if key not in _META:
            continue
        if key == "usage_metadata" and isinstance(value, dict):
            result[key] = {
                k: v
                for k, v in value.items()
                if k in {"input_tokens", "output_tokens", "total_tokens"}
                and isinstance(v, int)
                and not isinstance(v, bool)
                and v >= 0
            }
        elif value is None or isinstance(value, (bool, int, float)):
            result[key] = value
        elif isinstance(value, str):
            # Metadata is an identifier/enum, never an arbitrary exception or URL.
            result[key] = re.sub(r"[^\w./:-]", "_", value[:120])
    return result


def redact(value):
    text = value if isinstance(value, str) else json.dumps(value, ensure_ascii=False, default=str)
    text = re.sub(r"(?i)\b(?:sk|lsv2)_[a-z0-9_-]+|\bsk-[a-z0-9_-]+", "[SECRET]", text)
    text = re.sub(r"(?i)(?:bearer\s+)[\w.=-]+", "Bearer [SECRET]", text)
    text = re.sub(r"(?i)(?:postgres(?:ql)?://)[^\s\"']+", "[DATABASE_URL]", text)
    text = re.sub(r"[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}", "[EMAIL]", text)
    text = re.sub(r"(?<!\w)(?:\+?84|0)(?:[ .-]?\d){9,10}(?!\w)", "[PHONE]", text)
    text = re.sub(
        r'(?i)(["\']?(?:api[_-]?key|authorization|cookie|password|secret|access_token)["\']?\s*[:=]\s*)["\']?[^\s,}"\']+',
        r"\1[SECRET]",
        text,
    )
    return text[:16000]


def warning(error=None):
    global _last_warning
    with _warning_lock:
        now = time.monotonic()
        if now - _last_warning < 60:
            return
        _last_warning = now
    logger.warning(
        "telemetry_unavailable",
        extra={"telemetry": {"event": "export_warning", "error_type": type(error).__name__ if error else "MissingKey"}},
    )


def safe_call(function, *args, **kwargs):
    try:
        return function(*args, **kwargs)
    except Exception as exc:
        warning(exc)
        return None


def event(name, **values):
    scope = _request.get()
    if scope is None:
        return
    tree = get_current_run_tree()
    logger.info(
        name,
        extra={
            "telemetry": {
                "event": name,
                "request_id": scope.request_id,
                "trace_id": scope.request_id,
                "span_id": _log_span.get() or (str(tree.id) if tree else scope.request_id),
                **safe_metadata(values),
            }
        },
    )


class JsonFormatter(logging.Formatter):
    def format(self, record):
        data = {
            "timestamp": datetime.fromtimestamp(record.created, UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
        }
        scope = _request.get()
        if scope:
            tree = get_current_run_tree()
            data.update(
                request_id=scope.request_id,
                trace_id=scope.request_id,
                span_id=_log_span.get() or (str(tree.id) if tree else scope.request_id),
            )
        telemetry = getattr(record, "telemetry", None)
        if telemetry is not None:
            data.update(telemetry)
        elif record.name.startswith(("langsmith", "langchain_core")):
            # SDK exception messages may include HTTP credentials or trace payloads.
            data["event"] = "export_warning"
        else:
            data["message"] = redact(record.getMessage())
        if record.exc_info:
            data["error_type"] = record.exc_info[0].__name__
        return json.dumps(data, ensure_ascii=False)


def configure_logging(level="INFO"):
    for name in ("src", "langsmith", "langchain_core"):
        target = logging.getLogger(name)
        if not any(getattr(h, "copilot_json", False) for h in target.handlers):
            handler = logging.StreamHandler()
            handler.copilot_json = True
            handler.setFormatter(JsonFormatter())
            target.addHandler(handler)
        target.setLevel(level)
        target.propagate = False


@dataclass
class RequestTelemetry:
    request_id: str
    service: TelemetryService
    root: RunTree | None = None
    content_allowed: bool = False
    metadata: dict = field(default_factory=dict)
    tracer: SafeTracer | None = None


class SafeTracer(LangChainTracer):
    """Retain native topology/usage, replace payloads before SDK serialization."""

    def __init__(self, scope):
        super().__init__(client=scope.service.client, project_name=scope.service.project)
        self.scope = scope
        self._capture_ids = set()

    def copy_with_metadata_defaults(self, *, metadata=None, tags=None):
        # Core 1.x clones tracers for model metadata; keep per-request state/maps.
        tracer = copy(self)
        tracer.tracing_metadata = {**(self.tracing_metadata or {}), **safe_metadata(metadata)}
        return tracer

    def _persist_run_single(self, run):
        if run.extra.get("__disabled"):
            return
        capture = (
            run.run_type == "llm"
            and self.scope.content_allowed
            and self.scope.service.capture
            and run.extra.get("metadata", {}).get("node") != "analyze_and_route"
        )
        if capture:
            self._capture_ids.add(run.id)
        safe_call(self.client.create_run, **self._payload(run, capture=capture))

    def _update_run_single(self, run):
        if run.extra.get("__disabled"):
            return
        payload = self._payload(run, capture=run.id in self._capture_ids)
        run_id = payload.pop("id")
        safe_call(self.client.update_run, run_id, **payload)
        self._capture_ids.discard(run.id)

    def _payload(self, run, *, capture):
        error = None
        if run.error:
            # Retain only the exception type from the final traceback line.
            candidate = run.error.strip().splitlines()[-1].split(":", 1)[0]
            error = candidate if re.fullmatch(r"[\w.]*Error|[\w.]*Exception", candidate) else "OperationalError"
        metadata = safe_metadata(run.extra.get("metadata", {}))
        metadata.update(request_id=self.scope.request_id, app_env=self.scope.service.app_env)
        return {
            "id": run.id,
            "name": re.sub(r"[^\w.:-]", "_", run.name[:100]),
            "run_type": run.run_type,
            "start_time": run.start_time,
            "end_time": run.end_time,
            "trace_id": run.trace_id,
            "dotted_order": run.dotted_order,
            "parent_run_id": run.parent_run_id,
            "project_name": self.scope.service.project,
            "extra": {"metadata": metadata},
            "inputs": {"content": redact(run.inputs)} if capture else {},
            "outputs": {"content": redact(run.outputs)} if capture and run.outputs else {},
            "error": error,
            "tags": ["copilot", self.scope.service.app_env],
        }


class TelemetryService:
    def __init__(self, settings, *, client=None):
        self.app_env = settings.app_env
        self.project = settings.langsmith_project
        self.capture = settings.app_env == "development" and settings.langsmith_capture_content
        self.sampling = settings.langsmith_sampling_rate
        self.enabled = settings.langsmith_tracing
        self.client = client
        # Disable SDK ambient tracing. Requests enable it with the controlled client.
        os.environ["LANGSMITH_TRACING"] = "false"
        os.environ["LANGSMITH_TRACING_V2"] = "false"
        os.environ["LANGCHAIN_TRACING_V2"] = "false"
        if self.enabled and self.client is None:
            key = settings.langsmith_api_key.get_secret_value()
            if not key or key.startswith("your-"):
                warning()
                self.enabled = False
            else:
                os.environ["LANGSMITH_TRACING_QUEUE_MAX_SIZE"] = "1000"
                os.environ["LANGSMITH_MAX_INGEST_MEMORY_BYTES"] = str(16 * 1024 * 1024)
                os.environ["LANGSMITH_USE_DAEMON"] = "true"
                self.client = safe_call(
                    Client,
                    api_url=settings.langsmith_endpoint,
                    api_key=key,
                    auto_batch_tracing=True,
                    timeout_ms=2000,
                    retry_config=Retry(total=1, backoff_factor=0),
                    hide_metadata=safe_metadata,
                    omit_traced_runtime_info=True,
                    tracing_sampling_rate=1.0,
                    tracing_error_callback=warning,
                    otel_enabled=False,
                    disable_prompt_cache=True,
                )
                self.enabled = self.client is not None

    def close(self):
        if self.client is not None:
            safe_call(self.client.close, timeout=2)


def annotate(**metadata):
    scope = _request.get()
    if scope:
        scope.metadata.update(safe_metadata(metadata))


def allow_content():
    scope = _request.get()
    if scope:
        scope.content_allowed = True


def graph_config():
    scope = _request.get()
    if scope and scope.tracer:
        return {"callbacks": [scope.tracer], "metadata": {"request_id": scope.request_id}}
    return {}


@contextmanager
def span(name, *, export=True, **metadata):
    scope = _request.get()
    values = safe_metadata(metadata)
    if scope is None:
        yield values
        return
    parent = get_current_run_tree() or scope.root
    tree = None
    if export and scope.root:
        tree = safe_call(parent.create_child, name=name, run_type="chain", inputs={}, extra={"metadata": values})
        if tree:
            safe_call(tree.post)
    token = _log_span.set(str(tree.id) if tree else str(parent.id) if not export and parent else str(uuid4()))
    started, error = time.monotonic(), None
    event("start", **{"operation": name, **values})
    try:
        with tracing_context(parent=tree or parent, enabled=scope.root is not None, client=scope.service.client):
            yield values
    except BaseException as exc:
        error = type(exc).__name__
        raise
    finally:
        error = error or values.get("error_type")
        worker_deadline = worker_timeout.get()
        if worker_deadline is not None and worker_deadline.is_set():
            values["late_completion"] = True
        outcome = (
            "timeout"
            if error == "TimeoutError"
            else "cancelled"
            if error == "CancelledError"
            else "error"
            if error
            else "end"
        )
        event(
            outcome,
            **{
                "operation": name,
                **values,
                "duration_ms": round((time.monotonic() - started) * 1000, 3),
                "error_type": error,
            },
        )
        if tree:
            tree.end(error=error, metadata=safe_metadata(values))
            safe_call(tree.patch)
        _log_span.reset(token)


def instrument(name, **metadata):
    def decorate(function):
        @wraps(function)
        def run(*args, **kwargs):
            with span(name, **metadata):
                return function(*args, **kwargs)

        return run

    return decorate


class _DatabaseResult:
    def __init__(self, result, backend):
        self._result, self._backend = result, backend

    def __getattr__(self, name):
        return getattr(self._result, name)

    def mappings(self):
        return _DatabaseResult(self._result.mappings(), self._backend)

    def _fetch(self, name, *args):
        with span("db.fetch", backend=self._backend):
            return getattr(self._result, name)(*args)

    def fetchall(self):
        return self._fetch("fetchall")

    def fetchone(self):
        return self._fetch("fetchone")

    def first(self):
        return self._fetch("first")


class _DatabaseConnection:
    def __init__(self, connection, backend):
        self._connection, self._backend = connection, backend

    def __getattr__(self, name):
        return getattr(self._connection, name)

    def execute(self, *args, **kwargs):
        with span("db.execute", backend=self._backend):
            return _DatabaseResult(self._connection.execute(*args, **kwargs), self._backend)

    def cursor(self):
        return _DatabaseConnection(self._connection.cursor(), self._backend)

    def executemany(self, *args, **kwargs):
        with span("db.execute_many", backend=self._backend):
            return self._connection.executemany(*args, **kwargs)


@contextmanager
def db_connection(factory, *, backend):
    with span("db.connect", backend=backend):
        manager = factory()
        connection = manager.__enter__()
    try:
        yield _DatabaseConnection(connection, backend)
    except BaseException:
        with span("db.close", backend=backend):
            if not manager.__exit__(*sys.exc_info()):
                raise
    else:
        with span("db.close", backend=backend):
            manager.__exit__(None, None, None)


class CopilotTelemetryMiddleware:
    """ASGI middleware does not consume bodies and starts before dependencies."""

    def __init__(self, app, service):
        self.app, self.service = app, service

    async def __call__(self, scope, receive, send):
        if scope.get("type") != "http" or scope.get("path") != "/api/v1/copilot/query" or scope.get("method") != "POST":
            with tracing_context(enabled=False):
                await self.app(scope, receive, send)
            return
        request_id = uuid4().hex
        scope.setdefault("state", {})["request_id"] = request_id
        telemetry = RequestTelemetry(request_id, self.service)
        if self.service.enabled and random.random() < self.service.sampling:
            telemetry.root = RunTree(
                id=UUID(request_id),
                name="copilot.query",
                project_name=self.service.project,
                ls_client=self.service.client,
                inputs={},
                extra={"metadata": {"request_id": request_id, "app_env": self.service.app_env}},
            )
            telemetry.tracer = SafeTracer(telemetry)
            safe_call(telemetry.root.post)
        token = _request.set(telemetry)
        started, status, error = time.monotonic(), 500, None
        response_started = False

        async def correlated_send(message):
            nonlocal status, response_started
            if message["type"] == "http.response.start":
                status, response_started = message["status"], True
                message = {**message, "headers": [*message.get("headers", []), (b"x-request-id", request_id.encode())]}
            await send(message)

        try:
            with tracing_context(parent=telemetry.root, enabled=telemetry.root is not None, client=self.service.client):
                event("request_start", operation="copilot.query")
                await self.app(scope, receive, correlated_send)
        except Exception as exc:
            error = type(exc).__name__
            if response_started:
                raise
            await correlated_send(
                {"type": "http.response.start", "status": 500, "headers": [(b"content-type", b"application/json")]}
            )
            await correlated_send({"type": "http.response.body", "body": b'{"detail":"Internal Server Error"}'})
        except BaseException as exc:
            error = type(exc).__name__
            raise
        finally:
            metadata = {
                **telemetry.metadata,
                "http_status": status,
                "error_type": error or (telemetry.metadata.get("error_type") if status >= 500 else None),
            }
            event("request_end", duration_ms=round((time.monotonic() - started) * 1000, 3), **metadata)
            if telemetry.root:
                telemetry.root.end(
                    error=error or (f"HTTP_{status}" if status >= 500 else None), metadata=safe_metadata(metadata)
                )
                safe_call(telemetry.root.patch)
            _request.reset(token)
