from api.models.base import BaseSchema


class LoginRequest(BaseSchema):
    token: str


class LoginResponse(BaseSchema):
    message: str
    user_id: int
    avatar_url: str | None = None
    username: str
    # First sign-in, or still the placeholder: the SPA asks "What should we call you?".
    name_prompt: bool = False
