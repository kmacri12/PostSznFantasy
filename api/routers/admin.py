import logging
from collections.abc import Awaitable, Callable
from typing import Annotated, Any

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request
from pydantic import Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.core.config import get_settings
from api.db.models.nfl import NFLGame, NFLTeam
from api.db.session import DbSession, get_session_factory
from api.dependencies.auth import require_admin
from api.models.base import BaseSchema
from api.services import feature_flags
from api.services.eliminations import mark_eliminated_teams
from api.services.ingestion import (
    ingest_box_scores,
    ingest_kicker_distances,
    ingest_nfl_players,
    ingest_nfl_teams,
    ingest_season_stats,
    run_full_ingestion_pipeline,
)
from api.services.ingestion.guard import IngestionBusy
from api.services.playoff_field import PlayoffFieldError, set_playoff_field
from api.services.scheduler import (
    GAME_COMPLETED,
    eliminate_losing_teams,
    run_poll_cycle,
)
from api.services.standings import recompute_standings

logger = logging.getLogger(__name__)

_BODY_SUMMARY_LIMIT = 500


async def record_admin_action(
    request: Request, admin_uid: Annotated[str, Depends(require_admin)]
) -> None:
    """Audit trail: who called which admin endpoint, with the (short) request body."""
    body = (await request.body()).decode("utf-8", errors="replace")
    logger.info(
        "Admin action",
        extra={
            "admin_uid": admin_uid,
            "method": request.method,
            "path": request.url.path,
            "query": request.url.query or None,
            "body": body[:_BODY_SUMMARY_LIMIT] or None,
        },
    )


router = APIRouter(dependencies=[Depends(record_admin_action)])

Wait = Annotated[
    bool,
    Query(
        description="Run inline and answer with the result instead of in the background"
    ),
]


class BoxScoreRequest(BaseSchema):
    season: str
    season_type: str
    week: str = "all"


class EliminateTeamsRequest(BaseSchema):
    team_ids: list[int] = Field(min_length=1, max_length=32)


class PlayoffFieldRequest(BaseSchema):
    team_ids: list[int]


class JobStarted(BaseSchema):
    """A background job was accepted; its progress shows in `ingestion_status`
    (`GET /api/players/sync-status`) and failures in the logs."""

    status: str = "started"


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


async def _run_job(name: str, job: Callable[[AsyncSession], Awaitable[object]]) -> None:
    """Run an ingest job in its own session after the response has gone out."""
    try:
        async with get_session_factory()() as db:
            await job(db)
            await db.commit()
    except IngestionBusy:
        logger.warning("Admin job skipped: already running", extra={"job": name})
    except Exception:
        logger.exception("Admin job failed", extra={"job": name})
    else:
        logger.info("Admin job finished", extra={"job": name})


async def _known_team_ids(db: AsyncSession, team_ids: list[int]) -> None:
    """422 unless every id is an `nfl_teams` row (a typo must not cut another team)."""
    wanted = set(team_ids)
    found = set(
        (await db.scalars(select(NFLTeam.id).where(NFLTeam.id.in_(wanted)))).all()
    )
    if found != wanted:
        unknown = ", ".join(str(i) for i in sorted(wanted - found))
        raise HTTPException(status_code=422, detail=f"Unknown NFL team id: {unknown}")


@router.post("/update/all", response_model=IngestAllResponse | JobStarted)
async def update_all(
    db: DbSession,
    tasks: BackgroundTasks,
    wait: Wait = False,
    body: UpdateAllRequest | None = None,
) -> Any:
    """Trigger the complete on-demand NFL data ingestion pipeline. Runs in the
    background (progress in `ingestion_status`); `?wait=true` runs it inline."""
    season = body.season if body else None
    with_stats = body.with_stats if body else True
    with_box_scores = body.with_box_scores if body else False

    async def job(session: AsyncSession) -> dict[str, Any]:
        result = await run_full_ingestion_pipeline(
            session,
            season=season,
            with_stats=with_stats,
            with_box_scores=with_box_scores,
        )
        if with_box_scores:
            await recompute_standings(session, get_settings().season_year)
        return result

    if wait:
        return await job(db)
    tasks.add_task(_run_job, "update_all", job)
    return JobStarted()


