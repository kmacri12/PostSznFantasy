from api.models.base import BaseSchema


class LeaguesByUser(BaseSchema):
    id: int
    name: str
    commissioner_id: int
    user_team_id: int


class Standings(BaseSchema):
    team_name: str
    owner: str
    players_left: int
    wild_card: float
    divisional: float
    conf_champ: float
    super_bowl: float
    total: float


class TeamSimple(BaseSchema):
    id: int
    name: str
    owner_id: int
    owner_name: str
