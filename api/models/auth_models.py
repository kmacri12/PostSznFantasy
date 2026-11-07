from api.models.base import BaseSchema


class LoginRequest(BaseSchema):
    token: str


class LoginResponse(BaseSchema):
    message: str
    user_id: int
    avatar_url: str | None = None
