"""Notifications (#397): the inbox, and `notify`, the one way to tell a member something.

`notify` writes an inbox entry for every recipient, whatever their push choices or
devices, so a dismissed or silenced push is never lost, and then pushes to the devices
of those who want that kind (`push.send_to_users`). Every new kind of notification
(player alerts, mentions, announcements) goes through it: add the kind to
`NotificationKind` and `PUSH_KINDS`, word it in the SPA (`components/notifications/
inboxView.ts`), and call `notify`. Chat is the exception: it lives in the Feed with its
own dot, so chat pushes skip the inbox, except the one for a message that @mentions a
member (`services/mentions.py`).
"""

from collections.abc import Iterable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Literal

from sqlalchemy import ColumnElement, Row, delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models.league import League, LeagueMember, Season, Team
from api.db.models.notification import Notification
from api.services import push
from api.services.live_leagues import live_league_ids, live_season_ids
from api.services.standings_view import ROUND_NAMES

NotificationKind = Literal[
    "draft_turn",
    "draft_lobby",
    "draft_started",
    "draft_soon",
    "draft_scheduled",
    "lineup_lock",
    "lineup_changed",
    "starter_out",
    "player_scored",
    "round_result",
    "team_eliminated",
    "mention",
    "announcement",
]
# The push preference each kind follows; the inbox entry is written either way.
PUSH_KINDS: dict[NotificationKind, push.PushKind] = {
    "draft_turn": "draft",
    "draft_lobby": "draft",
    "draft_started": "draft",
    "draft_soon": "draft",
    "draft_scheduled": "draft",
    "lineup_lock": "lineup",
    "lineup_changed": "lineup",
    "starter_out": "starter",
    "player_scored": "score",
    "round_result": "round",
    "team_eliminated": "round",
    "mention": "mention",
    "announcement": "announcement",
}
KEEP_FOR = timedelta(days=30)
INBOX_LIMIT = 100
PREVIEW_LENGTH = 140


@dataclass(frozen=True)
class Notice:
    kind: NotificationKind
    league_id: int
    # Ids only (camelCase keys, as the API returns them): the SPA words the entry and
    # builds its link from them, so names never go stale or outlive an account.
    payload: dict[str, int]
    push: push.PushMessage


async def notify(db: AsyncSession, user_ids: Iterable[int], notice: Notice) -> None:
    """Add `notice` to each user's inbox, commit, then push it to their devices."""
    ids = set(user_ids)
    if not ids:
        return
    now = datetime.now(UTC)
    # A repeat of something still unread moves the entry to the top instead of adding
    # another, the way the push's tag replaces the earlier one on the device.
    repeated = set(
        (
            await db.execute(
                update(Notification)
                .where(
                    Notification.user_id.in_(ids),
                    Notification.kind == notice.kind,
                    Notification.league_id == notice.league_id,
                    Notification.payload == notice.payload,
                    Notification.read_at.is_(None),
                )
                .values(created_at=now)
                .returning(Notification.user_id)
            )
        )
        .scalars()
        .all()
    )
    db.add_all(
        Notification(
            user_id=user_id,
            kind=notice.kind,
            league_id=notice.league_id,
            payload=notice.payload,
            created_at=now,
        )
        for user_id in ids - repeated
    )
    await db.commit()
    await push.send_to_users(db, ids, notice.push, PUSH_KINDS[notice.kind])


def _visible(user_id: int) -> list[ColumnElement[bool]]:
    """The user's entries of the last 30 days, from live leagues they are still in."""
    return [
        Notification.user_id == user_id,
        Notification.created_at >= datetime.now(UTC) - KEEP_FOR,
        Notification.league_id.in_(live_league_ids()),
        Notification.league_id.in_(
            select(LeagueMember.league_id).where(
                LeagueMember.user_id == user_id, LeagueMember.left_at.is_(None)
            )
        ),
    ]


async def inbox(
    db: AsyncSession, user_id: int
) -> tuple[list[Row[Notification, str]], int]:
    """The newest entries with their league's name, and how many are unread."""
    rows = (
        await db.execute(
            select(Notification, League.name)
            .join(League, League.id == Notification.league_id)
            .where(*_visible(user_id))
            .order_by(Notification.created_at.desc(), Notification.id.desc())
            .limit(INBOX_LIMIT)
        )
    ).all()
    unread = await db.scalar(
        select(func.count())
        .select_from(Notification)
        .where(*_visible(user_id), Notification.read_at.is_(None))
    )
    return list(rows), int(unread or 0)


async def mark_read(db: AsyncSession, user_id: int, ids: list[int] | None) -> None:
    """Mark the given entries read, or every one when `ids` is None."""
    query = update(Notification).where(
        Notification.user_id == user_id, Notification.read_at.is_(None)
    )
    if ids is not None:
        query = query.where(Notification.id.in_(ids))
    await db.execute(query.values(read_at=datetime.now(UTC)))


async def prune_old(db: AsyncSession) -> int:
    """Delete entries older than `KEEP_FOR`; returns how many."""
    result = await db.execute(
        delete(Notification).where(
            Notification.created_at < datetime.now(UTC) - KEEP_FOR
        )
    )
    return int(result.rowcount or 0)  # type: ignore[attr-defined]


async def delete_for_user(db: AsyncSession, user_id: int) -> None:
    await db.execute(delete(Notification).where(Notification.user_id == user_id))


async def _live_league(db: AsyncSession, season_id: int) -> Row[int, str] | None:
    return (
        await db.execute(
            select(League.id, League.name)
            .join(Season, Season.league_id == League.id)
            .where(Season.id == season_id, Season.id.in_(live_season_ids()))
        )
    ).one_or_none()


