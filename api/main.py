import asyncio
import logging
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from api.core.config import get_settings
from api.core.logging import RequestLoggingMiddleware, setup_logging
from api.core.observability import init_sentry
from api.db.session import DbSession, close_db, init_db
from api.routers import (
    activity,
    admin,
    auth,
    drafts,
    invites,
    leagues,
    players,
    teams,
)
from api.services.draft_clock import run_draft_clock
from api.services.ingestion.guard import IngestionBusy
from api.services.scheduler import run_scheduler
from api.utils.rapidapi.rapidapi import close_rapidapi_client

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None]:
    settings = get_settings()
    setup_logging()
    if settings.test_auth_stub:
        logger.warning("TEST_AUTH_STUB is on: e2e bearer tokens bypass Supabase")
    init_db()
    clock_task = asyncio.create_task(run_draft_clock())
    scheduler_task = (
        asyncio.create_task(run_scheduler()) if settings.scheduler_enabled else None
    )
    yield
    clock_task.cancel()
    if scheduler_task:
        scheduler_task.cancel()
    await close_rapidapi_client()
    await close_db()


# Before the app exists so the FastAPI/Starlette integrations can patch it.
init_sentry(get_settings())

app = FastAPI(
    title="PostSznFantasy API",
    description="Fantasy football platform for NFL postseason",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(RequestLoggingMiddleware)


@app.exception_handler(IngestionBusy)
async def ingestion_busy_handler(_: Request, exc: IngestionBusy) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_409_CONFLICT, content={"detail": str(exc)}
    )


app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(leagues.router, prefix="/api/leagues", tags=["leagues"])
app.include_router(teams.router, prefix="/api/teams", tags=["teams"])
app.include_router(invites.router, prefix="/api", tags=["invites"])
app.include_router(activity.router, prefix="/api", tags=["activity"])
app.include_router(drafts.router, prefix="/api/drafts", tags=["drafts"])
app.include_router(players.router, prefix="/api/players", tags=["players"])
app.include_router(admin.router, prefix="/api/admin", tags=["admin"])


@app.get("/api/config", tags=["config"])
async def public_config() -> dict[str, int]:
    """Single source of truth for values the frontend must not hardcode."""
    return {"season": get_settings().season_year}


@app.get("/api", tags=["health"])
async def health(db: DbSession) -> dict[str, str]:
    """Liveness plus a database round trip, so deploy checks catch a dead pool."""
    try:
        await db.execute(text("SELECT 1"))
    except SQLAlchemyError as exc:
        logger.exception("Health check failed")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database unavailable",
        ) from exc
    return {"status": "healthy"}
