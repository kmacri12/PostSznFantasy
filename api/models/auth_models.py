from typing import Literal

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
    # The member's saved display preferences (#405); null follows the browser.
    display_time_zone: str | None = None
    hour_cycle: Literal["12", "24"] | None = None
