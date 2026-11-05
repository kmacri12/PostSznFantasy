from datetime import datetime
from typing import Annotated, Literal

from pydantic import Field, field_validator

from api.models.activity_models import ActivityEventOut
from api.models.base import BaseSchema

MAX_MESSAGE_LENGTH = 2000
MAX_GIF_URL_LENGTH = 500


class MessageCreate(BaseSchema):
    body: str = Field(default="", max_length=MAX_MESSAGE_LENGTH)
    # Only checked against the host allowlist (settings), not fetched.
    gif_url: str | None = Field(default=None, max_length=MAX_GIF_URL_LENGTH)

    @field_validator("body")
    @classmethod
    def _trim(cls, value: str) -> str:
        return value.strip()


class FeedEventItem(ActivityEventOut):
    type: Literal["event"] = "event"


class FeedMessageItem(BaseSchema):
    type: Literal["message"] = "message"
    id: int
    created_at: datetime
    author_user_id: int | None
    author_name: str | None
    body: str
    gif_url: str | None
    # The viewer wrote it or is a commissioner of a season that still takes edits.
    can_delete: bool
    is_new: bool


FeedItem = Annotated[FeedEventItem | FeedMessageItem, Field(discriminator="type")]


class Feed(BaseSchema):
    """Events and chat merged newest first (lineup moves excluded)."""

    items: list[FeedItem]
    # Pass as `before` for the next older page; None on the last page.
    next_before: str | None
    # Any new event or message in the whole feed, not just this page.
    has_new: bool
    # Whether the viewer may post: members of the league's current season only.
    can_post: bool


class FeedViewed(BaseSchema):
    # The newest event / message the viewer was shown; omitted means everything so far.
    up_to_event_id: int | None = None
    up_to_message_id: int | None = None
