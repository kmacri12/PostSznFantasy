import logging
from typing import Any

from api.db.models.nfl import NFLGame, NFLPlayer, NFLPlayerGameStats, NFLTeam
from api.services.ingestion.schemas import safe_int, safe_str
from api.utils.rapidapi.rapidapi import RapidApiClient
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

CHUNK_SIZE = 500


def parse_game_player_stats(
    game_id: str,
    player_stats_json: dict[str, Any],
    valid_player_ids: set[int],
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for pid_str, s in player_stats_json.items():
        player_id = safe_int(pid_str)
        if (
            not player_id
            or not isinstance(s, dict)
            or player_id not in valid_player_ids
        ):
            continue

        fg_raw = s.get("FGYardsMade", [])
        fg_yards: list[int] = (
            [safe_int(y) for y in fg_raw] if isinstance(fg_raw, list) else []
        )

        rows.append(
            {
                "game_id": game_id,
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
        )
    return rows


async def ingest_box_scores(
    db: AsyncSession,
    season: str,
    season_type: str = "post",
    week: str = "all",
    client: RapidApiClient | None = None,
    mock_games: list[dict[str, Any]] | None = None,
    mock_box_scores: dict[str, dict[str, Any]] | None = None,
) -> int:
    """Fetch playoff games and box scores, bulk upserting games and player game stats."""
    client = client or RapidApiClient()

    if mock_games is not None:
        games = mock_games
    else:
        games = await client.get_nfl_games_list(season, season_type, week)

    if not games:
        logger.info(
            "No games found for season=%s, type=%s, week=%s", season, season_type, week
        )
        return 0

    valid_team_ids = set((await db.execute(select(NFLTeam.id))).scalars().all())
    valid_player_ids = set((await db.execute(select(NFLPlayer.id))).scalars().all())

    game_rows: list[dict[str, Any]] = []
    all_player_game_stat_rows: list[dict[str, Any]] = []

    for game_summary in games:
        game_id = safe_str(game_summary.get("gameID"))
        if not game_id:
            continue

        if mock_box_scores is not None and game_id in mock_box_scores:
            box = mock_box_scores[game_id]
        else:
            box = await client.get_nfl_box_score(game_id)

        if not box:
            continue

        home_id = safe_int(box.get("teamIDHome"))
        away_id = safe_int(box.get("teamIDAway"))

        game_rows.append(
            {
                "id": game_id,
                "game_status": safe_str(box.get("gameStatus")),
                "game_date": safe_str(box.get("gameDate")),
                "game_time_epoch": safe_str(box.get("gameTimeEpoch")),
                "game_week": safe_int(game_summary.get("gameWeek")) or None,
                "season": safe_int(season) or None,
                "espn_link": safe_str(box.get("espnLink")),
                "team_id_home": home_id if home_id in valid_team_ids else None,
                "team_id_away": away_id if away_id in valid_team_ids else None,
                "home_pts": safe_int(box.get("homePts")) or None,
                "away_pts": safe_int(box.get("awayPts")) or None,
                "season_type": season_type,
                "team_stats": box.get("teamStats"),
                "scoring_plays": box.get("scoringPlays"),
                "line_score": box.get("lineScore"),
                "player_stats": box.get("playerStats"),
                "dst": box.get("DST"),
                "game_clock": safe_str(box.get("gameClock")),
            }
        )

        player_stats_raw = box.get("playerStats")
        if isinstance(player_stats_raw, dict):
            p_rows = parse_game_player_stats(
                game_id, player_stats_raw, valid_player_ids
            )
            all_player_game_stat_rows.extend(p_rows)

    if game_rows:
        for i in range(0, len(game_rows), CHUNK_SIZE):
            chunk = game_rows[i : i + CHUNK_SIZE]
            stmt = insert(NFLGame).values(chunk)
            upsert_stmt = stmt.on_conflict_do_update(
                index_elements=["id"],
                set_={k: stmt.excluded[k] for k in chunk[0].keys() if k != "id"},
            )
            await db.execute(upsert_stmt)

    if all_player_game_stat_rows:
        for i in range(0, len(all_player_game_stat_rows), CHUNK_SIZE):
            chunk = all_player_game_stat_rows[i : i + CHUNK_SIZE]
            stmt = insert(NFLPlayerGameStats).values(chunk)
            upsert_stmt = stmt.on_conflict_do_update(
                index_elements=["game_id", "player_id"],
                set_={
                    k: stmt.excluded[k]
                    for k in chunk[0].keys()
                    if k not in ("game_id", "player_id")
                },
            )
            await db.execute(upsert_stmt)

    logger.info(
        "Ingested %d games and %d player box score rows",
        len(game_rows),
        len(all_player_game_stat_rows),
    )
    return len(game_rows)
