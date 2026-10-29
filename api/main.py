import asyncio
import logging
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from api.core.config import get_settings
from api.core.logging import RequestLoggingMiddleware, setup_logging
from api.db.session import DbSession, close_db, init_db
from api.routers import admin, auth, drafts, leagues, players
from api.services.scheduler import run_scheduler
from api.utils.rapidapi.rapidapi import close_rapidapi_client

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None]:
    settings = get_settings()
    setup_logging()
    init_db()
    scheduler_task = (
        asyncio.create_task(run_scheduler()) if settings.scheduler_enabled else None
    )
    yield
    if scheduler_task:
        scheduler_task.cancel()
    await close_rapidapi_client()
    await close_db()


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

app.add_middleware(RequestLoggingMiddleware)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(leagues.router, prefix="/api/leagues", tags=["leagues"])
app.include_router(drafts.router, prefix="/api/drafts", tags=["drafts"])
app.include_router(players.router, prefix="/api/players", tags=["players"])
app.include_router(admin.router, prefix="/api/admin", tags=["admin"])


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
