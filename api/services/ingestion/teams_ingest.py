import logging
from typing import Any

from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models.nfl import NFLPlayer, NFLTeam
from api.services.ingestion.dst_stats import dst_player_id
from api.services.ingestion.guard import IngestionKind, guarded
from api.services.ingestion.schemas import safe_int, safe_str
from api.utils.rapidapi.rapidapi import RapidApiClient, get_rapidapi_client

logger = logging.getLogger(__name__)


@guarded(IngestionKind.TEAMS)
async def ingest_nfl_teams(
    db: AsyncSession,
    client: RapidApiClient | None = None,
    raw_data: list[dict[str, Any]] | None = None,
) -> int:
    """Fetch and bulk upsert NFL teams into nfl_teams in a single operation."""
    if raw_data is None:
        client = client or get_rapidapi_client()
        raw_data = await client.get_nfl_teams()

    team_rows: list[dict[str, Any]] = []
    for raw in raw_data:
        team_id = safe_int(raw.get("teamID"))
        if not team_id:
            continue
        team_rows.append(
            {
                "id": team_id,
                "team_abv": safe_str(raw.get("teamAbv")),
                "team_city": safe_str(raw.get("teamCity")),
                "team_name": safe_str(raw.get("teamName")),
                "team_logo_url": safe_str(raw.get("teamLogoUrl")),
                "is_active": True,
            }
        )

    if not team_rows:
        logger.warning("No teams found to ingest.")
        return 0

    stmt = insert(NFLTeam).values(team_rows)
    upsert_stmt = stmt.on_conflict_do_update(
        index_elements=["id"],
        set_={
            "team_abv": stmt.excluded.team_abv,
            "team_city": stmt.excluded.team_city,
            "team_name": stmt.excluded.team_name,
            "team_logo_url": stmt.excluded.team_logo_url,
        },
    )
    await db.execute(upsert_stmt)
    await _upsert_dst_players(db, team_rows)
    logger.info("Bulk upserted %d NFL teams", len(team_rows))
    return len(team_rows)


async def _upsert_dst_players(
    db: AsyncSession, team_rows: list[dict[str, Any]]
) -> None:
    """One draftable DST per NFL team, so defenses are players like any other."""
    dst_rows = [
        {
            "id": dst_player_id(team["id"]),
            "name": f"{team['team_city'] or ''} {team['team_name'] or ''}".strip()
            or team["team_abv"],
            "position": "DST",
            "team_id": team["id"],
        }
        for team in team_rows
    ]
    stmt = insert(NFLPlayer).values(dst_rows)
    await db.execute(
        stmt.on_conflict_do_update(
            index_elements=["id"],
            set_={
                "name": stmt.excluded.name,
                "position": stmt.excluded.position,
                "team_id": stmt.excluded.team_id,
            },
        )
    )
