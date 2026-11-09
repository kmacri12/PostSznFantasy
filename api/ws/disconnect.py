from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models.league import Season
from api.ws.draft_manager import draft_manager
from api.ws.feed_manager import feed_manager


async def close_league_sockets(
    db: AsyncSession, league_id: int, *, user_id: int | None = None
) -> None:
    """Sockets check membership only at connect, so a removal or a deleted league has to
    cut them off here (one user's, or the whole league's)."""
    season_ids = list(
        await db.scalars(select(Season.id).where(Season.league_id == league_id))
    )
    reason = "You are no longer in this league"
    for manager in (draft_manager, feed_manager):
        await manager.close_sockets(season_ids, user_id=user_id, reason=reason)
