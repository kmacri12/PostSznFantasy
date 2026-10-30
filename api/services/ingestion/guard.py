import functools
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime
from enum import IntEnum
from typing import Concatenate

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models.nfl import IngestionStatus

# First half of the two-int advisory lock key; keeps these clear of any other lock use.
LOCK_NAMESPACE = 7_105


class IngestionKind(IntEnum):
    TEAMS = 1
    PLAYERS = 2
    SEASON_STATS = 3
    BOX_SCORES = 4
    GAMES = 5
    DEPTH_CHARTS = 6


class IngestionBusy(Exception):
    """The same ingestion type is already running in another transaction."""


def guarded[**P](
    kind: IngestionKind,
) -> Callable[
    [Callable[Concatenate[AsyncSession, P], Awaitable[int]]],
    Callable[Concatenate[AsyncSession, P], Awaitable[int]],
]:
    """Skip (raise IngestionBusy) when this kind is already running, else record the run.

    The lock is transaction-scoped: ingest functions never commit, so it is held until
    the caller commits or rolls back, and re-entering it within one session is a no-op.
    """

    def decorate(
        ingest: Callable[Concatenate[AsyncSession, P], Awaitable[int]],
    ) -> Callable[Concatenate[AsyncSession, P], Awaitable[int]]:
        @functools.wraps(ingest)
        async def wrapper(
            db: AsyncSession, /, *args: P.args, **kwargs: P.kwargs
        ) -> int:
            acquired = await db.scalar(
                select(func.pg_try_advisory_xact_lock(LOCK_NAMESPACE, kind.value))
            )
            if acquired is False:
                raise IngestionBusy(f"{kind.name.lower()} ingestion is already running")
            count = await ingest(db, *args, **kwargs)
            now = datetime.now(UTC)
            await db.execute(
                insert(IngestionStatus)
                .values(kind=kind.name.lower(), last_synced_at=now)
                .on_conflict_do_update(
                    index_elements=[IngestionStatus.kind],
                    set_={"last_synced_at": now},
                )
            )
            return count

        return wrapper

    return decorate
