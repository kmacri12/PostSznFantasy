"""Simultaneous joins on one invite, each in its own transaction."""

import asyncio
from collections.abc import AsyncGenerator

import pytest
from sqlalchemy import delete, func, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from api.db.models import LeagueInvite, LeagueMember, Team, User
from api.services import invites
from api.services.league_members import LeagueRuleError
from api.tests.postgres.conftest import TEST_DATABASE_URL
from api.tests.postgres.factories import make_season


@pytest.fixture
async def committed() -> AsyncGenerator[async_sessionmaker[AsyncSession]]:
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


async def _league_with_open_teams(
    factory: async_sessionmaker[AsyncSession], max_uses: int | None
) -> tuple[int, str]:
    """Commissioner plus three users who are not yet members; three open teams."""
    async with factory() as db:
        season, users, _, _ = await make_season(
            db, teams=4, draft_status="scheduled", ordered=False
        )
        await db.execute(
            delete(LeagueMember).where(
                LeagueMember.user_id.in_([u.id for u in users[1:]])
            )
        )
        await db.execute(
            update(Team).where(Team.owner_id != users[0].id).values(owner_id=None)
        )
        invite = await invites.create_invite(
            db, season.league_id, users[0].id, None, max_uses
        )
        league_id, code = season.league_id, invite.code
        await db.commit()
    return league_id, code


async def _join(factory: async_sessionmaker[AsyncSession], code: str, uid: str) -> str:
    async with factory() as db:
        invite = await invites.find_invite(db, code)
        assert invite is not None
        user = (
            await db.execute(select(User).where(User.supabase_uid == uid))
        ).scalar_one()
        try:
            _, _, already = await invites.join_league(db, invite, user)
        except LeagueRuleError as exc:
            await db.rollback()
            return str(exc)
        await db.commit()
        return "already" if already else "joined"


async def test_max_uses_is_not_exceeded_by_simultaneous_joins(
    committed: async_sessionmaker[AsyncSession],
) -> None:
    _, code = await _league_with_open_teams(committed, max_uses=1)

    outcomes = await asyncio.gather(
        _join(committed, code, "uid-1"), _join(committed, code, "uid-2")
    )

    assert sorted(outcomes) == ["This invite has reached its usage limit", "joined"]
    async with committed() as db:
        assert await db.scalar(select(LeagueInvite.uses)) == 1


async def test_a_double_join_by_one_user_succeeds_once_and_is_then_a_no_op(
    committed: async_sessionmaker[AsyncSession],
) -> None:
    league_id, code = await _league_with_open_teams(committed, max_uses=None)

    outcomes = await asyncio.gather(
        _join(committed, code, "uid-1"), _join(committed, code, "uid-1")
    )

    assert sorted(outcomes) == ["already", "joined"]
    async with committed() as db:
        members = await db.scalar(
            select(func.count())
            .select_from(LeagueMember)
            .where(LeagueMember.league_id == league_id, LeagueMember.user_id == 2)
        )
        assert members == 1
        assert await db.scalar(select(LeagueInvite.uses)) == 1
