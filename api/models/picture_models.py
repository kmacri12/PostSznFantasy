from api.models.base import BaseSchema


class TeamPicture(BaseSchema):
    """The generated picture of a team without an uploaded one: indices into the SPA's palette."""

    color: int
    icon: int
