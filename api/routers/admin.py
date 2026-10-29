from typing import Any

from fastapi import APIRouter, Depends

from api.dependencies.auth import require_admin
from api.dependencies.db import DbSession
from api.models.base import BaseSchema
from api.services.ingestion import (
    ingest_box_scores,
    ingest_nfl_players,
    ingest_nfl_teams,
    ingest_season_stats,
    run_full_ingestion_pipeline,
)
from api.utils.db.update import mark_eliminated_teams

router = APIRouter(dependencies=[Depends(require_admin)])


@router.get("/")
async def health() -> dict[str, str]:
    return {"status": "healthy"}


class BoxScoreRequest(BaseSchema):
    season: str
    season_type: str
    week: str = "all"


class EliminateTeamsRequest(BaseSchema):
    team_ids: list[int]


class UpdateAllRequest(BaseSchema):
    season: str | None = None
    with_stats: bool = True
    with_box_scores: bool = False


class IngestStatsSummary(BaseSchema):
    teams: int = 0
    players: int = 0
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
    return {"status": "ok"}


@router.post("/update/eliminate_teams")
async def eliminate_teams(
    body: EliminateTeamsRequest,
    db: DbSession,
) -> dict[str, str]:
    await mark_eliminated_teams(db, body.team_ids)
    return {"status": "ok"}