async def _active_members(db: AsyncSession, league_id: int) -> list[int]:
    return list(
        (
            await db.execute(
                select(LeagueMember.user_id).where(
                    LeagueMember.league_id == league_id, LeagueMember.left_at.is_(None)
                )
            )
        )
        .scalars()
        .all()
    )


async def notify_on_the_clock(db: AsyncSession, season_id: int, team_id: int) -> None:
    """Tell the owner of the team that is now picking."""
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
    await notify(
        db,
        [row.owner_id],
        Notice(
            kind="draft_turn",
            league_id=row.id,
            payload={"seasonId": season_id, "teamId": team_id},
            push=push.PushMessage(
                title="You're on the clock",
                body=f"Your pick is up in {row.name}.",
                url=f"/leagues/{row.id}/draft",
                tag=f"on-the-clock-{season_id}",
                urgency="high",
            ),
        ),
    )


async def notify_draft_phase(
    db: AsyncSession, season_id: int, phase: Literal["lobby", "started", "scheduled"]
) -> None:
    """Tell every active member the draft lobby is open, the draft has started or its time is set."""
    title, body = {
        "lobby": ("The draft lobby is open", "Head in before it starts."),
        "started": ("The draft has started", "Your commissioner started the draft."),
        # The server doesn't know each member's zone, so the time itself stays in the app.
        "scheduled": (
            "The draft time is set",
            "Open the app to see it in your time zone.",
        ),
    }[phase]
    kinds: dict[str, NotificationKind] = {
        "lobby": "draft_lobby",
        "started": "draft_started",
        "scheduled": "draft_scheduled",
    }
    kind = kinds[phase]
    await _notify_draft_members(db, season_id, kind, title, body, f"draft-{phase}")


async def notify_draft_soon(db: AsyncSession, season_id: int, minutes: int) -> None:
    """The reminder shortly before the scheduled time; it says the start is manual."""
    await _notify_draft_members(
        db,
        season_id,
        "draft_soon",
        "Your draft is scheduled soon",
        f"Scheduled in about {minutes} minutes. Your commissioner starts it.",
        "draft-soon",
    )


async def _notify_draft_members(
    db: AsyncSession,
    season_id: int,
    kind: NotificationKind,
    title: str,
    body: str,
    tag_prefix: str,
) -> None:
    league = await _live_league(db, season_id)
    if league is None:
        return
    await notify(
        db,
        await _active_members(db, league.id),
        Notice(
            kind=kind,
            league_id=league.id,
            payload={"seasonId": season_id},
            push=push.PushMessage(
                title=title,
                body=f"{body} ({league.name})",
                url=f"/leagues/{league.id}/draft",
                tag=f"{tag_prefix}-{season_id}",
                urgency="high",
            ),
        ),
    )


async def notify_announcement(
    db: AsyncSession, league_id: int, season_id: int, author_id: int, body: str
) -> None:
    """Push a pinned announcement to the other active members who allow it; the text
    is cut to fit a notification, the inbox entry only points at the league home."""
    league_name = await db.scalar(
        select(League.name).where(
            League.id == league_id, League.id.in_(live_league_ids())
        )
    )
    if league_name is None:
        return
    members = set(await _active_members(db, league_id)) - {author_id}
    preview = body if len(body) <= PREVIEW_LENGTH else f"{body[:PREVIEW_LENGTH]}..."
    await notify(
        db,
        members,
        Notice(
            kind="announcement",
            league_id=league_id,
            payload={"seasonId": season_id},
            push=push.PushMessage(
                title=f"Announcement from {league_name}",
                body=preview,
                url=f"/leagues/{league_id}",
                tag=f"announcement-{league_id}",
            ),
        ),
    )


async def notify_lineup_lock(
    db: AsyncSession, team: Team, league_id: int, league_name: str, round_: int
) -> None:
    """The reminder an hour before a round locks, for an owner with an empty slot."""
    if team.owner_id is None:
        return
    await notify(
        db,
        [team.owner_id],
        Notice(
            kind="lineup_lock",
            league_id=league_id,
            payload={"seasonId": team.season_id, "teamId": team.id, "round": round_},
            push=push.PushMessage(
                title="Lineup locks in about an hour",
                body=f"You have an empty starter slot in {league_name}.",
                url=f"/leagues/{league_id}/teams/{team.id}",
                tag=f"lineup-lock-{team.id}-{round_}",
                urgency="high",
            ),
        ),
    )


async def notify_lineup_changed(db: AsyncSession, team_id: int, round_: int) -> None:
    """Tell an owner a commissioner changed their lineup."""
    row = (
        await db.execute(
            select(Team.owner_id, Team.season_id, League.id, League.name)
            .join(Season, Season.id == Team.season_id)
            .join(League, League.id == Season.league_id)
            .where(Team.id == team_id, Season.id.in_(live_season_ids()))
        )
    ).one_or_none()
    if row is None or row.owner_id is None:
        return
    round_name = ROUND_NAMES.get(round_, f"Round {round_}")
    await notify(
        db,
        [row.owner_id],
        Notice(
            kind="lineup_changed",
            league_id=row.id,
            payload={"seasonId": row.season_id, "teamId": team_id, "round": round_},
            push=push.PushMessage(
                title="A commissioner changed your lineup",
                body=f"Your {round_name} lineup in {row.name}.",
                url=f"/leagues/{row.id}/teams/{team_id}",
                tag=f"lineup-changed-{team_id}-{round_}",
            ),
        ),
    )
