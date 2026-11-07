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
    avatars,
    drafts,
    invites,
    leagues,
    players,
    push,
    seasons,
    support,
    teams,
)
from api.services.draft_clock import run_draft_clock
from api.services.ingestion.guard import IngestionBusy
from api.services.live_leagues import LeagueDeletedError
from api.services.scheduler import run_scheduler
from api.utils.rapidapi.rapidapi import close_rapidapi_client
from api.ws.broadcast_relay import PostgresRelay
from api.ws.draft_manager import draft_manager
from api.ws.feed_manager import feed_manager

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None]:
    settings = get_settings()
    setup_logging()
    if settings.test_auth_stub:
        logger.warning("TEST_AUTH_STUB is on: e2e bearer tokens bypass Supabase")
    init_db()
    relays: list[PostgresRelay] = []
    if settings.draft_broadcast == "postgres":
        for manager, channel in (
            (draft_manager, "draft_events"),
            (feed_manager, "feed_events"),
        ):
            relay = PostgresRelay(
                settings.async_database_url, manager.deliver_local, channel
            )
            await relay.start()
            manager.use_relay(relay)
            relays.append(relay)
    clock_task = asyncio.create_task(run_draft_clock())
    scheduler_task = (
        asyncio.create_task(run_scheduler()) if settings.scheduler_enabled else None
    )
    yield
    clock_task.cancel()
    if scheduler_task:
        scheduler_task.cancel()
    draft_manager.use_relay(None)
    feed_manager.use_relay(None)
    for relay in relays:
        await relay.stop()
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
    # The support report quotes the id of a failed request so its log line can be found.
    expose_headers=["X-Request-ID"],
)

app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(RequestLoggingMiddleware)


@app.exception_handler(LeagueDeletedError)
async def league_deleted_handler(_: Request, exc: LeagueDeletedError) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_404_NOT_FOUND,
        content={
            "detail": exc.detail,
            "code": "leagueDeleted",
            "leagueName": exc.league_name,
            "deletedAt": exc.deleted_at.isoformat() if exc.deleted_at else None,
        },
    )


@app.exception_handler(IngestionBusy)
async def ingestion_busy_handler(_: Request, exc: IngestionBusy) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_409_CONFLICT, content={"detail": str(exc)}
    )


app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(leagues.router, prefix="/api/leagues", tags=["leagues"])
app.include_router(seasons.router, prefix="/api/seasons", tags=["seasons"])
app.include_router(teams.router, prefix="/api/teams", tags=["teams"])
app.include_router(invites.router, prefix="/api", tags=["invites"])
app.include_router(activity.router, prefix="/api", tags=["activity"])
app.include_router(drafts.router, prefix="/api/drafts", tags=["drafts"])
app.include_router(players.router, prefix="/api/players", tags=["players"])
app.include_router(push.router, prefix="/api/push", tags=["push"])
app.include_router(support.router, prefix="/api/support", tags=["support"])
app.include_router(avatars.router, prefix="/api", tags=["avatars"])
app.include_router(admin.router, prefix="/api/admin", tags=["admin"])


@app.get("/api/config", tags=["config"])
async def public_config() -> dict[str, int]:
    """Single source of truth for values the frontend must not hardcode."""
    return {"season": get_settings().season_year}


# HEAD because UptimeRobot's free plan cannot send GET.
@app.api_route("/api", methods=["GET", "HEAD"], tags=["health"])
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
    return {"status": "healthy", "version": get_settings().git_sha}
