import logging
from collections.abc import AsyncGenerator
from typing import Annotated

from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from api.core.config import get_settings

logger = logging.getLogger(__name__)

# Key in `Session.info` set on a request's own session (not on the scheduler's or a
# script's, which live across ingests), so services may memoize reads for the request.
REQUEST_SCOPED = "request_scoped"

engine: AsyncEngine | None = None
AsyncSessionLocal: async_sessionmaker[AsyncSession] | None = None


def init_db() -> None:
    """Initialize async engine and session factory.

    Called once during application startup in lifespan.
    Configured with production-grade pooling and connection health checks.
    """
    global engine, AsyncSessionLocal
    settings = get_settings()
    db_url = settings.async_database_url

    engine = create_async_engine(
        db_url,
        echo=False,
        pool_size=settings.db_pool_size,
        max_overflow=settings.db_max_overflow,
        pool_pre_ping=True,  # Detect and discard stale/dead connections
    )

    AsyncSessionLocal = async_sessionmaker(
        bind=engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autocommit=False,
        autoflush=False,
    )
    logger.info(
        "Initialized async database engine.",
        extra={
            "pool_size": settings.db_pool_size,
            "max_overflow": settings.db_max_overflow,
        },
    )


async def close_db() -> None:
    """Gracefully dispose database connection pool during application shutdown."""
    global engine
    if engine is not None:
        await engine.dispose()
        logger.info("Disposed async database engine connection pool.")


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    """Return the session factory, initializing DB engine if not already initialized."""
    global AsyncSessionLocal
    if AsyncSessionLocal is None:
        init_db()
    assert AsyncSessionLocal is not None
    return AsyncSessionLocal


async def get_db() -> AsyncGenerator[AsyncSession]:
    """FastAPI dependency yielding an async database session per request.

    Commits on success, rolls back on exception, and ensures the session is closed.
    """
    if AsyncSessionLocal is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database service unavailable or unconfigured.",
        )

    async with AsyncSessionLocal() as session:
        session.info[REQUEST_SCOPED] = True
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


# Type-annotated alias for injection in route handlers: db: DbSession
# scope="function" commits when the handler returns, before the response is sent; the
# default ("request") would commit after, so a client's next request could miss the write.
DbSession = Annotated[AsyncSession, Depends(get_db, scope="function")]
