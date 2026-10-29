from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models import NFLGame, NFLTeam, TeamPlayer
from api.services.scheduler import eliminate_losing_teams
from api.tests.postgres.factories import make_league, make_players
from api.utils.calculations.standings_utils import get_players_left


async def test_losing_teams_are_eliminated_and_players_left_drops(
    db: AsyncSession,
) -> None:
    league, _, teams, _ = await make_league(db)
    kc = NFLTeam(id=1, team_abv="KC", is_active=True)
    buf = NFLTeam(id=2, team_abv="BUF", is_active=True)
    db.add_all([kc, buf])
    await db.flush()
    players = await make_players(db, ["QB", "RB"], nfl_team=kc)
    players += await make_players(db, ["WR"], nfl_team=buf, first_id=2000)
    db.add_all(
        TeamPlayer(team_id=teams[0].id, league_id=league.id, player_id=p.id)
        for p in players
    )
    await db.flush()
    assert await get_players_left(teams[0].id, league.id, db) == 3

    db.add(
        NFLGame(
            id="g1",
            season=2025,
            season_type="post",
            game_status="Completed",
            team_id_home=1,
            team_id_away=2,
            home_pts=27,
            away_pts=24,
        )
    )
    await db.flush()

    assert await eliminate_losing_teams(db, 2025) == 1
    assert await get_players_left(teams[0].id, league.id, db) == 2
    assert await get_players_left(teams[1].id, league.id, db) == 0


async def test_ties_and_unfinished_games_eliminate_nobody(db: AsyncSession) -> None:
    db.add_all([NFLTeam(id=1, team_abv="KC"), NFLTeam(id=2, team_abv="BUF")])
    await db.flush()
    db.add_all(
        [
            NFLGame(
                id="tie",
                season=2025,
                season_type="post",
                game_status="Completed",
                team_id_home=1,
                team_id_away=2,
                home_pts=20,
                away_pts=20,
            ),
            NFLGame(
                id="live",
                season=2025,
                season_type="post",
                game_status="Live",
                team_id_home=1,
                team_id_away=2,
                home_pts=3,
                away_pts=0,
            ),
        ]
    )
    await db.flush()
    assert await eliminate_losing_teams(db, 2025) == 0
