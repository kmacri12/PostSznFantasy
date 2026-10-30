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
SUPER_BOWL = ROUNDS[-1]
GAME_COMPLETED = "Completed"
# Tank01 reports a running game as "Live - In Progress".
GAME_LIVE_PREFIX = "Live"


@dataclass(frozen=True)
class GameFacts:
    round: int
    home_team_id: int | None
    away_team_id: int | None
    kickoff: datetime | None
    completed: bool
    home_points: int | None
    away_points: int | None
    in_progress: bool = False

    @property
    def winner_id(self) -> int | None:
        loser = self.loser_id
        if loser is None:
            return None
        return self.away_team_id if loser == self.home_team_id else self.home_team_id

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
    # Only the Wild Card round has byes. Later, an alive team without a game is waiting
    # for its next game to be scheduled, which is not a bye.
    on_bye = round_ == 1 and bool(this_round)
    return TeamRound(PlayerRoundStatus.BYE if on_bye else PlayerRoundStatus.ALIVE, None)


def completed_rounds(games: list[GameFacts]) -> frozenset[int]:
    """Rounds with at least one game, all final; an unscheduled round is not complete."""
    return frozenset(
        r
        for r in ROUNDS
        if (this_round := [g for g in games if g.round == r])
        and all(g.completed for g in this_round)
    )


def current_round(games: list[GameFacts]) -> int:
    """The first round not yet complete; the Super Bowl once everything is final."""
    done = completed_rounds(games)
    return next((r for r in ROUNDS if r not in done), SUPER_BOWL)


def super_bowl_winner(games: list[GameFacts]) -> int | None:
    """NFL team id that won the Super Bowl; None until it is final."""
    return next(
        (g.winner_id for g in games if g.round == SUPER_BOWL and g.winner_id), None
    )


def games_in_progress(games: list[GameFacts]) -> int:
    return sum(1 for g in games if g.in_progress)


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
                in_progress=(game.game_status or "").startswith(GAME_LIVE_PREFIX),
                home_points=game.home_pts,
                away_points=game.away_pts,
            )
        )
    return facts
