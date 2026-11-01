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
    # Counted points, except the draft awards (places gained or lost) and the bench
    # award (bench points).
    value: float
    # Set for the per-position draft awards.
    drafted_as: int | None = None
    finished_as: int | None = None
    points: float | None = None


class SeasonRecap(BaseSchema):
    season_id: int
    league_id: int
    year: int
    # The Super Bowl is final; until then there is no champion and no awards.
    finished: bool
    # Every team ranked first: more than one when the title is tied all the way down
    # the tiebreaker chain.
    champions: list[RecapTeam]
    standings: Standings
    # The following season of the league, once the commissioner has started it.
    next_season_id: int | None = None
    awards: list[AwardWinner]
