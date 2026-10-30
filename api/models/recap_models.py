from api.models.base import BaseSchema
from api.models.league_models import Standings


class RecapTeam(BaseSchema):
    team_id: int
    team_name: str
    owner: str
    total: float


class SeasonRecap(BaseSchema):
    league_id: int
    season: int
    # The Super Bowl is final; until then there is no champion and no awards.
    finished: bool
    # Every team ranked first: more than one when the title is tied all the way down
    # the tiebreaker chain.
    champions: list[RecapTeam]
    standings: Standings
