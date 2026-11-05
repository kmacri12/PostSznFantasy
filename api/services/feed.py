"""The Feed: a season's activity events and chat messages merged, newest first.

Lineup moves are stored (slot marks derive from them) but never listed here. One
cursor spans both tables: `<created_at in microseconds>:<e|m>:<id>`, ordered by time,
then messages before events, then id.
"""

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from urllib.parse import urlsplit

from sqlalchemy import ColumnElement, and_, false, or_, select, true
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import InstrumentedAttribute

from api.core.config import get_settings
from api.db.models.activity import ActivityEvent, LeagueMessage
from api.db.models.league import Season, Team
from api.dependencies.league import SeasonMembership
from api.models.enums import ActivityKind
from api.models.feed_models import (
    MAX_MESSAGE_LENGTH,
    Feed,
    FeedEventItem,
    FeedItem,
    FeedMessageItem,
)
from api.services import activity
from api.services.season_recap import ARCHIVED_MESSAGE

EPOCH = datetime(1970, 1, 1, tzinfo=UTC)
MICROSECOND = timedelta(microseconds=1)
# Messages sort ahead of events that share a timestamp.
RANK = {"e": 0, "m": 1}


class FeedError(ValueError):
    """A request the feed refuses; carries the message for a 422."""


class MessageNotFound(LookupError):
    pass


class NotYourMessage(PermissionError):
    pass


@dataclass(frozen=True)
class Cursor:
    at: datetime
    kind: str
    id: int

    def __str__(self) -> str:
        return f"{(self.at - EPOCH) // MICROSECOND}:{self.kind}:{self.id}"

    @classmethod
    def parse(cls, value: str) -> "Cursor":
        try:
            micros, kind, item_id = value.split(":")
            if kind not in RANK:
                raise ValueError(kind)
            return cls(EPOCH + int(micros) * MICROSECOND, kind, int(item_id))
        except (ValueError, OverflowError) as exc:
            raise FeedError("Invalid 'before' cursor") from exc

    def older_than(
        self,
        created_at: InstrumentedAttribute[datetime],
        id_: InstrumentedAttribute[int],
        kind: str,
    ) -> ColumnElement[bool]:
        """Rows of `kind` that sort after this cursor in the newest-first order."""
        if RANK[kind] > RANK[self.kind]:
            tie: ColumnElement[bool] = false()
        elif RANK[kind] < RANK[self.kind]:
            tie = true()
        else:
            tie = id_ < self.id
        return or_(created_at < self.at, and_(created_at == self.at, tie))


def _sort_key(item: FeedItem) -> tuple[datetime, int, int]:
    return item.created_at, RANK[item.type[0]], item.id


async def is_current_season(db: AsyncSession, season: Season) -> bool:
    """Chat belongs to the league's latest season only."""
    latest = await db.scalar(
        select(Season.year)
        .where(Season.league_id == season.league_id)
        .order_by(Season.year.desc())
        .limit(1)
    )
    return latest == season.year


def can_post(membership: SeasonMembership, current: bool) -> bool:
    return membership.can_edit and current


