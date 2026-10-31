import logging
from typing import Any

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models.nfl import NFLPlayer, NFLTeam
from api.services.ingestion.guard import IngestionKind, guarded
from api.services.ingestion.schemas import (
    normalise_position,
    parse_injury_status,
    safe_int,
    safe_str,
)
from api.utils.rapidapi.rapidapi import RapidApiClient, get_rapidapi_client

logger = logging.getLogger(__name__)

CHUNK_SIZE = 500


@guarded(IngestionKind.PLAYERS)
async def ingest_nfl_players(
    db: AsyncSession,
    client: RapidApiClient | None = None,
    raw_data: list[dict[str, Any]] | None = None,
) -> int:
    """Fetch and bulk upsert active NFL players in chunked batches."""
    if raw_data is None:
        client = client or get_rapidapi_client()
        raw_data = await client.get_nfl_players()

    # Get valid team IDs to ensure FK constraint holds
    team_ids_res = await db.execute(select(NFLTeam.id))
    valid_team_ids = set(team_ids_res.scalars().all())

    player_rows: list[dict[str, Any]] = []
    for raw in raw_data:
        player_id = safe_int(raw.get("playerID"))
        if not player_id:
            continue

        raw_team_id = safe_int(raw.get("teamID"))
        team_id = raw_team_id if raw_team_id in valid_team_ids else None

        player_rows.append(
            {
                "id": player_id,
                "name": safe_str(raw.get("longName")),
                "position": normalise_position(raw.get("pos")),
                "espn_headshot_url": safe_str(raw.get("espnHeadshot")),
                "jersey_num": safe_str(raw.get("jerseyNum")),
                "birthday": safe_str(raw.get("bDay")),
                "height": safe_str(raw.get("height")),
                "weight": safe_str(raw.get("weight")),
                "exp": safe_str(raw.get("exp")),
                "injury_status": parse_injury_status(raw.get("injury")),
                "team_id": team_id,
            }
        )

    if not player_rows:
        logger.warning("No players found to ingest.")
        return 0

    total_upserted = 0
    for i in range(0, len(player_rows), CHUNK_SIZE):
        chunk = player_rows[i : i + CHUNK_SIZE]
        stmt = insert(NFLPlayer).values(chunk)
        upsert_stmt = stmt.on_conflict_do_update(
            index_elements=["id"],
            set_={
                "name": stmt.excluded.name,
                "position": stmt.excluded.position,
                "espn_headshot_url": stmt.excluded.espn_headshot_url,
                "jersey_num": stmt.excluded.jersey_num,
                "birthday": stmt.excluded.birthday,
                "height": stmt.excluded.height,
                "weight": stmt.excluded.weight,
                "exp": stmt.excluded.exp,
                "injury_status": stmt.excluded.injury_status,
                "team_id": stmt.excluded.team_id,
            },
        )
        await db.execute(upsert_stmt)
        total_upserted += len(chunk)

    logger.info("Bulk upserted %d NFL players across chunks", total_upserted)
    return total_upserted
