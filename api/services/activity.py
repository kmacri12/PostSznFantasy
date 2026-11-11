"""The activity feed: one append-only record of what changed in a season and by whom.

Whatever changes something writes its event with `append`; nothing here edits or
removes one. The season feed is every event of a season and a team's feed is the
events carrying its `team_id`. Each member remembers the newest event they were
shown per feed (`mark_viewed`), which is all "new activity" means.
"""

from collections.abc import Iterable
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import ColumnElement, and_, func, or_, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import InstrumentedAttribute

from api.db.models.activity import (
    LEAGUE_FEED,
    ActivityEvent,
    ActivityView,
    LeagueMessage,
)
from api.db.models.league import LeagueMember, Season, Team
from api.db.models.user import User
from api.models.activity_models import (
    ActivityEventOut,
    ActivityFeed,
    ActivityPayload,
    ScoreChange,
    SlotMark,
)
from api.models.enums import ActivityKind
from api.services.live_leagues import live_league_ids

# What lights the dot on the league nav and the league feed, besides chat messages.
# Ordinary lineup moves happen too often to count as news; a team's own feed counts them.
LEAGUE_DOT_KINDS = [
    ActivityKind.COMMISSIONER_OVERRIDE.value,
    ActivityKind.STAT_CORRECTION.value,
    ActivityKind.SETTINGS_CHANGE.value,
    ActivityKind.MEMBERSHIP_JOINED.value,
    ActivityKind.MEMBERSHIP_LEFT.value,
    ActivityKind.ROLE_CHANGED.value,
    ActivityKind.DRAFT_ORDER_RANDOMIZED.value,
    ActivityKind.DRAFT_ORDER_CHANGED.value,
    ActivityKind.DRAFT_STARTED.value,
    ActivityKind.DRAFT_COMPLETED.value,
    ActivityKind.DRAFT_TIME_SET.value,
]
# Who is in the league is news to a newcomer too, so these ignore the "before they
# joined" rule that hides older overrides and corrections.
MEMBERSHIP_KINDS = [
    ActivityKind.MEMBERSHIP_JOINED.value,
    ActivityKind.MEMBERSHIP_LEFT.value,
    ActivityKind.ROLE_CHANGED.value,
]
DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100


@dataclass(frozen=True)
class Actor:
    user_id: int
    name: str

    @classmethod
    def of(cls, user: User) -> "Actor":
        return cls(user.id, user.username)


async def append(
    db: AsyncSession,
    season_id: int,
    payload: ActivityPayload,
    *,
    team_id: int | None = None,
    actor: Actor | None = None,
    at: datetime | None = None,
) -> ActivityEvent:
    """Add one event; with no actor it was the system's doing (e.g. a stat correction)."""
    event = ActivityEvent(
        season_id=season_id,
        team_id=team_id,
        kind=payload.kind.value,
        actor_user_id=actor.user_id if actor else None,
        actor_name=actor.name if actor else None,
        payload=payload.model_dump(mode="json"),
    )
    if at is not None:
        event.created_at = at
    db.add(event)
    await db.flush()
    return event


async def append_to_league(
    db: AsyncSession,
    league_id: int,
    payload: ActivityPayload,
    *,
    actor: Actor,
) -> ActivityEvent | None:
    """Post a league-level event to the current season's feed (membership belongs to
    the league, the feed to a season); a league without a season has no feed yet."""
    season_id = await db.scalar(
        select(Season.id)
        .where(Season.league_id == league_id)
        .order_by(Season.year.desc())
        .limit(1)
    )
    if season_id is None:
        return None
    return await append(db, season_id, payload, actor=actor)


def _scope(season_id: int, team_id: int | None) -> ColumnElement[bool]:
    in_league = ActivityEvent.season_id == season_id
    if team_id is None:
        return in_league
    return and_(in_league, ActivityEvent.team_id == team_id)


@dataclass(frozen=True)
class Baseline:
    """What a member counts as already seen in one feed."""

    viewer_id: int
    last_event_id: int
    last_message_id: int
    joined_at: datetime

    def is_new(self, event: ActivityEvent) -> bool:
        return (
            event.id > self.last_event_id
            and (event.created_at > self.joined_at or event.kind in MEMBERSHIP_KINDS)
            and event.actor_user_id != self.viewer_id
        )

    def message_is_new(self, message: LeagueMessage) -> bool:
        return (
            message.id > self.last_message_id
            and message.created_at > self.joined_at
            and message.author_user_id != self.viewer_id
        )

    @property
    def is_new_clause(self) -> ColumnElement[bool]:
        return and_(
            ActivityEvent.id > self.last_event_id,
            or_(
                ActivityEvent.created_at > self.joined_at,
                ActivityEvent.kind.in_(MEMBERSHIP_KINDS),
            ),
            or_(
                ActivityEvent.actor_user_id.is_(None),
                ActivityEvent.actor_user_id != self.viewer_id,
            ),
        )

    @property
    def message_is_new_clause(self) -> ColumnElement[bool]:
        return and_(
            LeagueMessage.id > self.last_message_id,
            LeagueMessage.created_at > self.joined_at,
            LeagueMessage.deleted_at.is_(None),
            or_(
                LeagueMessage.author_user_id.is_(None),
                LeagueMessage.author_user_id != self.viewer_id,
            ),
        )


