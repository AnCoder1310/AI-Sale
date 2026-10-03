import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.api.auth import build_auth_service, create_auth_router
from src.api.copilot import router as copilot_router
from src.api.practice import create_practice_router
from src.api.routes import router
from src.config import get_settings
from src.integrations.practice_runtime import build_practice_service
from src.knowledge.retrieval_service import get_retrieval_service

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    print(f"Starting {settings.app_name} in {settings.app_env} mode")
    try:
        # Existing data is reused. Replacing an index is an explicit ingestion action.
        retriever = get_retrieval_service()
        if retriever.vector_store.count() == 0:
            count = await asyncio.to_thread(retriever.ingest_corpus, reset=False)
            logger.info("Initialized empty knowledge index with %d chunks", count)
    except Exception as exc:
        logger.warning("Knowledge startup failed (%s)", type(exc).__name__)
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
app.include_router(create_auth_router(build_auth_service(settings), settings), prefix="/api/v1")
app.include_router(copilot_router, prefix="/api/v1")
app.include_router(create_practice_router(build_practice_service()), prefix="/api/v1")


@app.get("/health")
async def health():
    return {"status": "ok", "env": settings.app_env}
