from datetime import datetime
from typing import Literal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import Field, field_validator

from api.models.base import BaseSchema

HourCycle = Literal["12", "24"]


class Device(BaseSchema):
    """A device the member turned notifications on for. The push endpoint and keys never
    leave the server; `id` is what the member removes it by."""

    id: int
    label: str
    created_at: datetime
    last_seen: datetime


class AccountOverview(BaseSchema):
    username: str
    email: str | None
    # How this identity signs in, from the verified token: "google", "email".
    sign_in_methods: list[str]
    display_time_zone: str | None
    hour_cycle: HourCycle | None
    devices: list[Device]


class AccountPreferencesUpdate(BaseSchema):
    """Only the fields sent change; an explicit null goes back to following the browser."""

    display_time_zone: str | None = Field(default=None, max_length=64)
    hour_cycle: HourCycle | None = None

    @field_validator("display_time_zone")
    @classmethod
    def _known_zone(cls, value: str | None) -> str | None:
        if value is not None:
            try:
                ZoneInfo(value)
            except (ZoneInfoNotFoundError, ValueError) as exc:
                raise ValueError("Not a known time zone") from exc
        return value


class AccountPreferences(BaseSchema):
    display_time_zone: str | None
    hour_cycle: HourCycle | None
