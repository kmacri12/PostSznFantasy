from fastapi import APIRouter
from pydantic import BaseModel

from api.dependencies.auth import CurrentUser
from api.dependencies.db import DbSession
from api.utils.db.update import (
    mark_eliminated_teams,
    sync_game_box_scores,
    sync_nfl_players,
    sync_nfl_players_and_stats,
    sync_nfl_teams,
)

router = APIRouter()


@router.get("/")
async def health() -> dict[str, str]:
    return {"status": "healthy"}


class BoxScoreRequest(BaseModel):
    season: str
    season_type: str
    week: str = "all"


class EliminateTeamsRequest(BaseModel):
    team_ids: list[int]


@router.post("/update/nfl_teams")
async def update_nfl_teams(
    _: CurrentUser,
    db: DbSession,
) -> dict[str, str]:
    await sync_nfl_teams(db)
    await db.commit()
    return {"status": "ok"}


@router.post("/update/nfl_players")
async def update_nfl_players(
    _: CurrentUser,
    db: DbSession,
) -> dict[str, str]:
    await sync_nfl_players(db)
    await db.commit()
    return {"status": "ok"}


@router.post("/update/nfl_players_and_stats")
async def update_nfl_players_and_stats(
    _: CurrentUser,
    db: DbSession,
) -> dict[str, str]:
    await sync_nfl_players_and_stats(db)
    await db.commit()
    return {"status": "ok"}


@router.post("/update/box_scores")
async def update_box_scores(
    body: BoxScoreRequest,
    _: CurrentUser,
    db: DbSession,
) -> dict[str, str]:
    await sync_game_box_scores(db, body.season, body.season_type, body.week)
    await db.commit()
    return {"status": "ok"}


@router.post("/update/eliminate_teams")
async def eliminate_teams(
    body: EliminateTeamsRequest,
    _: CurrentUser,
    db: DbSession,
) -> dict[str, str]:
    await mark_eliminated_teams(db, body.team_ids)
    await db.commit()
    return {"status": "ok"}
