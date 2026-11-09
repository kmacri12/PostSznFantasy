import asyncio
import logging
from datetime import UTC, datetime

import sentry_sdk
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models.draft import Draft, DraftPick
from api.db.models.league import Team
from api.db.session import get_session_factory
from api.models.enums import DraftStatus
from api.services import draft_flow
from api.services.draft_events import announce_events, pick_events
from api.services.draft_picks import (
    DraftPickError,
    PickNotDue,
    next_deadline,
    placed_order,
    team_on_the_clock,
)
from api.services.live_leagues import live_season_ids

logger = logging.getLogger(__name__)

TICK_SECONDS = 1


async def _unowned_team_on_clock(db: AsyncSession, draft: Draft) -> bool:
    picks_made = await db.scalar(
        select(func.count())
        .select_from(DraftPick)
        .where(DraftPick.draft_id == draft.id)
    )
    team_id = team_on_the_clock(placed_order(draft), picks_made or 0, draft.draft_type)
    owner_id = await db.scalar(select(Team.owner_id).where(Team.id == team_id))
    return owner_id is None


async def expire_overdue_picks() -> int:
    """Auto-pick for every draft whose deadline has passed or whose team on the clock has no owner."""
    now = datetime.now(UTC)
    async with get_session_factory()() as db:
        drafts = (
            (
                await db.execute(
                    select(Draft).where(
                        Draft.season_id.in_(live_season_ids()),
                        Draft.status == DraftStatus.IN_PROGRESS.value,
                    )
                )
            )
            .scalars()
            .all()
        )
        season_ids = [
            draft.season_id
            for draft in drafts
            if (draft.current_pick_deadline or now) <= now
            or await _unowned_team_on_clock(db, draft)
        ]

    handled = 0
    for season_id in season_ids:
        async with get_session_factory()() as db:
            try:
                result = await draft_flow.auto_pick(db, season_id, only_if_overdue=True)
                draft = await db.scalar(
                    select(Draft).where(Draft.season_id == season_id)
                )
                assert draft is not None
                events = await pick_events(db, draft, result)
                await db.commit()
            except PickNotDue:
                await db.rollback()
                continue
            except DraftPickError as exc:
                await db.rollback()
                logger.error(
                    "Auto-pick failed",
                    extra={"season_id": season_id, "error": str(exc)},
                )
                continue
        await announce_events(season_id, events)
        handled += 1
    return handled


async def extend_overdue_deadlines() -> int:
    """Give a fresh pick window to drafts whose deadline lapsed while we were down.

    Without this, a restart mid-draft would auto-pick for every team the outage
    skipped, one per tick.
    """
    now = datetime.now(UTC)
    async with get_session_factory()() as db:
        drafts = (
            (
                await db.execute(
                    select(Draft)
                    .where(
                        Draft.season_id.in_(live_season_ids()),
                        Draft.status == DraftStatus.IN_PROGRESS.value,
                        Draft.current_pick_deadline <= now,
                    )
                    .with_for_update()
                )
            )
            .scalars()
            .all()
        )
        for draft in drafts:
            draft.pick_started_at = now
            draft.current_pick_deadline = next_deadline(draft, now)
        await db.commit()
    return len(drafts)


async def run_draft_clock() -> None:
    """Loop until cancelled; a failing tick is logged and retried."""
    extended = await extend_overdue_deadlines()
    logger.info("Draft clock started", extra={"extended_drafts": extended})
    while True:
        try:
            await expire_overdue_picks()
        except Exception:
            logger.exception("Draft clock tick failed")
            sentry_sdk.capture_exception()
        await asyncio.sleep(TICK_SECONDS)
