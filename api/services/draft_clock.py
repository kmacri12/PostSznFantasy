import asyncio
import logging
from datetime import UTC, datetime

from sqlalchemy import select

from api.db.models.draft import Draft
from api.db.session import get_session_factory
from api.models.enums import DraftStatus
from api.services import draft_flow
from api.services.draft_events import pick_events
from api.services.draft_picks import DraftPickError
from api.ws.draft_manager import draft_manager

logger = logging.getLogger(__name__)

TICK_SECONDS = 1


async def expire_overdue_picks() -> int:
    """Auto-pick for every draft whose server-side deadline has passed."""
    now = datetime.now(UTC)
    async with get_session_factory()() as db:
        league_ids = list(
            (
                await db.execute(
                    select(Draft.league_id).where(
                        Draft.status == DraftStatus.IN_PROGRESS.value,
                        Draft.current_pick_deadline <= now,
                    )
                )
            )
            .scalars()
            .all()
        )

    handled = 0
    for league_id in league_ids:
        async with get_session_factory()() as db:
            try:
                result = await draft_flow.auto_pick(db, league_id)
                draft = await db.scalar(
                    select(Draft).where(Draft.league_id == league_id)
                )
                assert draft is not None
                events = await pick_events(db, draft, result)
                await db.commit()
            except DraftPickError as exc:
                await db.rollback()
                logger.warning(
                    "Auto-pick failed",
                    extra={"league_id": league_id, "error": str(exc)},
                )
                continue
        for event in events:
            await draft_manager.broadcast(league_id, event)
        handled += 1
    return handled


async def run_draft_clock() -> None:
    """Loop until cancelled; a failing tick is logged and retried."""
    logger.info("Draft clock started")
    while True:
        try:
            await expire_overdue_picks()
        except Exception:
            logger.exception("Draft clock tick failed")
        await asyncio.sleep(TICK_SECONDS)
