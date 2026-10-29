import logging
import time
from typing import Any

from api.core.config import get_settings
from api.services.ingestion.box_scores_ingest import ingest_box_scores
from api.services.ingestion.players_ingest import ingest_nfl_players
from api.services.ingestion.season_stats_ingest import ingest_season_stats
from api.services.ingestion.teams_ingest import ingest_nfl_teams
from api.utils.rapidapi.rapidapi import RapidApiClient, get_rapidapi_client
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


async def run_full_ingestion_pipeline(
    db: AsyncSession,
    season: str | None = None,
    with_stats: bool = True,
    with_box_scores: bool = False,
    client: RapidApiClient | None = None,
) -> dict[str, Any]:
    """Run the complete ingestion pipeline: teams -> players -> season stats -> (optional) box scores."""
    start_time = time.monotonic()
    season = season or str(get_settings().season_year)
    client = client or get_rapidapi_client()

    logger.info("Starting ingestion pipeline for season %s", season)

    teams_count = await ingest_nfl_teams(db, client=client)
    players_count = await ingest_nfl_players(db, client=client)
    stats_count = 0
    if with_stats:
        stats_count = await ingest_season_stats(db, season=season, client=client)
    games_count = 0
    if with_box_scores:
        games_count = await ingest_box_scores(
            db, season=season, season_type="post", week="all", client=client
        )
    duration_ms = int((time.monotonic() - start_time) * 1000)
    summary = {
        "status": "success",
        "duration_ms": duration_ms,
        "synced": {
            "teams": teams_count,
            "players": players_count,
            "stats": stats_count,
            "games": games_count,
        },
    }
    logger.info("Ingestion pipeline completed in %d ms: %s", duration_ms, summary)
    return summary


__all__ = [
    "ingest_nfl_teams",
    "ingest_nfl_players",
    "ingest_season_stats",
    "ingest_box_scores",
    "run_full_ingestion_pipeline",
]
