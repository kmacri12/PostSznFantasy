from api.models.base import BaseSchema


class StandingsSchema(BaseSchema):
    team_name: str
    owner: str
    players_left: int
    wild_card: float
    divisional: float
    conf_champ: float
    super_bowl: float
    total: float
