"""A small finished 2025 postseason: KC beats BUF in the Super Bowl."""

from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models import (
    League,
    LineupSlot,
    NFLGame,
    NFLPlayer,
    NFLPlayerGameStats,
    NFLTeam,
    Team,
    TeamPlayer,
)
from api.services.standings import recompute_standings
from api.tests.postgres.factories import make_league, make_players

# game_week for rounds 1-4
WEEKS = (1, 20, 21, 22)


async def add_season_games(
    db: AsyncSession, *, finished_through: int = 4, season: int = 2025
) -> None:
    """KC (id 1) beats BUF (id 2) in every round up to `finished_through`."""
    for team_id, abv in ((1, "KC"), (2, "BUF")):
        if await db.get(NFLTeam, team_id) is None:
            db.add(NFLTeam(id=team_id, team_abv=abv, is_active=True, in_playoffs=True))
    await db.flush()
    db.add_all(
        NFLGame(
            id=f"g{round_}",
            season=season,
            season_type="post",
            game_week=week,
            game_status="Completed" if round_ <= finished_through else "Scheduled",
            team_id_home=1,
            team_id_away=2,
            home_pts=27 if round_ <= finished_through else None,
            away_pts=24 if round_ <= finished_through else None,
        )
        for round_, week in enumerate(WEEKS, start=1)
    )
    await db.flush()


async def finished_league(
    db: AsyncSession, *, finished_through: int = 4
) -> tuple[League, list[Team], list[NFLPlayer]]:
    """Team 0 owns the KC QB, team 1 the BUF QB; both start them every round.

    The KC QB scores 20 in round 1 and 10 in round 4 (30 total); the BUF QB scores 4
    in round 1 and 4 in round 4.
    """
    league, _, teams, _ = await make_league(db, draft_status="completed")
    await add_season_games(db, finished_through=finished_through)
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
    for team, qb in ((teams[0], kc_qb), (teams[1], buf_qb)):
        for round_ in (1, 4):
            db.add(
                LineupSlot(team_id=team.id, round=round_, player_id=qb.id, slot_index=0)
            )
    for game_id, player, yards, tds in (
        ("g1", kc_qb, 300, 2),
        ("g4", kc_qb, 250, 0),
        ("g1", buf_qb, 100, 0),
        ("g4", buf_qb, 100, 0),
    ):
        db.add(
            NFLPlayerGameStats(
                game_id=game_id,
                player_id=player.id,
                passing_yards=yards,
                passing_touchdowns=tds,
            )
        )
    await db.flush()
    await recompute_standings(db, 2025)
    return league, teams, [kc_qb, buf_qb]
