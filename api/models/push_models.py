from urllib.parse import urlsplit
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import Field, field_validator

from api.models.base import BaseSchema

# Hosts of the push services browsers hand out. The API POSTs to the stored endpoint, so
# accepting any URL would let a user aim the server at an arbitrary host.
PUSH_SERVICE_SUFFIXES = (
    "fcm.googleapis.com",  # Chrome, Edge and other Chromium browsers on Android
    "push.services.mozilla.com",  # Firefox
    "push.apple.com",  # Safari and the iPhone Home Screen app
    "notify.windows.com",  # Edge on Windows
)


def is_push_service_url(endpoint: str) -> bool:
    parts = urlsplit(endpoint)
    host = parts.hostname or ""
    return parts.scheme == "https" and any(
        host == suffix or host.endswith("." + suffix)
        for suffix in PUSH_SERVICE_SUFFIXES
    )


class PushKeys(BaseSchema):
    p256dh: str = Field(min_length=1, max_length=255)
    auth: str = Field(min_length=1, max_length=64)


class PushSubscriptionCreate(BaseSchema):
    """The shape of `PushSubscription.toJSON()` in the browser."""

    endpoint: str = Field(min_length=1, max_length=2048)
    keys: PushKeys

    @field_validator("endpoint")
    @classmethod
    def _known_push_service(cls, value: str) -> str:
        if not is_push_service_url(value):
            raise ValueError("Not a known push service endpoint")
        return value


class PushSubscriptionDelete(BaseSchema):
    endpoint: str = Field(min_length=1, max_length=2048)


class VapidKeyResponse(BaseSchema):
    # None while the server has no VAPID keys; the client then hides notifications.
    public_key: str | None


class PushPreferences(BaseSchema):
    draft_alerts: bool
    lineup_reminders: bool
    chat: bool
    starter_alerts: bool
    score_alerts: bool
    round_results: bool
    quiet_hours: bool
    timezone: str | None
    # Leagues whose chat the caller muted; the Feed header shows the toggle.
    muted_league_ids: list[int]


class PushPreferencesUpdate(BaseSchema):
    """Only the fields sent change."""

    draft_alerts: bool | None = None
    lineup_reminders: bool | None = None
    chat: bool | None = None
    starter_alerts: bool | None = None
    score_alerts: bool | None = None
    round_results: bool | None = None
    quiet_hours: bool | None = None
    # The browser's IANA zone, sent with quiet hours so "11pm to 7am" is the member's own.
    timezone: str | None = Field(default=None, max_length=64)

    @field_validator("timezone")
    @classmethod
    def _known_zone(cls, value: str | None) -> str | None:
        if value is not None:
            try:
                ZoneInfo(value)
            except (ZoneInfoNotFoundError, ValueError) as exc:
                raise ValueError("Not a known time zone") from exc
        return value


class ChatMuteUpdate(BaseSchema):
    muted: bool
