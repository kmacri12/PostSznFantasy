from api.models.base import BaseSchema
from api.models.league_models import Standings


class RecapTeam(BaseSchema):
    team_id: int
    team_name: str
    owner: str
    total: float


class AwardWinner(BaseSchema):
    key: str
    title: str
    team_id: int
    team_name: str
    owner: str
    # Set for player awards (and the best single game).
    player_id: int | None = None
    player_name: str | None = None
    position: str | None = None
    # Set for the best single game and the best round.
    round: int | None = None
    # Counted points, except the draft awards (pick number minus rank) and the bench
    # award (bench points).
    value: float


class SeasonRecap(BaseSchema):
    league_id: int
    season: int
    # The Super Bowl is final; until then there is no champion and no awards.
    finished: bool
    # Every team ranked first: more than one when the title is tied all the way down
    # the tiebreaker chain.
    champions: list[RecapTeam]
    standings: Standings
    awards: list[AwardWinner]
