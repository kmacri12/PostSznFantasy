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
    current_round: int
    rounds: list[BracketRound]
    # Top seeds sitting out the Wild Card round.
    byes: list[BracketTeam]
