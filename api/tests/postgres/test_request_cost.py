"""Statements per request (#342): the league list must not grow per league and season."""

from sqlalchemy import event, insert
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models import (
    Draft,
    League,
    LeagueMember,
    NFLGame,
    Season,
    Team,
    User,
)
from api.db.session import REQUEST_SCOPED
from api.services.round_status import load_games
from api.tests.postgres.conftest import ClientFactory
from api.tests.postgres.factories import make_season

EXTRA_LEAGUES = 3


async def _add_league_with_two_seasons(db: AsyncSession, user: User, n: int) -> None:
    league = League(name=f"Extra {n}")
    db.add(league)
    await db.flush()
    db.add(LeagueMember(league_id=league.id, user_id=user.id, role="member"))
    for year in (2024, 2025):
        season = Season(league_id=league.id, year=year)
        db.add(season)
        await db.flush()
        db.add(Team(name=f"T{n}-{year}", owner_id=user.id, season_id=season.id))
        db.add(Draft(season_id=season.id, status="completed", rounds=1))
    await db.flush()


async def _statements_for(db: AsyncSession, client_as: ClientFactory, path: str) -> int:
    db.info[REQUEST_SCOPED] = True
    seen: list[str] = []

    def record(conn, cursor, statement, *args):  # type: ignore[no-untyped-def]
        seen.append(statement)

    sync_engine = (await db.connection()).sync_engine
    event.listen(sync_engine, "before_cursor_execute", record)
    try:
        async with client_as("uid-0") as client:
            assert (await client.get(path)).status_code == 200
    finally:
        event.remove(sync_engine, "before_cursor_execute", record)
        db.info.pop(REQUEST_SCOPED, None)
    return len(seen)


async def test_the_league_list_costs_a_fixed_number_of_statements_per_league(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    _, users, _, _ = await make_season(db, teams=2)
    baseline = await _statements_for(db, client_as, "/api/leagues/user-leagues")
    for n in range(EXTRA_LEAGUES):
        await _add_league_with_two_seasons(db, users[0], n)
    with_more = await _statements_for(db, client_as, "/api/leagues/user-leagues")

    per_league = (with_more - baseline) / EXTRA_LEAGUES
    # Before #342 each league with two seasons cost 7 statements; the seasons, teams and
    # drafts of a league are now one query each, and each year's games load once.
    assert per_league <= 4


async def test_a_requests_games_are_read_once_and_a_write_refreshes_them(
    db: AsyncSession,
) -> None:
    db.info[REQUEST_SCOPED] = True
    assert await load_games(db, 2025) == []

    db.add(
        NFLGame(
            id="g1",
            season=2025,
            season_type="post",
            game_week=19,
            game_status="Completed",
        )
    )
    await db.flush()

    assert len(await load_games(db, 2025)) == 1


async def test_a_session_that_is_not_a_requests_never_memoizes(
    db: AsyncSession,
) -> None:
    assert await load_games(db, 2025) == []
    await db.execute(
        insert(NFLGame).values(id="g2", season=2025, season_type="post", game_week=19)
    )
    # `insert()` through the session also drops a memo, but here none was ever kept.
    assert REQUEST_SCOPED not in db.info
    assert len(await load_games(db, 2025)) == 1