async def feed(
    db: AsyncSession,
    membership: SeasonMembership,
    *,
    limit: int = activity.DEFAULT_PAGE_SIZE,
    before: str | None = None,
) -> Feed:
    season_id = membership.season.id
    viewer = membership.user
    limit = max(1, min(limit, activity.MAX_PAGE_SIZE))
    cursor = Cursor.parse(before) if before is not None else None
    baseline = await activity.load_baseline(db, viewer.id, season_id, None)

    event_query = (
        select(ActivityEvent, Team.name)
        .outerjoin(Team, Team.id == ActivityEvent.team_id)
        .where(
            ActivityEvent.season_id == season_id,
            ActivityEvent.kind != ActivityKind.LINEUP_MOVE.value,
        )
        .order_by(ActivityEvent.created_at.desc(), ActivityEvent.id.desc())
        .limit(limit + 1)
    )
    message_query = (
        select(LeagueMessage)
        .where(LeagueMessage.season_id == season_id, LeagueMessage.deleted_at.is_(None))
        .order_by(LeagueMessage.created_at.desc(), LeagueMessage.id.desc())
        .limit(limit + 1)
    )
    if cursor is not None:
        event_query = event_query.where(
            cursor.older_than(ActivityEvent.created_at, ActivityEvent.id, "e")
        )
        message_query = message_query.where(
            cursor.older_than(LeagueMessage.created_at, LeagueMessage.id, "m")
        )

    items: list[FeedItem] = [
        FeedEventItem(**activity.event_out(event, team_name, baseline).model_dump())
        for event, team_name in (await db.execute(event_query)).all()
    ]
    items += [
        FeedMessageItem(
            id=message.id,
            created_at=message.created_at,
            author_user_id=message.author_user_id,
            author_name=message.author_name,
            body=message.body,
            gif_url=message.gif_url,
            can_delete=can_delete(membership, message),
            is_new=baseline.message_is_new(message),
        )
        for message in await db.scalars(message_query)
    ]
    items.sort(key=_sort_key, reverse=True)
    page = items[:limit]

    event_dot = await db.scalar(
        select(ActivityEvent.id)
        .where(
            ActivityEvent.season_id == season_id,
            ActivityEvent.kind.in_(activity.LEAGUE_DOT_KINDS),
            baseline.is_new_clause,
        )
        .limit(1)
    )
    message_dot = await db.scalar(
        select(LeagueMessage.id)
        .where(LeagueMessage.season_id == season_id, baseline.message_is_new_clause)
        .limit(1)
    )
    return Feed(
        items=page,
        next_before=(
            str(Cursor(page[-1].created_at, page[-1].type[0], page[-1].id))
            if len(items) > limit
            else None
        ),
        has_new=event_dot is not None or message_dot is not None,
        can_post=can_post(membership, await is_current_season(db, membership.season)),
    )


def can_delete(membership: SeasonMembership, message: LeagueMessage) -> bool:
    return membership.can_edit and (
        membership.is_commissioner or message.author_user_id == membership.user.id
    )


def validate_gif_url(url: str) -> str:
    """The URL as given, once it is https on an allowlisted host (or a subdomain)."""
    try:
        parts = urlsplit(url)
        host = (parts.hostname or "").lower()
        port = parts.port
    except ValueError as exc:
        raise FeedError("GIF link is not a valid URL") from exc
    allowed = [h.lower() for h in get_settings().gif_allowed_hosts]
    if (
        parts.scheme != "https"
        or parts.username is not None
        or port not in (None, 443)
        or not any(host == a or host.endswith(f".{a}") for a in allowed)
    ):
        raise FeedError("GIF link must be an https link from a supported GIF site")
    return url


async def post_message(
    db: AsyncSession, membership: SeasonMembership, body: str, gif_url: str | None
) -> LeagueMessage:
    """Add a chat message to the season's feed; the caller has already passed the
    member guard, which refuses former members and archived seasons."""
    if not await is_current_season(db, membership.season):
        raise FeedError(ARCHIVED_MESSAGE)
    gif_url = validate_gif_url(gif_url) if gif_url else None
    if len(body) > MAX_MESSAGE_LENGTH:
        raise FeedError(f"Messages are limited to {MAX_MESSAGE_LENGTH} characters")
    if not body and gif_url is None:
        raise FeedError("A message needs text or a GIF")
    message = LeagueMessage(
        league_id=membership.league.id,
        season_id=membership.season.id,
        author_user_id=membership.user.id,
        author_name=membership.user.username[:20],
        body=body,
        gif_url=gif_url,
    )
    db.add(message)
    await db.flush()
    return message


async def delete_message(
    db: AsyncSession, membership: SeasonMembership, message_id: int
) -> bool:
    """Hide a message: its author or any commissioner may. Returns False when it was
    already gone, so deleting twice is harmless."""
    message = await db.scalar(
        select(LeagueMessage).where(
            LeagueMessage.id == message_id,
            LeagueMessage.season_id == membership.season.id,
        )
    )
    if message is None:
        raise MessageNotFound
    if not can_delete(membership, message):
        raise NotYourMessage
    if message.deleted_at is not None:
        return False
    message.deleted_at = datetime.now(UTC)
    message.deleted_by = membership.user.id
    await db.flush()
    return True
