import logging
from typing import Any

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from api.core.config import get_settings
from api.db.models.nfl import (
    NFLGame,
    NFLPlayer,
    NFLPlayerGameStats,
    NFLPlayerSeasonStats,
    NFLTeam,
)
from api.services.ingestion.box_scores_ingest import (
    GAME_COMPLETED,
    normalise_game_status,
    parse_game_player_stats,
)
from api.services.ingestion.guard import IngestionKind, guarded
from api.services.ingestion.schemas import safe_int, safe_str
from api.utils.rapidapi.rapidapi import RapidApiClient, get_rapidapi_client

logger = logging.getLogger(__name__)

REGULAR_SEASON = "reg"


def _kicked(row: dict[str, Any]) -> bool:
    return bool(
        row["kicking_fg_made"]
        or row["kicking_fg_missed"]
        or row["kicking_xp_made"]
        or row["kicking_xp_missed"]
    )


@guarded(IngestionKind.KICKER_DISTANCES)
async def ingest_kicker_distances(
    db: AsyncSession,
    season: str | None = None,
    client: RapidApiClient | None = None,
) -> int:
    """Give every kicker's season row the distance of each field goal.

    Tank01's season stats carry only a made count (`fgYds` is always 0), so under a
    per-yard scoring rule a kicker scored nothing for his field goals. Distances exist
    only in a box score's scoring plays and play-by-play, so each completed regular-season
    game is fetched once (the game row is the "done" marker) and its kickers' lines are
    kept; the season row is then rebuilt from those lines. Returns the games fetched.
    """
    season = season or str(get_settings().season_year)
    client = client or get_rapidapi_client()

    listed = [
        game
        for game in await client.get_nfl_games_list(season, REGULAR_SEASON, "all")
        if normalise_game_status(game.get("gameStatus")) == GAME_COMPLETED
        and safe_str(game.get("gameID"))
    ]
    done = set(
        (
            await db.execute(
                select(NFLGame.id).where(
                    NFLGame.season == int(season),
                    NFLGame.season_type == REGULAR_SEASON,
                )
            )
        )
        .scalars()
        .all()
    )
    valid_team_ids = set((await db.execute(select(NFLTeam.id))).scalars().all())
    valid_player_ids = set((await db.execute(select(NFLPlayer.id))).scalars().all())

    fetched = 0
    for summary in listed:
        game_id = str(summary["gameID"])
        if game_id in done:
            continue
        box = await client.get_nfl_box_score(game_id)
        if not box:
            continue
        home_id = safe_int(box.get("teamIDHome"))
        away_id = safe_int(box.get("teamIDAway"))
        await db.execute(
            insert(NFLGame)
            .values(
                id=game_id,
                game_status=GAME_COMPLETED,
                season=int(season),
                season_type=REGULAR_SEASON,
                team_id_home=home_id if home_id in valid_team_ids else None,
                team_id_away=away_id if away_id in valid_team_ids else None,
            )
            .on_conflict_do_nothing(index_elements=["id"])
        )
        kicker_rows = [
            row
            for row in parse_game_player_stats(game_id, box, valid_player_ids)
            if _kicked(row)
        ]
        if kicker_rows:
            stmt = insert(NFLPlayerGameStats).values(kicker_rows)
            await db.execute(
                stmt.on_conflict_do_update(
                    index_elements=["game_id", "player_id"],
                    set_={
                        key: stmt.excluded[key]
                        for key in kicker_rows[0]
                        if key not in ("game_id", "player_id")
                    },
                )
            )
        fetched += 1

    await _rebuild_season_distances(db, int(season))
    logger.info("Fetched %d regular-season box scores for kicker distances", fetched)
    return fetched


async def _rebuild_season_distances(db: AsyncSession, season: int) -> None:
    lines = (
        await db.execute(
            select(
                NFLPlayerGameStats.player_id,
                NFLPlayerGameStats.kicking_fg_yards_made,
            )
            .join(NFLGame, NFLGame.id == NFLPlayerGameStats.game_id)
            .where(NFLGame.season == season, NFLGame.season_type == REGULAR_SEASON)
        )
    ).all()
    made: dict[int, list[int]] = {}
    for player_id, made_yards in lines:
        made.setdefault(player_id, []).extend(made_yards or [])
    season_rows = (
        (
            await db.execute(
                select(NFLPlayerSeasonStats).where(
                    NFLPlayerSeasonStats.season == str(season),
                    NFLPlayerSeasonStats.player_id.in_(made),
                )
            )
        )
        .scalars()
        .all()
    )
    for row in season_rows:
        row.kicking_fg_yards_made = made[row.player_id]
