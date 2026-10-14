import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from src.agents.copilot.runtime import CopilotAdmission, bounded_io
from src.api.auth import CurrentUserDependency, build_auth_service, create_auth_router
from src.api.copilot import router as copilot_router
from src.api.recorded_practice import create_recorded_practice_routers
from src.api.routes import router
from src.config import get_settings
from src.integrations.copilot_sessions import SQLCopilotSessionsRepository
from src.integrations.practice_records import SQLPracticeRecordsRepository
from src.integrations.practice_runtime import build_practice_service
from src.knowledge.index_readiness import check_copilot_index
from src.knowledge.retrieval_service import get_retrieval_service
from src.observability import CopilotTelemetryMiddleware, TelemetryService, configure_logging
from src.services.recorded_practice import RecordedPracticeService

logger = logging.getLogger(__name__)


class LazyKnowledgeRetriever:
    """Initialize knowledge storage when used, so liveness can report index failures."""

    def retrieve(self, *args, **kwargs):
        return get_retrieval_service().retrieve(*args, **kwargs)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    configure_logging(settings.log_level)
    logger.info("Application starting env=%s", settings.app_env)
    try:
        await bounded_io(app.state.copilot_readiness, 45)
        logger.info("Copilot index is ready")
    except Exception as exc:
        logger.warning("Knowledge startup failed (%s)", type(exc).__name__)
    try:
        yield
    finally:
        await asyncio.to_thread(app.state.copilot_telemetry.close)
        logger.info("Application shutdown")


app = FastAPI(
    title="AI20K Agent",
    description="AI Agent built with LangGraph",
    version="1.0.0",
    lifespan=lifespan,
)

settings = get_settings()
app.state.copilot_telemetry = TelemetryService(settings)
app.add_middleware(CopilotTelemetryMiddleware, service=app.state.copilot_telemetry)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID"],
)

app.include_router(router, prefix="/api/v1")
auth_service = build_auth_service(settings)
current_user = CurrentUserDependency(auth_service, settings.auth_cookie_name)
app.state.current_user = current_user
app.state.copilot_readiness = check_copilot_index
app.state.copilot_admission = CopilotAdmission(settings)
app.state.copilot_sessions = SQLCopilotSessionsRepository(
    settings.database_url,
    ttl_hours=settings.copilot_session_ttl_hours,
)
recorded_practice = RecordedPracticeService(
    build_practice_service(retrieval_service=LazyKnowledgeRetriever()),
    SQLPracticeRecordsRepository(settings.database_url),
)
practice_router, manager_router = create_recorded_practice_routers(recorded_practice, current_user)
app.include_router(create_auth_router(auth_service, settings), prefix="/api/v1")
app.include_router(copilot_router, prefix="/api/v1")
app.include_router(practice_router, prefix="/api/v1")
app.include_router(manager_router, prefix="/api/v1")


@app.get("/health")
async def health():
    return {"status": "ok", "env": settings.app_env}


@app.get("/ready")
async def ready():
    try:
        await bounded_io(app.state.copilot_readiness, 20)
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Copilot index is not ready") from exc
    return {"status": "ready"}