@router.post("/update/nfl_teams", response_model=JobStarted)
async def update_nfl_teams(
    db: DbSession, tasks: BackgroundTasks, wait: Wait = False
) -> JobStarted:
    async def job(session: AsyncSession) -> None:
        await ingest_nfl_teams(session)

    if wait:
        await job(db)
        return JobStarted(status="ok")
    tasks.add_task(_run_job, "nfl_teams", job)
    return JobStarted()


@router.post("/update/nfl_players", response_model=JobStarted)
async def update_nfl_players(
    db: DbSession, tasks: BackgroundTasks, wait: Wait = False
) -> JobStarted:
    async def job(session: AsyncSession) -> None:
        await ingest_nfl_players(session)

    if wait:
        await job(db)
        return JobStarted(status="ok")
    tasks.add_task(_run_job, "nfl_players", job)
    return JobStarted()


@router.post("/update/nfl_players_and_stats", response_model=JobStarted)
async def update_nfl_players_and_stats(
    db: DbSession, tasks: BackgroundTasks, wait: Wait = False
) -> JobStarted:
    async def job(session: AsyncSession) -> None:
        await ingest_season_stats(session)
        await ingest_kicker_distances(session)

    if wait:
        await job(db)
        return JobStarted(status="ok")
    tasks.add_task(_run_job, "nfl_players_and_stats", job)
    return JobStarted()


@router.post("/update/box_scores", response_model=JobStarted)
async def update_box_scores(
    body: BoxScoreRequest, db: DbSession, tasks: BackgroundTasks, wait: Wait = False
) -> JobStarted:
    async def job(session: AsyncSession) -> None:
        await ingest_box_scores(session, body.season, body.season_type, body.week)
        await recompute_standings(session, get_settings().season_year)

    if wait:
        await job(db)
        return JobStarted(status="ok")
    tasks.add_task(_run_job, "box_scores", job)
    return JobStarted()


@router.post("/update/eliminate_teams")
async def eliminate_teams(
    body: EliminateTeamsRequest,
    db: DbSession,
) -> dict[str, str]:
    await _known_team_ids(db, body.team_ids)
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


class FeatureFlagRequest(BaseSchema):
    enabled: bool


@router.get("/feature-flags")
async def get_feature_flags(db: DbSession) -> dict[str, bool]:
    return await feature_flags.all_flags(db)


@router.put("/feature-flags/{key}")
async def set_feature_flag_route(
    key: str, body: FeatureFlagRequest, db: DbSession
) -> dict[str, bool]:
    """The owner's kill switch: turn a feature (today only `bracket`) off or on."""
    try:
        await feature_flags.set_flag(db, key, body.enabled)
    except feature_flags.UnknownFlagError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return await feature_flags.all_flags(db)


class RefreshResponse(BaseSchema):
    polled: int


@router.post("/refresh/live", response_model=RefreshResponse)
async def refresh_live(db: DbSession) -> dict[str, int]:
    """Run one live-poll cycle now ("Refresh now"); spends one call per live game."""
    return {"polled": await run_poll_cycle(db, get_settings().season_year)}


class GameResultRequest(BaseSchema):
    season: int = Field(ge=2000, le=2100)
    team_id_home: int
    team_id_away: int
    home_pts: int = Field(ge=0, le=100)
    away_pts: int = Field(ge=0, le=100)
    # Entering a game the schedule doesn't have yet must be said out loud, so a typo
    # in the id edits nothing instead of inventing a game.
    create: bool = False


@router.put("/games/{game_id}/result")
async def set_game_result(
    game_id: str, body: GameResultRequest, db: DbSession
) -> dict[str, str]:
    """Enter or correct a final score by hand when the API fails, then recompute
    eliminations and standings (a corrected result reinstates a team it wrongly cut). A later
    reconcile fetch overwrites this with upstream data once the API recovers."""
    if body.team_id_home == body.team_id_away:
        raise HTTPException(status_code=422, detail="A game needs two different teams")
    await _known_team_ids(db, [body.team_id_home, body.team_id_away])
    game = await db.get(NFLGame, game_id)
    if game is None:
        if not body.create:
            raise HTTPException(
                status_code=404,
                detail="Unknown game id; send create: true to enter a new game",
            )
        game = NFLGame(id=game_id, season_type="post")
        db.add(game)
    elif game.season is not None and game.season != body.season:
        raise HTTPException(
            status_code=422,
            detail=f"That game belongs to season {game.season}, not {body.season}",
        )
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
