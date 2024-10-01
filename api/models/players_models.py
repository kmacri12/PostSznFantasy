from api.models.base import BaseSchema


class Player(BaseSchema):
    id: int
    name: str
    position: str
    team_abv: str
