"""The recap of a finished season: champion(s) and final standings.

Nothing is stored. A season is finished when the Super Bowl is final, and the final
standings are the live standings, which stop changing once every game is final.
"""

from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models.league import League
from api.models.recap_models import RecapTeam, SeasonRecap
from api.services.round_status import SUPER_BOWL, completed_rounds, load_games
from api.services.standings_view import league_standings


async def season_is_finished(db: AsyncSession, season: int) -> bool:
    return SUPER_BOWL in completed_rounds(await load_games(db, season))


async def build_recap(db: AsyncSession, league: League) -> SeasonRecap:
    standings = await league_standings(db, league.id)
    finished = await season_is_finished(db, league.season)
    champions = (
        [
            RecapTeam(
                team_id=t.team_id,
                team_name=t.team_name,
                owner=t.owner,
                total=t.total,
            )
            for t in standings.teams
            if t.rank == 1
        ]
        if finished
        else []
    )
    return SeasonRecap(
        league_id=league.id,
        season=league.season,
        finished=finished,
        champions=champions,
        standings=standings,
    )
