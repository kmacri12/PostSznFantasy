import logging
from collections import defaultdict

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.core.config import get_settings
from api.db.models.nfl import NFLPlayer, NFLPlayerSeasonStats, NFLTeam
from api.services.ingestion.box_scores_ingest import (
    GAME_COMPLETED,
    normalise_game_status,
)
from api.services.ingestion.dst_stats import (
    DST_STAT_COLUMNS,
    dst_player_id,
    parse_dst_stat_rows,
)
from api.services.ingestion.guard import IngestionKind, guarded
from api.services.ingestion.schemas import safe_str
from api.utils.rapidapi.rapidapi import RapidApiClient, get_rapidapi_client

logger = logging.getLogger(__name__)

REGULAR_SEASON = "reg"
# The season table has no columns for blocked kicks or 2-point returns.
SEASON_COLUMNS = tuple(
    column for column in DST_STAT_COLUMNS if hasattr(NFLPlayerSeasonStats, column)
)


def _completed_game_ids(
    games: list[dict[str, object]], abbreviations: set[str]
) -> list[str]:
    """Completed regular-season games (`20251109_LAR@SEA`) that involve one of the teams."""
    game_ids = []
    for game in games:
        game_id = safe_str(game.get("gameID"))
        if (
            not game_id
            or normalise_game_status(game.get("gameStatus")) != GAME_COMPLETED
        ):
            continue
        _, _, matchup = game_id.partition("_")
        if abbreviations.intersection(matchup.split("@")):
            game_ids.append(game_id)
    return game_ids


@guarded(IngestionKind.DST_SEASON_STATS)
async def ingest_dst_season_stats(
    db: AsyncSession,
    season: str | None = None,
    client: RapidApiClient | None = None,
) -> int:
    """Give each playoff-field DST a regular-season row, summed from its box scores.

    Tank01's roster stats cover real players only, so a synthetic DST had no season
    line. The regular season is final by the time a field exists, so a team that
    already has a row is skipped: a re-run costs nothing. Only teams in
    `nfl_teams.in_playoffs` are read (the draft pool), one box score per game, so
    nothing runs before the field is set. Returns the Tank01 calls made.
    """
    season = season or str(get_settings().season_year)
    client = client or get_rapidapi_client()

    teams = (
        await db.execute(
            select(NFLTeam.id, NFLTeam.team_abv)
            .join(NFLPlayer, NFLPlayer.id == -NFLTeam.id)
            .outerjoin(
                NFLPlayerSeasonStats,
                (NFLPlayerSeasonStats.player_id == NFLPlayer.id)
                & (NFLPlayerSeasonStats.season == season),
            )
            .where(NFLTeam.in_playoffs, NFLPlayerSeasonStats.player_id.is_(None))
        )
    ).all()
    if not teams:
        return 0
    pending_ids = {team_id for team_id, _ in teams}

    games = await client.get_nfl_games_list(season, REGULAR_SEASON, "all")
    game_ids = _completed_game_ids(games, {abv for _, abv in teams if abv})
    calls = 1
    valid_player_ids = {dst_player_id(team_id) for team_id in pending_ids}
    totals: dict[int, dict[str, int]] = defaultdict(
        lambda: dict.fromkeys(SEASON_COLUMNS, 0)
    )
    for game_id in game_ids:
        box = await client.get_nfl_box_score(game_id)
        calls += 1
        for row in parse_dst_stat_rows(game_id, box, valid_player_ids):
            for column in SEASON_COLUMNS:
                totals[row["player_id"]][column] += row[column]

    db.add_all(
        NFLPlayerSeasonStats(season=season, player_id=player_id, **columns)
        for player_id, columns in totals.items()
    )
    await db.flush()
    logger.info("Read %d DST season lines in %d calls", len(totals), calls)
    return calls


async def refresh_dst_season_stats(
    db: AsyncSession,
    season: str | None = None,
    client: RapidApiClient | None = None,
) -> int:
    """`ingest_dst_season_stats` that can never undo the season stats it follows."""
    try:
        async with db.begin_nested():
            return await ingest_dst_season_stats(db, season, client)
    except Exception:
        logger.exception("DST season sync failed; defenses keep their stats")
        return 0