async def load_baseline(
    db: AsyncSession, viewer_id: int, season_id: int, team_id: int | None
) -> Baseline:
    seen = (
        await db.execute(
            select(ActivityView.last_event_id, ActivityView.last_message_id).where(
                ActivityView.user_id == viewer_id,
                ActivityView.season_id == season_id,
                ActivityView.team_id
                == (team_id if team_id is not None else LEAGUE_FEED),
            )
        )
    ).one_or_none()
    joined_at = await db.scalar(
        select(LeagueMember.joined_at)
        .join(Season, Season.league_id == LeagueMember.league_id)
        .where(Season.id == season_id, LeagueMember.user_id == viewer_id)
    )
    return Baseline(
        viewer_id,
        seen.last_event_id if seen else 0,
        seen.last_message_id if seen else 0,
        joined_at or datetime.min.replace(tzinfo=UTC),
    )


def event_out(
    event: ActivityEvent, team_name: str | None, baseline: Baseline
) -> ActivityEventOut:
    return ActivityEventOut(
        id=event.id,
        kind=ActivityKind(event.kind),
        created_at=event.created_at,
        team_id=event.team_id,
        team_name=team_name,
        actor_user_id=event.actor_user_id,
        actor_name=event.actor_name,
        payload=event.payload,
        is_new=baseline.is_new(event),
    )


async def feed(
    db: AsyncSession,
    viewer_id: int,
    season_id: int,
    *,
    team_id: int | None = None,
    limit: int = DEFAULT_PAGE_SIZE,
    before: int | None = None,
) -> ActivityFeed:
    """A page of the league's feed, or of one team's, newest first."""
    limit = max(1, min(limit, MAX_PAGE_SIZE))
    baseline = await load_baseline(db, viewer_id, season_id, team_id)
    query = (
        select(ActivityEvent, Team.name)
        .outerjoin(Team, Team.id == ActivityEvent.team_id)
        .where(_scope(season_id, team_id))
        .order_by(ActivityEvent.created_at.desc(), ActivityEvent.id.desc())
        .limit(limit + 1)
    )
    if before is not None:
        # Newest first by time, not id: backfilled history gets ids after newer events.
        cursor_at = (
            select(ActivityEvent.created_at)
            .where(ActivityEvent.id == before)
            .scalar_subquery()
        )
        query = query.where(
            or_(
                ActivityEvent.created_at < cursor_at,
                and_(ActivityEvent.created_at == cursor_at, ActivityEvent.id < before),
            )
        )
    rows = (await db.execute(query)).all()
    page = rows[:limit]
    lights_dot = baseline.is_new_clause
    if team_id is None:
        lights_dot = and_(lights_dot, ActivityEvent.kind.in_(LEAGUE_DOT_KINDS))
    has_new = await db.scalar(
        select(ActivityEvent.id).where(_scope(season_id, team_id), lights_dot).limit(1)
    )
    return ActivityFeed(
        events=[event_out(event, team_name, baseline) for event, team_name in page],
        next_before=page[-1][0].id if len(rows) > limit else None,
        has_new=has_new is not None,
    )


def _seen(newest: int | None, up_to: int | None) -> int:
    return (newest or 0) if up_to is None else min(up_to, newest or 0)


async def mark_viewed(
    db: AsyncSession,
    viewer_id: int,
    season_id: int,
    *,
    team_id: int | None = None,
    up_to: int | None = None,
    up_to_message: int | None = None,
) -> None:
    """Remember the viewer has seen the feed up to `up_to` (default: everything now).
    The league feed's one marker covers its chat messages too."""
    newest = await db.scalar(
        select(func.max(ActivityEvent.id)).where(_scope(season_id, team_id))
    )
    newest_message = (
        await db.scalar(
            select(func.max(LeagueMessage.id)).where(
                LeagueMessage.season_id == season_id
            )
        )
        if team_id is None
        else None
    )
    if newest is None and newest_message is None:
        return
    values = {
        "user_id": viewer_id,
        "season_id": season_id,
        "team_id": team_id if team_id is not None else LEAGUE_FEED,
        "last_event_id": _seen(newest, up_to),
        "last_message_id": _seen(newest_message, up_to_message),
    }
    row = insert(ActivityView).values(**values)
    await db.execute(
        row.on_conflict_do_update(
            index_elements=[
                ActivityView.user_id,
                ActivityView.season_id,
                ActivityView.team_id,
            ],
            set_={
                "last_event_id": func.greatest(
                    ActivityView.last_event_id, row.excluded.last_event_id
                ),
                "last_message_id": func.greatest(
                    ActivityView.last_message_id, row.excluded.last_message_id
                ),
            },
        )
    )


