"""Web push (#266): best-effort delivery to a user's subscribed devices.

Nothing here may break the action that triggered it: failures are logged (ids and HTTP
statuses only, never endpoints or message text) and swallowed, and a subscription the push
service says is gone (404 or 410) is deleted. Without VAPID keys every call is a no-op.
Everything but chat is sent through `notifications.notify`, which also fills the inbox.
"""

import asyncio
import json
import logging
from collections.abc import Awaitable, Callable, Iterable
from dataclasses import asdict, dataclass
from datetime import UTC, datetime, timedelta
from typing import Concatenate, Literal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pywebpush import WebPushException, webpush
from sqlalchemy import delete, func, select, true, update
from sqlalchemy.ext.asyncio import AsyncSession

from api.core.config import get_settings
from api.db.models.activity import LeagueMessage
from api.db.models.league import League, LeagueMember
from api.db.models.push import PushSubscription
from api.db.models.user import User
from api.db.session import get_session_factory
from api.services.live_leagues import live_league_ids, live_season_ids

logger = logging.getLogger(__name__)

GONE_STATUSES = frozenset({404, 410})
# The SPA refreshes `last_seen` on every sign-in and app load, so a device silent this
# long is a signed-out or abandoned one whose notifications nobody should still get.
STALE_AFTER = timedelta(days=60)
# A pick or a lock reminder that cannot be delivered within this is no longer useful.
TTL_SECONDS = 15 * 60
REQUEST_TIMEOUT_SECONDS = 10
CHAT_BURST_WINDOW = timedelta(minutes=10)

Urgency = Literal["very-low", "low", "normal", "high"]
PushKind = Literal[
    "draft", "lineup", "chat", "mention", "starter", "score", "round", "announcement"
]
# The users column holding each kind's preference.
PREFERENCE_COLUMNS = {
    "draft": User.push_draft_alerts,
    "lineup": User.push_lineup_reminders,
    "chat": User.push_chat,
    "mention": User.push_mentions,
    "starter": User.push_starter_alerts,
    "score": User.push_score_alerts,
    "round": User.push_round_results,
    "announcement": User.push_announcements,
}
# Player alerts wait out the member's quiet hours; the inbox entry is written anyway.
QUIET_KINDS = frozenset({"starter", "score", "round"})
QUIET_START_HOUR = 23
QUIET_END_HOUR = 7

_pending: set[asyncio.Task[None]] = set()


@dataclass(frozen=True)
class PushMessage:
    title: str
    body: str
    # In-app path the notification opens; a later message with the same tag replaces it.
    url: str
    tag: str
    # RFC 8030 Urgency. Android holds "normal" pushes while the phone dozes, so anything
    # that is useless a minute late (the clock, a lineup lock) goes out "high"; chat does
    # not, because high priority wakes the phone and chat is not worth the battery.
    urgency: Urgency = "normal"

    def payload(self) -> str:
        """What the service worker receives; the urgency is a header, not content."""
        return json.dumps({k: v for k, v in asdict(self).items() if k != "urgency"})


def _now() -> datetime:
    return datetime.now(UTC)


def in_quiet_hours(zone_name: str | None, now: datetime) -> bool:
    """11pm to 7am in the member's zone; UTC for a member who never reported one."""
    try:
        zone = ZoneInfo(zone_name) if zone_name else UTC
    except (ZoneInfoNotFoundError, ValueError):
        zone = UTC
    hour = now.astimezone(zone).hour
    return hour >= QUIET_START_HOUR or hour < QUIET_END_HOUR


