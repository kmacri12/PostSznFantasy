import unicodedata
from datetime import datetime
from typing import Annotated, Literal

from pydantic import Field, field_validator

from api.models.activity_models import ActivityEventOut
from api.models.base import BaseSchema

MAX_MESSAGE_LENGTH = 2000
MAX_GIF_URL_LENGTH = 500
MAX_MENTIONS = 10
MAX_EMOJI_LENGTH = 32


def _check_emoji(value: str) -> str:
    """Anything an emoji picker can produce (joiners, flags, keycaps, skin tones), and
    no letters, spaces or control characters, so a reaction cannot carry text."""
    if (
        not value
        or len(value) > MAX_EMOJI_LENGTH
        or all(ord(char) < 0x80 for char in value)
        or any(
            char.isalpha() or char.isspace() or unicodedata.category(char) == "Cc"
            for char in value
        )
    ):
        raise ValueError("Pick an emoji")
    return value


class MessageCreate(BaseSchema):
    body: str = Field(default="", max_length=MAX_MESSAGE_LENGTH)
    # Only checked against the host allowlist (settings), not fetched.
    gif_url: str | None = Field(default=None, max_length=MAX_GIF_URL_LENGTH)
    reply_to_id: int | None = None
    # Members picked from the @ autocomplete; the text carries their `@name`.
    mentioned_user_ids: list[int] = Field(default_factory=list, max_length=MAX_MENTIONS)

    @field_validator("body")
    @classmethod
    def _trim(cls, value: str) -> str:
        return value.strip()


class MessageEdit(BaseSchema):
    body: str = Field(default="", max_length=MAX_MESSAGE_LENGTH)
    mentioned_user_ids: list[int] = Field(default_factory=list, max_length=MAX_MENTIONS)

    @field_validator("body")
    @classmethod
    def _trim(cls, value: str) -> str:
        return value.strip()


class ReactionUpdate(BaseSchema):
    emoji: str
    reacted: bool

    @field_validator("emoji")
    @classmethod
    def _emoji(cls, value: str) -> str:
        return _check_emoji(value.strip())


class ReplyQuote(BaseSchema):
    id: int
    author_name: str | None
    # The start of the quoted text, or "GIF"; empty once the original was deleted.
    snippet: str
    deleted: bool


class Mention(BaseSchema):
    user_id: int
    name: str


class Reaction(BaseSchema):
    emoji: str
    count: int
    mine: bool
    # Display names, oldest reaction first.
    names: list[str]


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
    # Its author, in the current season, within five minutes of sending.
    can_edit: bool
    edited_at: datetime | None
    is_new: bool
    reply_to: ReplyQuote | None
    mentions: list[Mention]
    reactions: list[Reaction]


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