def _not_by(
    column: InstrumentedAttribute[int | None], user_id: int
) -> ColumnElement[bool]:
    return or_(column.is_(None), column != user_id)


async def new_activity_counts(db: AsyncSession, viewer_id: int) -> dict[int, int]:
    """Per league, how many feed events and messages the member hasn't seen (the Feed
    tab's badge); leagues with none are absent."""
    member = and_(
        LeagueMember.league_id == Season.league_id,
        LeagueMember.user_id == viewer_id,
        LeagueMember.left_at.is_(None),
    )
    seen = and_(
        ActivityView.user_id == viewer_id,
        ActivityView.team_id == LEAGUE_FEED,
    )
    events = (
        select(Season.league_id, func.count())
        .join(ActivityEvent, ActivityEvent.season_id == Season.id)
        .where(Season.league_id.in_(live_league_ids()))
        .join(LeagueMember, member)
        .outerjoin(
            ActivityView,
            and_(seen, ActivityView.season_id == ActivityEvent.season_id),
        )
        .where(
            ActivityEvent.kind.in_(LEAGUE_DOT_KINDS),
            ActivityEvent.id > func.coalesce(ActivityView.last_event_id, 0),
            or_(
                ActivityEvent.created_at > LeagueMember.joined_at,
                ActivityEvent.kind.in_(MEMBERSHIP_KINDS),
            ),
            _not_by(ActivityEvent.actor_user_id, viewer_id),
        )
        .group_by(Season.league_id)
    )
    messages = (
        select(Season.league_id, func.count())
        .join(LeagueMessage, LeagueMessage.season_id == Season.id)
        .where(Season.league_id.in_(live_league_ids()))
        .join(LeagueMember, member)
        .outerjoin(
            ActivityView,
            and_(seen, ActivityView.season_id == LeagueMessage.season_id),
        )
        .where(
            LeagueMessage.deleted_at.is_(None),
            LeagueMessage.id > func.coalesce(ActivityView.last_message_id, 0),
            LeagueMessage.created_at > LeagueMember.joined_at,
            _not_by(LeagueMessage.author_user_id, viewer_id),
        )
        .group_by(Season.league_id)
    )
    counts: dict[int, int] = {}
    for query in (events, messages):
        for league_id, count in await db.execute(query):
            counts[league_id] = counts.get(league_id, 0) + count
    return counts


def derive_slot_marks(
    events: Iterable[ActivityEvent],
) -> dict[tuple[int, int], SlotMark]:
    """Per (round, slot index), the latest lineup event that changed the slot, kept
    only when a commissioner made it. Events are oldest first; an owner changing the
    slot afterwards replaces the mark with nothing."""
    latest: dict[tuple[int, int], ActivityEvent] = {}
    for event in events:
        payload: dict[str, Any] = event.payload
        for index in payload["changedSlots"]:
            latest[(payload["round"], index)] = event
    return {
        key: SlotMark(
            kind=(
                "override"
                if event.kind == ActivityKind.COMMISSIONER_OVERRIDE.value
                else "commissioner_set"
            ),
            actor_name=event.actor_name,
            at=event.created_at,
        )
        for key, event in latest.items()
        if event.kind == ActivityKind.COMMISSIONER_OVERRIDE.value
        or event.payload.get("byCommissioner")
    }


async def slot_marks(db: AsyncSession, team_id: int) -> dict[tuple[int, int], SlotMark]:
    events = await db.scalars(
        select(ActivityEvent)
        .where(
            ActivityEvent.team_id == team_id,
            ActivityEvent.kind.in_(
                [
                    ActivityKind.LINEUP_MOVE.value,
                    ActivityKind.COMMISSIONER_OVERRIDE.value,
                ]
            ),
        )
        .order_by(ActivityEvent.id)
    )
    return derive_slot_marks(events)


async def score_changes(
    db: AsyncSession, team_id: int
) -> dict[tuple[int, int], ScoreChange]:
    """Per (player id, round), the latest stat correction to that player's score."""
    events = await db.scalars(
        select(ActivityEvent)
        .where(
            ActivityEvent.team_id == team_id,
            ActivityEvent.kind == ActivityKind.STAT_CORRECTION.value,
        )
        .order_by(ActivityEvent.id)
    )
    return {
        (event.payload["playerId"], event.payload["round"]): ScoreChange(
            previous_points=event.payload["previousPoints"],
            new_points=event.payload["newPoints"],
            changed_at=event.created_at,
        )
        for event in events
    }
