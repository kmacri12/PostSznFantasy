import os
from collections.abc import AsyncGenerator
from typing import Annotated

from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

# Module-level engine/session-factory; initialised once by lifespan in main.py.
# Using None as sentinel — FastAPI will refuse requests if get_db is called
# before lifespan has run (engine stays None), which is the correct fail-fast behaviour.
_engine = None
_session_factory: async_sessionmaker[AsyncSession] | None = None


def init_db_engine() -> None:
    """Create the async engine and session factory from PG_URI env var.

    Called once at application startup inside the lifespan context manager.
    Converts a plain postgresql:// URI to postgresql+asyncpg:// automatically.
    Skips initialisation when PG_URI is unset so the app can still start without
    a database configured; requests that call get_db will raise a 503.
    """
    global _engine, _session_factory
    raw_uri = os.getenv("PG_URI")
    if not raw_uri:
        return
    pg_uri = raw_uri.replace("postgresql://", "postgresql+asyncpg://", 1)
    _engine = create_async_engine(pg_uri, pool_pre_ping=True)
    _session_factory = async_sessionmaker(_engine, expire_on_commit=False)


async def dispose_db_engine() -> None:
    """Dispose the async engine connection pool at application shutdown."""
    if _engine is not None:
        await _engine.dispose()


async def get_db() -> AsyncGenerator[AsyncSession]:
    """Yield a scoped AsyncSession; rolls back automatically on any exception."""
    if _session_factory is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database not configured.",
        )
    async with _session_factory() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise


# Convenience alias so route signatures read: db: DbSession
DbSession = Annotated[AsyncSession, Depends(get_db)]
