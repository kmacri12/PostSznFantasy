"""Two API instances run two draft clocks; an overdue pick must still happen once."""

import asyncio
from collections.abc import AsyncGenerator
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from api.db.models import DraftPick, NFLTeam
from api.services import draft_flow
from api.services.draft_picks import PickNotDue
from api.tests.postgres.conftest import TEST_DATABASE_URL
from api.tests.postgres.factories import make_league, make_players


@pytest.fixture
async def committed() -> AsyncGenerator[async_sessionmaker[AsyncSession]]:
    """Real commits (two clocks need separate transactions); wiped afterwards."""
    engine = create_async_engine(TEST_DATABASE_URL)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    yield factory
    async with engine.begin() as conn:
        tables = (
            await conn.execute(
                text(
                    "SELECT schemaname || '.' || tablename FROM pg_tables "
                    "WHERE schemaname IN ('fantasy', 'nfl')"
                )
            )
        ).scalars()
        await conn.execute(
            text(f"TRUNCATE {', '.join(tables)} RESTART IDENTITY CASCADE")
        )
    await engine.dispose()


async def test_concurrent_clocks_make_exactly_one_auto_pick(
    committed: async_sessionmaker[AsyncSession],
) -> None:
    async with committed() as db:
        league, _, _, draft = await make_league(db, roster_total=3)
        kc = NFLTeam(id=1, team_abv="KC", is_active=True, in_playoffs=True)
        db.add(kc)
        await db.flush()
        await make_players(db, ["QB", "RB", "WR"], nfl_team=kc)
        draft.current_pick_deadline = datetime.now(UTC) - timedelta(seconds=1)
        league_id = league.id
        await db.commit()

    async def one_clock() -> str:
        async with committed() as db:
            try:
                result = await draft_flow.auto_pick(db, league_id, only_if_overdue=True)
            except PickNotDue:
                await db.rollback()
                return "not_due"
            await db.commit()
            return f"picked {result.pick.number_pick_overall}"

    outcomes = await asyncio.gather(one_clock(), one_clock())

    assert sorted(outcomes) == ["not_due", "picked 1"]
    async with committed() as db:
        assert len((await db.execute(select(DraftPick))).scalars().all()) == 1