def _deliver(subscription: PushSubscription, message: PushMessage) -> int:
    """Send one message; returns the push service's HTTP status (0 when none arrived)."""
    settings = get_settings()
    logger.debug("Sending push", extra={"tag": message.tag, "urgency": message.urgency})
    try:
        response = webpush(
            subscription_info={
                "endpoint": subscription.endpoint,
                "keys": {"p256dh": subscription.p256dh, "auth": subscription.auth},
            },
            data=message.payload(),
            vapid_private_key=settings.vapid_private_key,
            vapid_claims={"sub": settings.vapid_subject},
            ttl=TTL_SECONDS,
            headers={"Urgency": message.urgency},
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
    except WebPushException as exc:
        return exc.response.status_code if exc.response is not None else 0
    except Exception:
        logger.exception(
            "Push delivery crashed", extra={"subscription_id": subscription.id}
        )
        return 0
    return int(getattr(response, "status_code", 201))


def spawn[**P](
    notify: Callable[Concatenate[AsyncSession, P], Awaitable[None]],
    *args: P.args,
    **kwargs: P.kwargs,
) -> None:
    """Run a notification in the background, on its own session, so the pick or poll
    that triggered it never waits on the push services."""

    async def run() -> None:
        try:
            async with get_session_factory()() as db:
                await notify(db, *args, **kwargs)
        except Exception:
            logger.exception("Push notification failed")

    task = asyncio.create_task(run())
    _pending.add(task)
    task.add_done_callback(_pending.discard)


async def wait_for_pending() -> None:
    """Let spawned notifications finish; tests use it, production never needs to."""
    if _pending:
        await asyncio.gather(*_pending, return_exceptions=True)


async def send_to_users(
    db: AsyncSession, user_ids: Iterable[int], message: PushMessage, kind: PushKind
) -> int:
    """Push to every device of the given users who want this kind; returns how many
    accepted it."""
    ids = set(user_ids)
    if not ids or not get_settings().push_enabled:
        return 0
    now = _now()
    ids = {
        row.id
        for row in await db.execute(
            select(User.id, User.quiet_hours, User.timezone).where(
                User.id.in_(ids), PREFERENCE_COLUMNS[kind]
            )
        )
        if not (
            kind in QUIET_KINDS
            and row.quiet_hours
            and in_quiet_hours(row.timezone, now)
        )
    }
    if not ids:
        return 0
    subscriptions = list(
        (
            await db.execute(
                select(PushSubscription).where(PushSubscription.user_id.in_(ids))
            )
        )
        .scalars()
        .all()
    )
    statuses = await asyncio.gather(
        *(asyncio.to_thread(_deliver, s, message) for s in subscriptions)
    )
    gone: list[int] = []
    delivered = 0
    for subscription, code in zip(subscriptions, statuses, strict=True):
        if 200 <= code < 300:
            delivered += 1
        elif code in GONE_STATUSES:
            gone.append(subscription.id)
        else:
            logger.warning(
                "Push not delivered",
                extra={"subscription_id": subscription.id, "status": code},
            )
    if gone:
        await db.execute(delete(PushSubscription).where(PushSubscription.id.in_(gone)))
        await db.commit()
        logger.info("Removed dead push subscriptions", extra={"count": len(gone)})
    return delivered


async def notify_league_message(db: AsyncSession, message_id: int) -> None:
    """Tell the league's other active members about a new chat message.

    The text carries the author's name and the league's, never the message itself, since
    it shows on lock screens. Only members who turned chat on and have not muted this
    league get it; a burst within `CHAT_BURST_WINDOW` collapses into one notification
    (same tag) that says how many messages it stands for.
    """
    if not get_settings().push_enabled:
        return
    row = (
        await db.execute(
            select(
                LeagueMessage.league_id,
                LeagueMessage.season_id,
                LeagueMessage.author_user_id,
                LeagueMessage.author_name,
                LeagueMessage.mentioned_user_ids,
                League.name,
            )
            .join(League, League.id == LeagueMessage.league_id)
            .where(
                LeagueMessage.id == message_id,
                LeagueMessage.deleted_at.is_(None),
                LeagueMessage.season_id.in_(live_season_ids()),
            )
        )
    ).one_or_none()
    if row is None:
        return
    recipients = (
        (
            await db.execute(
                select(LeagueMember.user_id).where(
                    LeagueMember.league_id == row.league_id,
                    LeagueMember.left_at.is_(None),
                    LeagueMember.chat_muted.is_(False),
                    # Tagged members get the mention notification instead.
                    LeagueMember.user_id.not_in(row.mentioned_user_ids),
                    LeagueMember.user_id != row.author_user_id
                    if row.author_user_id is not None
                    else true(),
                )
            )
        )
        .scalars()
        .all()
    )
    recent = (
        await db.scalar(
            select(func.count())
            .select_from(LeagueMessage)
            .where(
                LeagueMessage.season_id == row.season_id,
                LeagueMessage.deleted_at.is_(None),
                LeagueMessage.created_at >= datetime.now(UTC) - CHAT_BURST_WINDOW,
            )
        )
    ) or 1
    body = (
        f"{recent} new messages in the chat."
        if recent > 1
        else f"{row.author_name or 'Someone'} posted in the chat."
    )
    await send_to_users(
        db,
        recipients,
        PushMessage(
            title=row.name,
            body=body,
            url=f"/leagues/{row.league_id}/feed",
            tag=f"chat-{row.season_id}",
        ),
        "chat",
    )


async def prune_stale_subscriptions(db: AsyncSession) -> int:
    """Delete subscriptions not refreshed within `STALE_AFTER`; returns how many."""
    result = await db.execute(
        delete(PushSubscription).where(
            PushSubscription.last_seen < datetime.now(UTC) - STALE_AFTER
        )
    )
    return int(result.rowcount or 0)  # type: ignore[attr-defined]


async def muted_league_ids(db: AsyncSession, user_id: int) -> list[int]:
    """Live leagues the member muted chat pushes from."""
    rows = await db.execute(
        select(LeagueMember.league_id).where(
            LeagueMember.user_id == user_id,
            LeagueMember.left_at.is_(None),
            LeagueMember.chat_muted.is_(True),
            LeagueMember.league_id.in_(live_league_ids()),
        )
    )
    return sorted(rows.scalars().all())


async def set_chat_muted(
    db: AsyncSession, user_id: int, league_id: int, muted: bool
) -> bool:
    """Mute or unmute one league; False when the user is not an active member of it."""
    result = await db.execute(
        update(LeagueMember)
        .where(
            LeagueMember.league_id == league_id,
            LeagueMember.user_id == user_id,
            LeagueMember.left_at.is_(None),
            LeagueMember.league_id.in_(live_league_ids()),
        )
        .values(chat_muted=muted)
    )
    return bool(result.rowcount)  # type: ignore[attr-defined]
