"""Two API instances run two draft clocks; an overdue pick must still happen once."""

import asyncio
from collections.abc import AsyncGenerator
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from api.db.models import DraftPick, NFLTeam, User
from api.services import draft_flow
from api.services.draft_picks import DraftPickError, PickNotDue, make_pick
from api.tests.postgres.conftest import TEST_DATABASE_URL
from api.tests.postgres.factories import make_players, make_season


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


@pytest.mark.parametrize(
    ("roster_total", "picks_before"),
    [(3, 0), (1, 1)],
    ids=["mid_draft", "final_pick_completes_the_draft"],
)
async def test_concurrent_clocks_make_exactly_one_auto_pick(
    committed: async_sessionmaker[AsyncSession], roster_total: int, picks_before: int
) -> None:
    async with committed() as db:
        season, users, _, draft = await make_season(db, roster_total=roster_total)
        kc = NFLTeam(id=1, team_abv="KC", is_active=True, in_playoffs=True)
        db.add(kc)
        await db.flush()
        players = await make_players(db, ["QB", "RB", "WR"], nfl_team=kc)
        for user, player in zip(users[:picks_before], players, strict=False):
            await make_pick(db, season.id, user, player.id)
        draft.current_pick_deadline = datetime.now(UTC) - timedelta(seconds=1)
        league_id = season.id
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

    assert sorted(outcomes) == ["not_due", f"picked {picks_before + 1}"]
    async with committed() as db:
        picks = (await db.execute(select(DraftPick))).scalars().all()
        assert len(picks) == picks_before + 1


async def _two_picks_setup(
    committed: async_sessionmaker[AsyncSession], *, overdue: bool
) -> tuple[int, list[int], int]:
    async with committed() as db:
        season, users, _, draft = await make_season(db, roster_total=3)
        kc = NFLTeam(id=1, team_abv="KC", is_active=True, in_playoffs=True)
        db.add(kc)
        await db.flush()
        players = await make_players(db, ["QB", "RB"], nfl_team=kc)
        if overdue:
            draft.current_pick_deadline = datetime.now(UTC) - timedelta(seconds=1)
        season_id, user_id = season.id, users[0].id
        player_ids = [p.id for p in players]
        await db.commit()
    return season_id, player_ids, user_id


async def test_the_same_member_picking_from_two_devices_picks_once(
    committed: async_sessionmaker[AsyncSession],
) -> None:
    season_id, player_ids, user_id = await _two_picks_setup(committed, overdue=False)

    async def device(player_id: int) -> str:
        async with committed() as db:
            user = await db.get(User, user_id)
            assert user is not None
            try:
                result = await make_pick(db, season_id, user, player_id)
            except DraftPickError as error:
                await db.rollback()
                return error.code or "refused"
            await db.commit()
            return "replayed" if result.already_recorded else "picked"

    same = await asyncio.gather(device(player_ids[0]), device(player_ids[0]))
    assert sorted(same) == ["picked", "replayed"]
    other = await asyncio.gather(device(player_ids[1]), device(player_ids[1]))
    assert sorted(other) == ["not_your_turn", "not_your_turn"]
    async with committed() as db:
        assert len((await db.execute(select(DraftPick))).scalars().all()) == 1


async def test_a_pick_at_the_deadline_and_the_auto_pick_resolve_to_one_pick(
    committed: async_sessionmaker[AsyncSession],
) -> None:
    season_id, player_ids, user_id = await _two_picks_setup(committed, overdue=True)

    async def manager() -> None:
        async with committed() as db:
            user = await db.get(User, user_id)
            assert user is not None
            try:
                await make_pick(db, season_id, user, player_ids[0])
            except DraftPickError:
                await db.rollback()
                return
            await db.commit()

    async def clock() -> None:
        async with committed() as db:
            try:
                await draft_flow.auto_pick(db, season_id, only_if_overdue=True)
            except PickNotDue:
                await db.rollback()
                return
            await db.commit()

    await asyncio.gather(manager(), clock())
    async with committed() as db:
        picks = (await db.execute(select(DraftPick))).scalars().all()
        assert [p.number_pick_overall for p in picks] == [1]
