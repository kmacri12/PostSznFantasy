"""Where each NFL team stands in each postseason round, derived from game results.

Rounds are numbered 1 (Wild Card) to 4 (Super Bowl). Nothing here reads the
`is_active` flag: a team is eliminated for round N once it has lost a completed game
in an earlier round.
"""

from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models.nfl import NFLGame
from api.models.enums import PlayerRoundStatus
from api.utils.calculations.standings_utils import postseason_round_index

ROUNDS = (1, 2, 3, 4)
GAME_COMPLETED = "Completed"


@dataclass(frozen=True)
class GameFacts:
    round: int
    home_team_id: int | None
    away_team_id: int | None
    kickoff: datetime | None
    completed: bool
    home_points: int | None
    away_points: int | None

    @property
    def loser_id(self) -> int | None:
        if not self.completed or self.home_points is None or self.away_points is None:
            return None
        if self.home_points == self.away_points:
            return None
        return (
            self.away_team_id
            if self.home_points > self.away_points
            else self.home_team_id
        )


@dataclass(frozen=True)
class TeamRound:
    status: PlayerRoundStatus
    # Scheduled start of the team's game that round; None on a bye or before it is set.
    kickoff: datetime | None


def round_status(
    games: list[GameFacts], nfl_team_id: int | None, round_: int
) -> TeamRound:
    if nfl_team_id is None:
        return TeamRound(PlayerRoundStatus.ALIVE, None)
    if any(g.loser_id == nfl_team_id and g.round < round_ for g in games):
        return TeamRound(PlayerRoundStatus.ELIMINATED, None)
    this_round = [g for g in games if g.round == round_]
    own = next(
        (g for g in this_round if nfl_team_id in (g.home_team_id, g.away_team_id)),
        None,
    )
    if own is not None:
        return TeamRound(PlayerRoundStatus.ALIVE, own.kickoff)
    # A bye is only knowable once the round has a schedule and the team is not still
    # waiting on an earlier game to finish.
    undecided = any(
        not g.completed
        and g.round < round_
        and nfl_team_id in (g.home_team_id, g.away_team_id)
        for g in games
    )
    on_bye = bool(this_round) and not undecided
    return TeamRound(PlayerRoundStatus.BYE if on_bye else PlayerRoundStatus.ALIVE, None)


def _kickoff(game_time_epoch: str | None) -> datetime | None:
    try:
        return (
            datetime.fromtimestamp(float(game_time_epoch), UTC)
            if game_time_epoch
            else None
        )
    except ValueError:
        return None


async def load_games(db: AsyncSession, season: int) -> list[GameFacts]:
    rows = (
        await db.execute(
            select(NFLGame).where(
                NFLGame.season == season,
                NFLGame.season_type == "post",
                NFLGame.game_week.is_not(None),
            )
        )
    ).scalars()
    facts = []
    for game in rows:
        index = postseason_round_index(game.game_week or 0)
        if index is None:
            continue
        facts.append(
            GameFacts(
                round=index + 1,
                home_team_id=game.team_id_home,
                away_team_id=game.team_id_away,
                kickoff=_kickoff(game.game_time_epoch),
                completed=game.game_status == GAME_COMPLETED,
                home_points=game.home_pts,
                away_points=game.away_pts,
            )
        )
    return facts
