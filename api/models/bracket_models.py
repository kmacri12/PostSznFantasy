from datetime import datetime
from typing import Literal

from api.models.base import BaseSchema
from api.models.enums import GameState


class BracketPlayer(BaseSchema):
    id: int
    name: str
    position: str
    # Regular-season fantasy points under the league's scoring.
    points: float


class BracketTeam(BaseSchema):
    id: int
    abbreviation: str
    city: str
    name: str
    logo_url: str | None = None
    top_players: list[BracketPlayer]


class BracketMyPlayer(BaseSchema):
    id: int
    name: str
    position: str
    team_id: int
    # Starter in that round's lineup, else bench (unplaced players count as bench).
    role: Literal["starter", "bench"]


class BracketGame(BaseSchema):
    id: str | None
    kickoff: datetime | None
    state: GameState
    clock: str | None = None
    home: BracketTeam | None
    away: BracketTeam | None
    home_points: int | None = None
    away_points: int | None = None
    winner_team_id: int | None = None
    # The caller's roster players on either team; empty before they have drafted.
    my_players: list[BracketMyPlayer]


class BracketRound(BaseSchema):
    round: int
    games: list[BracketGame]


class Bracket(BaseSchema):
    year: int
    # The round on display: it follows the League page's Thursday morning switch.
    current_round: int
    # While the finished round's recap shows, the next round once its games are
    # scheduled; the schedule outlines that tab.
    upcoming_round: int | None = None
    rounds: list[BracketRound]
    # Top seeds sitting out the Wild Card round.
    byes: list[BracketTeam]


class GamePlayer(BaseSchema):
    id: int
    name: str
    position: str
    # Fantasy points in this game under the season's scoring and the round's
    # multiplier, as the Team page counts them; None before he has a stat line.
    points: float | None
    # The fantasy team that owns him (a team QB / K unit's owner for its other
    # members); None when nobody in the league drafted him.
    fantasy_team: str | None
    mine: bool


class GameSide(BaseSchema):
    team: BracketTeam
    points: int | None
    players: list[GamePlayer]


class GamePlayers(BaseSchema):
    """One game as a live stat page: each side's players, best first."""

    id: str
    round: int
    state: GameState
    clock: str | None
    away: GameSide
    home: GameSide


class BreakdownLine(BaseSchema):
    label: str
    points: float


class PlayerRoundLine(BaseSchema):
    round: int
    state: GameState
    clock: str | None
    stat_line: str | None
    # This game's fantasy points with the round multiplier, as the Team page counts.
    points: float
    # One line per scoring stat, before the multiplier.
    points_breakdown: list[BreakdownLine]
    multiplier: float


class PlayerPostseason(BaseSchema):
    """One player's postseason games under a season's scoring, for his player sheet."""

    id: int
    name: str
    position: str
    team_abv: str | None
    injury_status: str | None
    fantasy_team: str | None
    mine: bool
    rounds: list[PlayerRoundLine]
