import asyncio
import logging
import time

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.core.config import get_settings
from api.db.models.nfl import NFLGame
from api.db.session import get_session_factory
from api.services.eliminations import mark_eliminated_teams
from api.services.ingestion import ingest_box_scores, run_full_ingestion_pipeline
from api.services.ingestion.guard import IngestionBusy

logger = logging.getLogger(__name__)

GAME_COMPLETED = "Completed"
ONE_HOUR_SECONDS = 3600


def _is_live_window(game: NFLGame, now: float) -> bool:
    """Started per the schedule but not yet final."""
    if game.game_status == GAME_COMPLETED or not game.game_time_epoch:
        return False
    try:
        return float(game.game_time_epoch) <= now
    except ValueError:
        return False


def _losing_team_id(game: NFLGame) -> int | None:
    if game.game_status != GAME_COMPLETED:
        return None
    if game.home_pts is None or game.away_pts is None:
        return None
    if game.home_pts == game.away_pts:
        return None
    return game.team_id_away if game.home_pts > game.away_pts else game.team_id_home


async def eliminate_losing_teams(db: AsyncSession, season: int) -> int:
    """Mark losers of finished playoff games as eliminated; safe to re-run."""
    games = (
        (
            await db.execute(
                select(NFLGame).where(
                    NFLGame.season == season, NFLGame.season_type == "post"
                )
            )
        )
        .scalars()
        .all()
    )
    loser_ids = [loser for g in games if (loser := _losing_team_id(g)) is not None]
    await mark_eliminated_teams(db, loser_ids)
    return len(loser_ids)


async def has_live_games(db: AsyncSession, season: int) -> bool:
    games = (
        (
            await db.execute(
                select(NFLGame).where(
                    NFLGame.season == season, NFLGame.season_type == "post"
                )
            )
        )
        .scalars()
        .all()
    )
    now = time.time()
    return any(_is_live_window(g, now) for g in games)


async def run_sync_cycle(*, roster_sync_due: bool) -> None:
    """One scheduler tick: full sync when due, box score polling while games are live."""
    season = get_settings().season_year
    async with get_session_factory()() as db:
        if roster_sync_due:
            await run_full_ingestion_pipeline(db, with_box_scores=True)
        elif await has_live_games(db, season):
            await ingest_box_scores(db, str(season), "post", "all")
        else:
            return
        eliminated = await eliminate_losing_teams(db, season)
        await db.commit()
        logger.info("Scheduler cycle done; %d eliminations applied", eliminated)


async def run_scheduler() -> None:
    """Loop until cancelled; a failing cycle is logged and retried next tick."""
    settings = get_settings()
    roster_interval = settings.scheduler_roster_sync_hours * ONE_HOUR_SECONDS
    last_roster_sync = float("-inf")
    logger.info("Background scheduler started")
    while True:
        roster_sync_due = time.monotonic() - last_roster_sync >= roster_interval
        try:
            await run_sync_cycle(roster_sync_due=roster_sync_due)
            if roster_sync_due:
                last_roster_sync = time.monotonic()
        except IngestionBusy as busy:
            logger.info("Scheduler cycle skipped: %s", busy)
        except Exception:
            logger.exception("Scheduler cycle failed")
        await asyncio.sleep(settings.scheduler_live_poll_seconds)
