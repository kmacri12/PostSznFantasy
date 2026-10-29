import logging
from typing import Any

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models.nfl import NFLGame, NFLPlayer, NFLPlayerGameStats, NFLTeam
from api.services.ingestion.guard import IngestionKind, guarded
from api.services.ingestion.schemas import (
    POSTSEASON_WEEKS,
    field_goal_yards_by_kicker,
    parse_stat_line,
    safe_int,
    safe_str,
)
from api.utils.rapidapi.rapidapi import RapidApiClient, get_rapidapi_client

logger = logging.getLogger(__name__)

CHUNK_SIZE = 500


# The games list says "Final", box scores say "Completed"; consumers expect the latter.
GAME_COMPLETED = "Completed"
_COMPLETED_STATUSES = {"Final", "Completed"}


def normalise_game_status(raw: Any) -> str | None:
    status = safe_str(raw)
    return GAME_COMPLETED if status in _COMPLETED_STATUSES else status


def parse_game_player_stats(
    game_id: str,
    box: dict[str, Any],
    valid_player_ids: set[int],
) -> list[dict[str, Any]]:
    field_goals = field_goal_yards_by_kicker(box.get("scoringPlays"))
    rows: list[dict[str, Any]] = []
    for pid_str, raw_stats in (box.get("playerStats") or {}).items():
        player_id = safe_int(pid_str)
        if not player_id or player_id not in valid_player_ids:
            continue
        line = parse_stat_line(raw_stats)
        if line is None:  # snap-count-only entries, e.g. linemen
            continue
        rows.append(
            {
                "game_id": game_id,
                "player_id": player_id,
                **line,
                "kicking_fg_yards_made": field_goals.get(player_id, []),
            }
        )
    return rows


def _points(val: Any) -> int | None:
    return None if val is None or val == "" else safe_int(val)


@guarded(IngestionKind.BOX_SCORES)
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
    client = client or get_rapidapi_client()

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
                "game_status": normalise_game_status(
                    box.get("gameStatus") or game_summary.get("gameStatus")
                ),
                "game_date": safe_str(box.get("gameDate")),
                # Only the games list carries these two.
                "game_time_epoch": safe_str(game_summary.get("gameTime_epoch")),
                "game_week": POSTSEASON_WEEKS.get(safe_str(box.get("gameWeek")) or ""),
                "season": safe_int(season) or None,
                "espn_link": safe_str(game_summary.get("espnLink")),
                "team_id_home": home_id if home_id in valid_team_ids else None,
                "team_id_away": away_id if away_id in valid_team_ids else None,
                "home_pts": _points(box.get("homePts")),
                "away_pts": _points(box.get("awayPts")),
                "season_type": season_type,
                "team_stats": box.get("teamStats"),
                "scoring_plays": box.get("scoringPlays"),
                "line_score": box.get("lineScore"),
                "player_stats": box.get("playerStats"),
                # Per-team defensive totals; no per-player dst_* stats exist upstream.
                "dst": box.get("DST"),
                "game_clock": safe_str(box.get("gameClock")),
            }
        )

        all_player_game_stat_rows.extend(
            parse_game_player_stats(game_id, box, valid_player_ids)
        )

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
