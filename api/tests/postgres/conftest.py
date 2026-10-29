"""Postgres-backed test tier: real SQL, constraints and relationships.

Needs a throwaway database (TEST_DATABASE_URL, default
postgresql+asyncpg://postgres:postgres@localhost:5432/postszn_test). Tests skip
when it is unreachable, except in CI where a missing database must fail loudly.
"""

import asyncio
import os
from collections.abc import AsyncGenerator

import pytest
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

from api.db.models import Base

TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@localhost:5432/postszn_test",
)


async def _recreate_schema() -> None:
    engine = create_async_engine(TEST_DATABASE_URL)
    try:
        async with engine.begin() as conn:
            for schema in ("fantasy", "nfl"):
                await conn.execute(text(f"DROP SCHEMA IF EXISTS {schema} CASCADE"))
                await conn.execute(text(f"CREATE SCHEMA {schema}"))
            await conn.run_sync(Base.metadata.create_all)
    finally:
        await engine.dispose()


@pytest.fixture(scope="session", autouse=True)
def database() -> None:
    try:
        asyncio.run(_recreate_schema())
    except (OSError, SQLAlchemyError) as exc:
        if os.environ.get("CI"):
            raise
        pytest.skip(f"Postgres test database unavailable: {exc}")


@pytest.fixture
async def db() -> AsyncGenerator[AsyncSession]:
    """Session whose work (including commits) is rolled back after each test."""
    engine = create_async_engine(TEST_DATABASE_URL)
    async with engine.connect() as connection:
        transaction = await connection.begin()
        session = AsyncSession(
            bind=connection,
            expire_on_commit=False,
            join_transaction_mode="create_savepoint",
        )
        try:
            yield session
        finally:
            await session.close()
            await transaction.rollback()
    await engine.dispose()
