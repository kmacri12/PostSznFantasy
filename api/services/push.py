"""Web push (#266): best-effort delivery to a user's subscribed devices.

Nothing here may break the action that triggered it: failures are logged (ids and HTTP
statuses only, never endpoints or message text) and swallowed, and a subscription the push
service says is gone (404 or 410) is deleted. Without VAPID keys every call is a no-op.
"""

import asyncio
import json
import logging
from collections.abc import Coroutine, Iterable
from dataclasses import asdict, dataclass
from typing import Any

from pywebpush import WebPushException, webpush
from sqlalchemy import delete, select

from api.core.config import get_settings
from api.db.models.league import League, Season, Team
from api.db.models.push import PushSubscription
from api.db.session import get_session_factory

logger = logging.getLogger(__name__)

GONE_STATUSES = frozenset({404, 410})
# A pick or a lock reminder that cannot be delivered within this is no longer useful.
TTL_SECONDS = 15 * 60
REQUEST_TIMEOUT_SECONDS = 10

_pending: set[asyncio.Task[None]] = set()


@dataclass(frozen=True)
class PushMessage:
    title: str
    body: str
    # In-app path the notification opens; a later message with the same tag replaces it.
    url: str
    tag: str


def _deliver(subscription: PushSubscription, message: PushMessage) -> int:
    """Send one message; returns the push service's HTTP status (0 when none arrived)."""
    settings = get_settings()
    try:
        response = webpush(
            subscription_info={
                "endpoint": subscription.endpoint,
                "keys": {"p256dh": subscription.p256dh, "auth": subscription.auth},
            },
            data=json.dumps(asdict(message)),
            vapid_private_key=settings.vapid_private_key,
            vapid_claims={"sub": settings.vapid_subject},
            ttl=TTL_SECONDS,
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


def spawn(work: Coroutine[Any, Any, None]) -> None:
    """Run a notification in the background so a pick or a poll never waits on it."""
    task = asyncio.create_task(work)
    _pending.add(task)
    task.add_done_callback(_pending.discard)


async def wait_for_pending() -> None:
    """Let spawned notifications finish; tests use it, production never needs to."""
    if _pending:
        await asyncio.gather(*_pending, return_exceptions=True)


async def send_to_users(user_ids: Iterable[int], message: PushMessage) -> int:
    """Push to every device of the given users; returns how many accepted it."""
    ids = set(user_ids)
    if not ids or not get_settings().push_enabled:
        return 0
    try:
        async with get_session_factory()() as db:
            subscriptions = list(
                (
                    await db.execute(
                        select(PushSubscription).where(
                            PushSubscription.user_id.in_(ids)
                        )
                    )
                )
                .scalars()
                .all()
            )
            statuses = await asyncio.gather(
                *(asyncio.to_thread(_deliver, s, message) for s in subscriptions)
            )
            gone = [
                s.id
                for s, code in zip(subscriptions, statuses, strict=True)
                if code in GONE_STATUSES
            ]
            delivered = 0
            for subscription, code in zip(subscriptions, statuses, strict=True):
                if 200 <= code < 300:
                    delivered += 1
                elif code not in GONE_STATUSES:
                    logger.warning(
                        "Push not delivered",
                        extra={"subscription_id": subscription.id, "status": code},
                    )
            if gone:
                await db.execute(
                    delete(PushSubscription).where(PushSubscription.id.in_(gone))
                )
                await db.commit()
                logger.info(
                    "Removed dead push subscriptions", extra={"count": len(gone)}
                )
            return delivered
    except Exception:
        logger.exception("Push send failed")
        return 0


async def notify_on_the_clock(season_id: int, team_id: int) -> None:
    """Tell the owner of the team that is now picking."""
    if not get_settings().push_enabled:
        return
    async with get_session_factory()() as db:
        row = (
            await db.execute(
                select(Team.owner_id, League.id, League.name)
                .join(Season, Season.id == Team.season_id)
                .join(League, League.id == Season.league_id)
                .where(Team.id == team_id, Team.season_id == season_id)
            )
        ).one_or_none()
    if row is None or row.owner_id is None:
        return
    await send_to_users(
        [row.owner_id],
        PushMessage(
            title="You're on the clock",
            body=f"Your pick is up in {row.name}.",
            url=f"/leagues/{row.id}/draft",
            tag=f"on-the-clock-{season_id}",
        ),
    )


async def notify_league_message(league_id: int, sender_user_id: int) -> None:
    """Hook for a new chat message; deliberately unwired until the chat backend exists.

    TODO(#265, #266): call this from the chat post path via `spawn`. It must notify the
    league's members except the sender and anyone who muted chat, with a title and body
    that carry no message text.
    """
