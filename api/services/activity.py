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

from api.db.models.activity import LEAGUE_FEED, ActivityEvent, ActivityView
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

# What lights the dot on the league nav and the league feed. Ordinary lineup moves are
# in the feed but happen too often to count as news; a team's own feed counts them.
LEAGUE_DOT_KINDS = [
    ActivityKind.COMMISSIONER_OVERRIDE.value,
    ActivityKind.STAT_CORRECTION.value,
    ActivityKind.SETTINGS_CHANGE.value,
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


def _scope(season_id: int, team_id: int | None) -> ColumnElement[bool]:
    in_league = ActivityEvent.season_id == season_id
    if team_id is None:
        return in_league
    return and_(in_league, ActivityEvent.team_id == team_id)


@dataclass(frozen=True)
class _Baseline:
    """What a member counts as already seen in one feed."""

    viewer_id: int
    last_event_id: int
    joined_at: datetime

    def is_new(self, event: ActivityEvent) -> bool:
        return (
            event.id > self.last_event_id
            and event.created_at > self.joined_at
            and event.actor_user_id != self.viewer_id
        )

    @property
    def is_new_clause(self) -> ColumnElement[bool]:
        return and_(
            ActivityEvent.id > self.last_event_id,
            ActivityEvent.created_at > self.joined_at,
            or_(
                ActivityEvent.actor_user_id.is_(None),
                ActivityEvent.actor_user_id != self.viewer_id,
            ),
        )


async def _baseline(
    db: AsyncSession, viewer_id: int, season_id: int, team_id: int | None
) -> _Baseline:
    last = await db.scalar(
        select(ActivityView.last_event_id).where(
            ActivityView.user_id == viewer_id,
            ActivityView.season_id == season_id,
            ActivityView.team_id == (team_id if team_id is not None else LEAGUE_FEED),
        )
    )
    joined_at = await db.scalar(
        select(LeagueMember.joined_at)
        .join(Season, Season.league_id == LeagueMember.league_id)
        .where(Season.id == season_id, LeagueMember.user_id == viewer_id)
    )
    return _Baseline(
        viewer_id, last or 0, joined_at or datetime.min.replace(tzinfo=UTC)
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
    baseline = await _baseline(db, viewer_id, season_id, team_id)
    query = (
        select(ActivityEvent, Team.name)
        .outerjoin(Team, Team.id == ActivityEvent.team_id)
        .where(_scope(season_id, team_id))
        .order_by(ActivityEvent.id.desc())
        .limit(limit + 1)
    )
    if before is not None:
        query = query.where(ActivityEvent.id < before)
    rows = (await db.execute(query)).all()
    page = rows[:limit]
    lights_dot = baseline.is_new_clause
    if team_id is None:
        lights_dot = and_(lights_dot, ActivityEvent.kind.in_(LEAGUE_DOT_KINDS))
    has_new = await db.scalar(
        select(ActivityEvent.id).where(_scope(season_id, team_id), lights_dot).limit(1)
    )
    return ActivityFeed(
        events=[
            ActivityEventOut(
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
            for event, team_name in page
        ],
        next_before=page[-1][0].id if len(rows) > limit else None,
        has_new=has_new is not None,
    )


async def mark_viewed(
    db: AsyncSession,
    viewer_id: int,
    season_id: int,
    *,
    team_id: int | None = None,
    up_to: int | None = None,
) -> None:
    """Remember the viewer has seen the feed up to `up_to` (default: everything now)."""
    newest = await db.scalar(
        select(func.max(ActivityEvent.id)).where(_scope(season_id, team_id))
    )
    if newest is None:
        return
    seen = newest if up_to is None else min(up_to, newest)
    row = insert(ActivityView).values(
        user_id=viewer_id,
        season_id=season_id,
        team_id=team_id if team_id is not None else LEAGUE_FEED,
        last_event_id=seen,
    )
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
                )
            },
        )
    )


async def leagues_with_new_activity(db: AsyncSession, viewer_id: int) -> set[int]:
    """Leagues with a season feed holding events the member hasn't seen (nav dot)."""
    rows = await db.execute(
        select(Season.league_id)
        .join(ActivityEvent, ActivityEvent.season_id == Season.id)
        .join(
            LeagueMember,
            and_(
                LeagueMember.league_id == Season.league_id,
                LeagueMember.user_id == viewer_id,
                LeagueMember.left_at.is_(None),
            ),
        )
        .outerjoin(
            ActivityView,
            and_(
                ActivityView.user_id == viewer_id,
                ActivityView.season_id == ActivityEvent.season_id,
                ActivityView.team_id == LEAGUE_FEED,
            ),
        )
        .where(
            ActivityEvent.kind.in_(LEAGUE_DOT_KINDS),
            ActivityEvent.id > func.coalesce(ActivityView.last_event_id, 0),
            ActivityEvent.created_at > LeagueMember.joined_at,
            or_(
                ActivityEvent.actor_user_id.is_(None),
                ActivityEvent.actor_user_id != viewer_id,
            ),
        )
        .distinct()
    )
    return set(rows.scalars())


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
