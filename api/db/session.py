import logging
import os
from collections.abc import AsyncGenerator
from typing import Annotated

from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

logger = logging.getLogger(__name__)

engine: AsyncEngine | None = None
AsyncSessionLocal: async_sessionmaker[AsyncSession] | None = None


def get_database_url() -> str | None:
    """Read database connection URL and format for asyncpg driver."""
    raw_uri = os.getenv("PG_URI")
    if not raw_uri:
        # Check standard discrete PG environment variables as fallback
        host = os.getenv("PG_HOST")
        if host:
            user = os.getenv("PG_USER", "postgres")
            password = os.getenv("PG_PASSWORD", "postgres")
            port = os.getenv("PG_PORT", "5432")
            dbname = os.getenv("PG_DBNAME", "postszn")
            return f"postgresql+asyncpg://{user}:{password}@{host}:{port}/{dbname}"
        return None

    # Normalise standard postgresql:// prefix to asyncpg dialect
    if raw_uri.startswith("postgresql://"):
        return raw_uri.replace("postgresql://", "postgresql+asyncpg://", 1)
    return raw_uri


def init_db() -> None:
    """Initialize async engine and session factory.

    Called once during application startup in lifespan.
    Configured with production-grade pooling and connection health checks.
    """
    global engine, AsyncSessionLocal
    db_url = get_database_url()
    if not db_url:
        logger.warning(
            "PG_URI / PG_HOST not configured. Database engine not initialized."
        )
        return

    engine = create_async_engine(
        db_url,
        echo=False,
        pool_size=20,
        max_overflow=10,
        pool_pre_ping=True,  # Detect and discard stale/dead connections
    )

    AsyncSessionLocal = async_sessionmaker(
        bind=engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autocommit=False,
        autoflush=False,
    )
    logger.info("Initialized async database engine.")


async def close_db() -> None:
    """Gracefully dispose database connection pool during application shutdown."""
    global engine
    if engine is not None:
        await engine.dispose()
        logger.info("Disposed async database engine connection pool.")


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
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


# Type-annotated alias for injection in route handlers: db: DbSession
DbSession = Annotated[AsyncSession, Depends(get_db)]
