from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from api.core.config import get_settings
from api.db.models.nfl import NFLGame
from api.db.session import DbSession
from api.dependencies.auth import require_admin
from api.models.base import BaseSchema
from api.services.eliminations import mark_eliminated_teams
from api.services.ingestion import (
    ingest_box_scores,
    ingest_nfl_players,
    ingest_nfl_teams,
    ingest_season_stats,
    run_full_ingestion_pipeline,
)
from api.services.playoff_field import PlayoffFieldError, set_playoff_field
from api.services.scheduler import (
    GAME_COMPLETED,
    eliminate_losing_teams,
    run_poll_cycle,
)
from api.services.standings import recompute_standings

router = APIRouter(dependencies=[Depends(require_admin)])


class BoxScoreRequest(BaseSchema):
    season: str
    season_type: str
    week: str = "all"


class EliminateTeamsRequest(BaseSchema):
    team_ids: list[int]


class PlayoffFieldRequest(BaseSchema):
    team_ids: list[int]


class UpdateAllRequest(BaseSchema):
    season: str | None = None
    with_stats: bool = True
    with_box_scores: bool = False


class IngestStatsSummary(BaseSchema):
    teams: int = 0
    players: int = 0
    depth_charts: int = 0
    stats: int = 0
    games: int = 0


class IngestAllResponse(BaseSchema):
    status: str
    duration_ms: int
    synced: IngestStatsSummary


@router.post("/update/all", response_model=IngestAllResponse)
async def update_all(
    db: DbSession,
    body: UpdateAllRequest | None = None,
) -> dict[str, Any]:
    """Trigger complete on-demand NFL data ingestion pipeline."""
    season = body.season if body else None
    with_stats = body.with_stats if body else True
    with_box_scores = body.with_box_scores if body else False

    result = await run_full_ingestion_pipeline(
        db,
        season=season,
        with_stats=with_stats,
        with_box_scores=with_box_scores,
    )
    if with_box_scores:
        await recompute_standings(db, get_settings().season_year)
    return result


@router.post("/update/nfl_teams")
async def update_nfl_teams(
    db: DbSession,
) -> dict[str, str]:
    await ingest_nfl_teams(db)
    return {"status": "ok"}


@router.post("/update/nfl_players")
async def update_nfl_players(
    db: DbSession,
) -> dict[str, str]:
    await ingest_nfl_players(db)
    return {"status": "ok"}


@router.post("/update/nfl_players_and_stats")
async def update_nfl_players_and_stats(
    db: DbSession,
) -> dict[str, str]:
    await ingest_season_stats(db)
    return {"status": "ok"}


@router.post("/update/box_scores")
async def update_box_scores(
    body: BoxScoreRequest,
    db: DbSession,
) -> dict[str, str]:
    await ingest_box_scores(db, body.season, body.season_type, body.week)
    await recompute_standings(db, get_settings().season_year)
    return {"status": "ok"}


@router.post("/update/eliminate_teams")
async def eliminate_teams(
    body: EliminateTeamsRequest,
    db: DbSession,
) -> dict[str, str]:
    await mark_eliminated_teams(db, body.team_ids)
    await recompute_standings(db, get_settings().season_year)
    return {"status": "ok"}


@router.put("/playoff-field")
async def set_playoff_field_route(
    body: PlayoffFieldRequest, db: DbSession
) -> dict[str, int]:
    """Replace the playoff field (the draft pool); drafts need exactly 14 teams."""
    try:
        await set_playoff_field(db, body.team_ids)
    except PlayoffFieldError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return {"teams": len(set(body.team_ids))}


class RefreshResponse(BaseSchema):
    polled: int


@router.post("/refresh/live", response_model=RefreshResponse)
async def refresh_live(db: DbSession) -> dict[str, int]:
    """Run one live-poll cycle now ("Refresh now"); spends one call per live game."""
    return {"polled": await run_poll_cycle(db, get_settings().season_year)}


class GameResultRequest(BaseSchema):
    season: int
    team_id_home: int
    team_id_away: int
    home_pts: int
    away_pts: int


@router.put("/games/{game_id}/result")
async def set_game_result(
    game_id: str, body: GameResultRequest, db: DbSession
) -> dict[str, str]:
    """Enter or correct a final score by hand when the API fails, then recompute
    eliminations and standings (a corrected result reinstates a team it wrongly cut). A later
    reconcile fetch overwrites this with upstream data once the API recovers."""
    game = await db.get(NFLGame, game_id)
    if game is None:
        game = NFLGame(id=game_id, season_type="post")
        db.add(game)
    game.season = body.season
    game.team_id_home = body.team_id_home
    game.team_id_away = body.team_id_away
    game.home_pts = body.home_pts
    game.away_pts = body.away_pts
    game.game_status = GAME_COMPLETED
    await db.flush()
    await eliminate_losing_teams(db, body.season, reinstate_winners=True)
    await recompute_standings(db, body.season)
    await db.commit()
    return {"status": "ok"}
