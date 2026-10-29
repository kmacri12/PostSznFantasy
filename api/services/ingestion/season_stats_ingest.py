import logging
from typing import Any

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from api.core.config import get_settings
from api.db.models.nfl import NFLPlayer, NFLPlayerSeasonStats, NFLTeam
from api.services.ingestion.schemas import safe_int
from api.utils.rapidapi.rapidapi import RapidApiClient, get_rapidapi_client

logger = logging.getLogger(__name__)

CHUNK_SIZE = 500


def parse_player_season_stats(
    raw_player: dict[str, Any], season: str
) -> dict[str, Any] | None:
    player_id = safe_int(raw_player.get("playerID"))
    if not player_id:
        return None

    s: dict[str, Any] = raw_player.get("stats", {}) or {}
    fg_yards: list[int] = []

    return {
        "season": season,
        "player_id": player_id,
        "passing_completions": safe_int(s.get("PassingComp")),
        "passing_attempts": safe_int(s.get("PassingAtt")),
        "passing_yards": safe_int(s.get("PassingYds")),
        "passing_touchdowns": safe_int(s.get("PassingTD")),
        "passing_interceptions": safe_int(s.get("PassingInts")),
        "passing_sacked": safe_int(s.get("PassingSacked")),
        "passing_sacked_yards": safe_int(s.get("PassingSackedYds")),
        "passing_two_point_conversions": safe_int(s.get("Passing2PtConv")),
        "rushing_carries": safe_int(s.get("RushingAtt")),
        "rushing_yards": safe_int(s.get("RushingYds")),
        "rushing_touchdowns": safe_int(s.get("RushingTD")),
        "rushing_long_rush": safe_int(s.get("RushingLong")),
        "rushing_two_point_conversions": safe_int(s.get("Rushing2PtConv")),
        "receiving_receptions": safe_int(s.get("Receptions")),
        "receiving_targets": safe_int(s.get("Targets")),
        "receiving_yards": safe_int(s.get("ReceivingYds")),
        "receiving_touchdowns": safe_int(s.get("ReceivingTD")),
        "receiving_long_reception": safe_int(s.get("ReceivingLong")),
        "receiving_two_point_conversions": safe_int(s.get("Receiving2PtConv")),
        "carrying_fumbles": safe_int(s.get("Fumbles")),
        "carrying_fumbles_lost": safe_int(s.get("FumblesLost")),
        "punt_return_yards": safe_int(s.get("PuntReturnYds")),
        "punt_return_td": safe_int(s.get("PuntReturnTD")),
        "kick_return_yards": safe_int(s.get("KickReturnYds")),
        "kick_return_td": safe_int(s.get("KickReturnTD")),
        "kicking_xp_made": safe_int(s.get("XPMade")),
        "kicking_xp_missed": safe_int(s.get("XPMissed")),
        "kicking_fg_missed": safe_int(s.get("FGMissed")),
        "kicking_fg_yards_made": fg_yards,
        "dst_yards_allowed": safe_int(s.get("DSTYdsAllowed")),
        "dst_points_allowed": safe_int(s.get("DSTPtsAllowed")),
        "dst_sacks": safe_int(s.get("DSTSacks")),
        "dst_def_td": safe_int(s.get("DSTDefTD")),
        "dst_safeties": safe_int(s.get("DSTSafeties")),
        "dst_fumbles_recovered": safe_int(s.get("DSTFumblesRecovered")),
        "dst_interceptions": safe_int(s.get("DSTInterceptions")),
    }


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

    for team in teams:
        if not team.team_abv:
            continue

        if team_rosters is not None and team.team_abv in team_rosters:
            roster = team_rosters[team.team_abv]
        else:
            roster = await client.get_stats_for_team(str(team.id), team.team_abv)

        for raw_player in roster:
            parsed = parse_player_season_stats(raw_player, season)
            if parsed and parsed["player_id"] in valid_player_ids:
                stat_rows.append(parsed)

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
