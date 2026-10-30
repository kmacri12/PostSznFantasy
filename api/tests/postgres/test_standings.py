from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models import (
    LeagueStanding,
    NFLGame,
    NFLPlayerGameStats,
    NFLTeam,
    TeamPlayer,
)
from api.services.standings import recompute_standings
from api.tests.postgres.factories import make_league, make_players


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
