import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware

from src.api.auth import CurrentUserDependency, build_auth_service, create_auth_router
from src.api.copilot import router as copilot_router
from src.api.recorded_practice import create_recorded_practice_routers
from src.api.routes import router
from src.config import get_settings
from src.integrations.practice_records import SQLPracticeRecordsRepository
from src.integrations.practice_runtime import build_practice_service
from src.knowledge.retrieval_service import get_retrieval_service
from src.models.auth import UserRole
from src.services.recorded_practice import RecordedPracticeService

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    print(f"Starting {settings.app_name} in {settings.app_env} mode")
    if settings.app_env == "production":
        created = await auth_service.bootstrap_manager(
            username=settings.bootstrap_manager_username,
            display_name=settings.bootstrap_manager_display_name,
            password=settings.bootstrap_manager_password,
        )
        if created:
            logger.info("Created the initial manager account")
    try:
        # Existing data is reused. Replacing an index is an explicit ingestion action.
        retriever = get_retrieval_service()
        if retriever.vector_store.count() == 0:
            count = await asyncio.wait_for(
                asyncio.to_thread(retriever.ingest_corpus, reset=False),
                timeout=settings.knowledge_startup_timeout_seconds,
            )
            logger.info("Initialized empty knowledge index with %d chunks", count)
    except Exception:
        logger.exception("Knowledge startup failed")
        if settings.app_env == "production":
            raise
    yield
    print("Shutting down...")


app = FastAPI(
    title="AI20K Agent",
    description="AI Agent built with LangGraph",
    version="1.0.0",
    lifespan=lifespan,
)

settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api/v1")
auth_service = build_auth_service(settings)
current_user = CurrentUserDependency(auth_service, settings.auth_cookie_name)


async def require_advisor_for_copilot(request: Request) -> None:
    identity = await current_user(request)
    if identity.role is not UserRole.ADVISOR:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Advisor access required.")


recorded_practice = RecordedPracticeService(
    build_practice_service(),
    SQLPracticeRecordsRepository(settings.database_url),
    auth_service,
)
practice_router, manager_router = create_recorded_practice_routers(recorded_practice, current_user)
app.include_router(create_auth_router(auth_service, settings), prefix="/api/v1")
app.include_router(copilot_router, prefix="/api/v1", dependencies=[Depends(require_advisor_for_copilot)])
app.include_router(practice_router, prefix="/api/v1")
app.include_router(manager_router, prefix="/api/v1")


@app.get("/health")
async def health():
    return {"status": "ok", "env": settings.app_env}
