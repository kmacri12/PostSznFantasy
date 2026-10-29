import logging

from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models.nfl import NFLTeam

logger = logging.getLogger(__name__)


async def mark_eliminated_teams(
    db: AsyncSession, eliminated_team_ids: list[int]
) -> None:
    """Set is_active = False for all given NFL team IDs."""
    if not eliminated_team_ids:
        return
    await db.execute(
        update(NFLTeam)
        .where(NFLTeam.id.in_(eliminated_team_ids))
        .values(is_active=False)
    )
    logger.info("Marked %d teams as eliminated", len(eliminated_team_ids))
