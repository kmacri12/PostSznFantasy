import logging
from typing import Any

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from api.core.config import get_settings
from api.db.models.nfl import NFLPlayer, NFLPlayerSeasonStats, NFLTeam
from api.services.ingestion.guard import IngestionKind, guarded
from api.services.ingestion.schemas import (
    StatsShapeError,
    empty_stat_line,
    parse_stat_line,
    safe_int,
)
from api.utils.rapidapi.rapidapi import RapidApiClient, get_rapidapi_client

logger = logging.getLogger(__name__)

CHUNK_SIZE = 500


def parse_player_season_stats(
    raw_player: dict[str, Any], season: str
) -> dict[str, Any] | None:
    player_id = safe_int(raw_player.get("playerID"))
    if not player_id:
        return None

    line = parse_stat_line(raw_player.get("stats")) or empty_stat_line()
    return {"season": season, "player_id": player_id, **line}


def ensure_stats_shape(players: list[dict[str, Any]]) -> None:
    """Raise if players carry stats but none are recognisable.

    This is the guard that would have caught the flat-keys parser silently writing zeros.
    """
    with_stats = [p for p in players if p.get("stats")]
    if with_stats and not any(parse_stat_line(p["stats"]) for p in with_stats):
        raise StatsShapeError(
            f"{len(with_stats)} roster players have stats but none match the "
            "expected nested shape (see docs/rapidapi-tank01.md)"
        )


@guarded(IngestionKind.SEASON_STATS)
async def ingest_season_stats(
    db: AsyncSession,
    season: str | None = None,
    client: RapidApiClient | None = None,
    team_rosters: dict[str, list[dict[str, Any]]] | None = None,
) -> int:
    """Fetch and bulk upsert season stats for all active teams."""
    season = season or str(get_settings().season_year)
    client = client or get_rapidapi_client()

    # Query active teams
    teams = (
        (await db.execute(select(NFLTeam).where(NFLTeam.is_active.is_(True))))
        .scalars()
        .all()
    )

    # Valid players to ensure FK integrity
    valid_player_ids = set((await db.execute(select(NFLPlayer.id))).scalars().all())

    stat_rows: list[dict[str, Any]] = []
    fetched_players: list[dict[str, Any]] = []

    for team in teams:
        if not team.team_abv:
            continue

        if team_rosters is not None and team.team_abv in team_rosters:
            roster = team_rosters[team.team_abv]
        else:
            roster = await client.get_stats_for_team(str(team.id), team.team_abv)

        fetched_players.extend(roster)
        for raw_player in roster:
            parsed = parse_player_season_stats(raw_player, season)
            if parsed and parsed["player_id"] in valid_player_ids:
                stat_rows.append(parsed)

    ensure_stats_shape(fetched_players)

    if not stat_rows:
        logger.warning("No season stats parsed to ingest.")
        return 0

    total_upserted = 0
    for i in range(0, len(stat_rows), CHUNK_SIZE):
        chunk = stat_rows[i : i + CHUNK_SIZE]
        stmt = insert(NFLPlayerSeasonStats).values(chunk)
        upsert_stmt = stmt.on_conflict_do_update(
            index_elements=["season", "player_id"],
            set_={
                k: stmt.excluded[k]
                for k in chunk[0].keys()
                if k not in ("season", "player_id")
            },
        )
        await db.execute(upsert_stmt)
        total_upserted += len(chunk)

    logger.info("Bulk upserted %d season stat rows (season=%s)", total_upserted, season)
    return total_upserted
