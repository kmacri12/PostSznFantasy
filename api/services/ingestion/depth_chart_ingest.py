import logging
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models.nfl import DepthChartStarter, NFLPlayer, NFLTeam
from api.services.ingestion.guard import IngestionKind, guarded
from api.services.ingestion.schemas import parse_depth_chart_starters
from api.utils.rapidapi.rapidapi import RapidApiClient, get_rapidapi_client

logger = logging.getLogger(__name__)


@guarded(IngestionKind.DEPTH_CHARTS)
async def ingest_depth_charts(
    db: AsyncSession,
    client: RapidApiClient | None = None,
    raw_data: list[dict[str, Any]] | None = None,
) -> int:
    """Replace the stored QB1 / PK1 starters with the depth chart's current ones.

    An empty or unusable response keeps the last starters rather than wiping them.
    """
    if raw_data is None:
        client = client or get_rapidapi_client()
        raw_data = await client.get_nfl_depth_charts()

    team_ids = set((await db.execute(select(NFLTeam.id))).scalars().all())
    player_ids = set((await db.execute(select(NFLPlayer.id))).scalars().all())
    rows = [
        row
        for row in parse_depth_chart_starters(raw_data)
        if row["team_id"] in team_ids and row["player_id"] in player_ids
    ]
    if not rows:
        logger.warning("No depth chart starters found; keeping the previous ones")
        return 0

    await db.execute(delete(DepthChartStarter))
    db.add_all(DepthChartStarter(**row) for row in rows)
    await db.flush()
    logger.info("Stored %d depth chart starters", len(rows))
    return len(rows)
