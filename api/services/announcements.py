"""The pinned league announcement (#403): one at a time, separate from the long-lived
notes. Posting also writes an `announcement` event to the current season's feed;
unpinning leaves that history alone (the feed is append-only)."""

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models.league import League
from api.db.models.user import User
from api.models.activity_models import AnnouncementPayload
from api.models.league_models import Announcement
from api.services import activity


async def pin(db: AsyncSession, league: League, author: User, body: str) -> int | None:
    """Replace the pinned announcement; returns the season whose feed got the event."""
    league.announcement = body
    league.announcement_at = datetime.now(UTC)
    league.announcement_by = author.id
    event = await activity.append_to_league(
        db, league.id, AnnouncementPayload(body=body), actor=activity.Actor.of(author)
    )
    await db.flush()
    return event.season_id if event else None


async def unpin(db: AsyncSession, league: League) -> None:
    league.announcement = ""
    league.announcement_at = None
    league.announcement_by = None
    await db.flush()


async def current(db: AsyncSession, league: League) -> Announcement | None:
    if not league.announcement or league.announcement_at is None:
        return None
    author_name = (
        await db.scalar(select(User.username).where(User.id == league.announcement_by))
        if league.announcement_by is not None
        else None
    )
    return Announcement(
        body=league.announcement,
        posted_at=league.announcement_at,
        author_name=author_name,
    )
