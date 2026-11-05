"""Web push (#266): best-effort delivery to a user's subscribed devices.

Nothing here may break the action that triggered it: failures are logged (ids and HTTP
statuses only, never endpoints or message text) and swallowed, and a subscription the push
service says is gone (404 or 410) is deleted. Without VAPID keys every call is a no-op.
"""

import asyncio
import json
import logging
from collections.abc import Awaitable, Callable, Iterable
from dataclasses import asdict, dataclass
from typing import Concatenate, Literal

from pywebpush import WebPushException, webpush
from sqlalchemy import delete, select, true
from sqlalchemy.ext.asyncio import AsyncSession

from api.core.config import get_settings
from api.db.models.activity import LeagueMessage
from api.db.models.league import League, LeagueMember, Season, Team
from api.db.models.push import PushSubscription
from api.db.session import get_session_factory
from api.services.live_leagues import live_season_ids

logger = logging.getLogger(__name__)

GONE_STATUSES = frozenset({404, 410})
# A pick or a lock reminder that cannot be delivered within this is no longer useful.
TTL_SECONDS = 15 * 60
REQUEST_TIMEOUT_SECONDS = 10

Urgency = Literal["very-low", "low", "normal", "high"]

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
    db: AsyncSession, user_ids: Iterable[int], message: PushMessage
) -> int:
    """Push to every device of the given users; returns how many accepted it."""
    ids = set(user_ids)
    if not ids or not get_settings().push_enabled:
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


async def notify_on_the_clock(db: AsyncSession, season_id: int, team_id: int) -> None:
    """Tell the owner of the team that is now picking."""
    if not get_settings().push_enabled:
        return
    row = (
        await db.execute(
            select(Team.owner_id, League.id, League.name)
            .join(Season, Season.id == Team.season_id)
            .join(League, League.id == Season.league_id)
            .where(
                Team.id == team_id,
                Team.season_id == season_id,
                Season.id.in_(live_season_ids()),
            )
        )
    ).one_or_none()
    if row is None or row.owner_id is None:
        return
    await send_to_users(
        db,
        [row.owner_id],
        PushMessage(
            title="You're on the clock",
            body=f"Your pick is up in {row.name}.",
            url=f"/leagues/{row.id}/draft",
            tag=f"on-the-clock-{season_id}",
            urgency="high",
        ),
    )


async def notify_league_message(db: AsyncSession, message_id: int) -> None:
    """Tell the league's other active members about a new chat message.

    The text carries the author's name and the league's, never the message itself, since
    it shows on lock screens. There is no per-member chat mute yet; add the filter here
    when the notification settings (#267) gain one.
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
                    LeagueMember.user_id != row.author_user_id
                    if row.author_user_id is not None
                    else true(),
                )
            )
        )
        .scalars()
        .all()
    )
    await send_to_users(
        db,
        recipients,
        PushMessage(
            title=row.name,
            body=f"{row.author_name or 'Someone'} posted in the chat.",
            url=f"/leagues/{row.league_id}/feed",
            tag=f"chat-{row.season_id}",
        ),
    )
