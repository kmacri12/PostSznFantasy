"""Push a reminder shortly before a draft's scheduled time (#326).

Nothing starts the draft at that time; the push says so. Called from the scheduler tick:
a scheduled draft whose `start_time` is within `REMINDER_LEAD` gets one push. Sent
reminders are remembered in memory per (draft, start time), so rescheduling re-arms it and
a restart inside the window repeats it at most once.
"""

from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models.draft import Draft
from api.models.enums import DraftStatus
from api.services import push
from api.services.live_leagues import live_season_ids

REMINDER_LEAD = timedelta(minutes=15)

_sent: set[tuple[int, datetime]] = set()


async def send_draft_start_reminders(db: AsyncSession, now: datetime) -> int:
    """Send the reminders due at `now`; returns how many drafts were announced."""
    drafts = (
        await db.execute(
            select(Draft.id, Draft.season_id, Draft.start_time).where(
                Draft.status.in_(
                    [DraftStatus.SCHEDULED.value, DraftStatus.LOBBY.value]
                ),
                Draft.start_time.is_not(None),
                Draft.start_time - REMINDER_LEAD <= now,
                Draft.start_time > now,
                Draft.season_id.in_(live_season_ids()),
            )
        )
    ).all()
    sent = 0
    for draft_id, season_id, start_time in drafts:
        if start_time is None:
            continue
        key = (draft_id, start_time)
        if key in _sent:
            continue
        _sent.add(key)
        await push.notify_draft_soon(
            db, season_id, round((start_time - now).total_seconds() / 60)
        )
        sent += 1
    return sent
