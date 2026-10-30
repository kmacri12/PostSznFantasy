from decimal import Decimal

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.core.config import get_settings
from api.db.models import (
    LeagueStanding,
    NFLGame,
    NFLPlayerGameStats,
    NFLTeam,
    TeamPlayer,
)
from api.services.scheduler import run_poll_cycle
from api.services.standings import recompute_standings
from api.tests.postgres.conftest import ClientFactory
from api.tests.postgres.factories import make_league, make_players
from api.tests.postgres.test_live_polling import NOW, FakeClient, box, summary


async def _stored(db: AsyncSession, league_id: int) -> dict[int, LeagueStanding]:
    rows = (
        (
            await db.execute(
                select(LeagueStanding)
                .where(LeagueStanding.league_id == league_id)
                .execution_options(populate_existing=True)
            )
        )
        .scalars()
        .all()
    )
    return {row.team_id: row for row in rows}


async def test_starters_score_per_round_and_the_bench_does_not(
    db: AsyncSession,
) -> None:
    league, _, teams, _ = await make_league(db)
    kc = NFLTeam(id=1, team_abv="KC", is_active=True)
    buf = NFLTeam(id=2, team_abv="BUF", is_active=True)
    db.add_all([kc, buf])
    await db.flush()
    starter, bench = await make_players(db, ["QB", "QB"], nfl_team=kc)
    (rival,) = await make_players(db, ["QB"], nfl_team=buf, first_id=2000)
    db.add_all(
        [
            TeamPlayer(team_id=teams[0].id, league_id=league.id, player_id=p.id)
            for p in (starter, bench)
        ]
        + [TeamPlayer(team_id=teams[1].id, league_id=league.id, player_id=rival.id)]
    )
    db.add_all(
        [
            NFLGame(id="wc", season=2025, season_type="post", game_week=1),
            NFLGame(id="div", season=2025, season_type="post", game_week=20),
        ]
    )
    await db.flush()
    # 300 yds + 2 TD = 20 points; the 40-point bench QB must not count.
    db.add_all(
        [
            NFLPlayerGameStats(
                game_id="wc", player_id=starter.id, passing_yards=300,
                passing_touchdowns=2,
            ),
            NFLPlayerGameStats(
                game_id="div", player_id=starter.id, passing_yards=100
            ),
            NFLPlayerGameStats(
                game_id="wc", player_id=bench.id, passing_yards=1000
            ),
            NFLPlayerGameStats(game_id="wc", player_id=rival.id, passing_yards=50),
        ]
    )  # fmt: skip
    await db.flush()

    await recompute_standings(db, 2025)

    rows = await _stored(db, league.id)
    first, second = rows[teams[0].id], rows[teams[1].id]
    assert (first.rank, first.wild_card, first.divisional) == (1, 20, 4)
    assert first.total == Decimal("24")
    assert (first.conf_champ, first.super_bowl) == (0, 0)
    assert (second.rank, second.total, second.players_left) == (2, Decimal("2"), 1)
    assert first.players_left == 2


async def _two_team_league(db: AsyncSession) -> tuple[int, list[int]]:
    league, _, teams, _ = await make_league(db)
    db.add_all([NFLTeam(id=1, team_abv="KC", is_active=True)])
    db.add(NFLTeam(id=2, team_abv="BUF", is_active=True))
    await db.flush()
    (kc_qb,) = await make_players(db, ["QB"], nfl_team=await db.get(NFLTeam, 1))
    (buf_qb,) = await make_players(
        db, ["QB"], nfl_team=await db.get(NFLTeam, 2), first_id=2000
    )
    db.add_all(
        [
            TeamPlayer(team_id=teams[0].id, league_id=league.id, player_id=kc_qb.id),
            TeamPlayer(team_id=teams[1].id, league_id=league.id, player_id=buf_qb.id),
        ]
    )
    await db.flush()
    return league.id, [t.id for t in teams]


async def test_a_poll_that_eliminates_a_team_updates_players_left(
    db: AsyncSession,
) -> None:
    league_id, (kc_owner, buf_owner) = await _two_team_league(db)
    await recompute_standings(db, 2025)
    before = await _stored(db, league_id)
    assert (before[kc_owner].players_left, before[buf_owner].players_left) == (1, 1)
    assert before[kc_owner].rank == before[buf_owner].rank == 1

    client = FakeClient(
        games=[summary("g1", NOW - 3600, "Live - In Progress")],
        boxes={"g1": box("Completed", 27, 24)},
    )
    await run_poll_cycle(db, 2025, client=client, now=NOW)  # type: ignore[arg-type]

    after = await _stored(db, league_id)
    assert (after[kc_owner].players_left, after[buf_owner].players_left) == (1, 0)
    assert (after[kc_owner].rank, after[buf_owner].rank) == (1, 2)


async def test_a_manual_result_updates_standings(
    db: AsyncSession, client_as: ClientFactory, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("ADMIN_SUPABASE_UIDS", "admin-uid")
    get_settings.cache_clear()
    league_id, (kc_owner, buf_owner) = await _two_team_league(db)
    async with client_as("admin-uid") as admin:
        response = await admin.put(
            "/api/admin/games/manual/result",
            json={
                "season": 2025,
                "teamIdHome": 1,
                "teamIdAway": 2,
                "homePts": 10,
                "awayPts": 20,
            },
        )
    get_settings.cache_clear()
    assert response.status_code == 200
    rows = await _stored(db, league_id)
    assert (rows[kc_owner].players_left, rows[buf_owner].players_left) == (0, 1)
    assert rows[buf_owner].rank == 1


async def test_a_failed_recompute_keeps_the_last_good_rows(
    db: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    league_id, (kc_owner, buf_owner) = await _two_team_league(db)
    db.add_all(
        [
            LeagueStanding(
                league_id=league_id, team_id=kc_owner, rank=1, players_left=7,
                total=Decimal("99"),
            ),
            LeagueStanding(
                league_id=league_id, team_id=buf_owner, rank=2, players_left=5,
                total=Decimal("50"),
            ),
        ]
    )  # fmt: skip
    await db.flush()

    def boom(_: object) -> None:
        raise RuntimeError("scoring blew up")

    monkeypatch.setattr("api.services.standings.rank_teams", boom)
    assert await recompute_standings(db, 2025) == 0

    rows = await _stored(db, league_id)
    assert [(rows[t].total, rows[t].players_left) for t in (kc_owner, buf_owner)] == [
        (Decimal("99"), 7),
        (Decimal("50"), 5),
    ]
