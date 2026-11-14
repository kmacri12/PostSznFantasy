import logging
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.core.config import get_settings
from api.db.models.nfl import NFLPlayer, NFLPlayerSeasonStats, NFLTeam
from api.models.enums import PlayerPosition
from api.services.ingestion.box_scores_ingest import (
    GAME_COMPLETED,
    normalise_game_status,
)
from api.services.ingestion.guard import IngestionKind, guarded
from api.services.ingestion.schemas import (
    field_goal_yards_by_kicker,
    safe_str,
)
from api.utils.rapidapi.rapidapi import RapidApiClient, get_rapidapi_client

logger = logging.getLogger(__name__)

REGULAR_SEASON = "reg"
# A season is 17 games, 18 weeks, plus preseason and playoff games in the same response.
PLAYER_GAMES_REQUESTED = 30


def _team_game_ids(games: list[dict[str, Any]]) -> dict[str, list[str]]:
    """Completed regular-season game ids by team abbreviation (`20251109_LAR@SEA`)."""
    by_team: dict[str, list[str]] = {}
    for game in games:
        game_id = safe_str(game.get("gameID"))
        if (
            not game_id
            or normalise_game_status(game.get("gameStatus")) != GAME_COMPLETED
        ):
            continue
        _, _, matchup = game_id.partition("_")
        for abbreviation in matchup.split("@"):
            by_team.setdefault(abbreviation, []).append(game_id)
    return by_team


@guarded(IngestionKind.KICKER_DISTANCES)
async def ingest_kicker_distances(
    db: AsyncSession,
    season: str | None = None,
    client: RapidApiClient | None = None,
) -> int:
    """Give each playoff-field kicker's season row the distance of every field goal.

    Tank01's season stats carry only a made count (`fgYds` is always 0), so under a
    per-yard scoring rule a kicker scored nothing for his field goals. Distances exist
    only in `scoringPlays` text ("23 Yd Field Goal"). One `getNFLGamesForPlayer` call per
    kicker returns most of his games with that text, but it can leave games out, so a
    kicker whose distances still number fewer than his made FGs gets the box scores of
    his team's missing games, one at a time, until they add up. Only kickers on teams in
    `nfl_teams.in_playoffs` are read (the draft pool), so nothing runs before the field
    is set. Returns the Tank01 calls made.
    """
    season = season or str(get_settings().season_year)
    client = client or get_rapidapi_client()

    kickers = (
        await db.execute(
            select(NFLPlayerSeasonStats, NFLTeam.team_abv)
            .join(NFLPlayer, NFLPlayer.id == NFLPlayerSeasonStats.player_id)
            .join(NFLTeam, NFLTeam.id == NFLPlayer.team_id)
            .where(
                NFLPlayerSeasonStats.season == season,
                NFLPlayer.position == PlayerPosition.K,
                NFLTeam.in_playoffs,
                NFLPlayerSeasonStats.kicking_fg_made > 0,
            )
        )
    ).all()
    pending = [
        (row, abbreviation)
        for row, abbreviation in kickers
        if abbreviation and len(row.kicking_fg_yards_made) < row.kicking_fg_made
    ]
    if not pending:
        return 0

    regular_season = _team_game_ids(
        await client.get_nfl_games_list(season, REGULAR_SEASON, "all")
    )
    calls = 1
    box_score_yards: dict[str, dict[int, list[int]]] = {}

    for row, abbreviation in pending:
        team_games = regular_season.get(abbreviation, [])
        player_games = await client.get_nfl_games_for_player(
            row.player_id, season, PLAYER_GAMES_REQUESTED
        )
        calls += 1
        yards_by_game: dict[str, list[int]] = {}
        for game_id in team_games:
            entry = player_games.get(game_id)
            if entry is not None:
                yards_by_game[game_id] = field_goal_yards_by_kicker(
                    entry.get("scoringPlays")
                ).get(row.player_id, [])

        for game_id in team_games:
            if sum(map(len, yards_by_game.values())) >= row.kicking_fg_made:
                break
            if game_id in yards_by_game:
                continue
            if game_id not in box_score_yards:
                box = await client.get_nfl_box_score(game_id)
                calls += 1
                box_score_yards[game_id] = field_goal_yards_by_kicker(
                    box.get("scoringPlays")
                )
            yards_by_game[game_id] = box_score_yards[game_id].get(row.player_id, [])

        distances = [
            y for game_id in sorted(yards_by_game) for y in yards_by_game[game_id]
        ]
        if len(distances) != row.kicking_fg_made:
            logger.warning(
                "Kicker %d: %d field goal distances found for %d made",
                row.player_id,
                len(distances),
                row.kicking_fg_made,
            )
        row.kicking_fg_yards_made = distances

    logger.info(
        "Read field goal distances for %d kickers in %d calls", len(pending), calls
    )
    return calls
