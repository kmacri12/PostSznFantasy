from datetime import datetime

from pydantic import Field

from api.models.base import BaseSchema


class InboxItem(BaseSchema):
    id: int
    kind: str
    league_id: int
    league_name: str
    # Ids only, keyed in camelCase (seasonId, teamId, round); the app words the entry.
    payload: dict[str, int]
    created_at: datetime
    read: bool


class Inbox(BaseSchema):
    items: list[InboxItem]
    unread_count: int


class InboxRead(BaseSchema):
    """Mark these entries read; leave `ids` out to mark every one."""

    ids: list[int] | None = Field(default=None, max_length=200)
