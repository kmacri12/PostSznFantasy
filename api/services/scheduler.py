import asyncio
import logging
import time
from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.core.config import get_settings
from api.db.models.nfl import IngestionStatus, NFLGame
from api.db.session import get_session_factory
from api.services.eliminations import mark_eliminated_teams
from api.services.ingestion import (
    ingest_games_list,
    poll_game_box_score,
    run_full_ingestion_pipeline,
)
from api.services.ingestion.guard import IngestionBusy, IngestionKind
from api.utils.rapidapi.rapidapi import RapidApiClient, get_rapidapi_client

logger = logging.getLogger(__name__)

GAME_COMPLETED = "Completed"
ONE_HOUR_SECONDS = 3600
GAMES_LIST_MAX_AGE_SECONDS = 24 * ONE_HOUR_SECONDS
# Longest plausible game (with delays); past this a "live" game is a stale schedule.
MAX_GAME_SECONDS = 8 * ONE_HOUR_SECONDS


def games_to_poll(games: Sequence[NFLGame], now: float) -> list[NFLGame]:
    """Kicked off per the schedule but not final, and not so old it was postponed."""
    return [g for g in games if _is_live_window(g, now)]


def _kickoff(game: NFLGame) -> float | None:
    try:
        return float(game.game_time_epoch) if game.game_time_epoch else None
    except ValueError:
        return None


def _is_live_window(game: NFLGame, now: float) -> bool:
    kickoff = _kickoff(game)
    if game.game_status == GAME_COMPLETED or kickoff is None:
        return False
    return kickoff <= now < kickoff + MAX_GAME_SECONDS


def games_list_due(
    games: Sequence[NFLGame], last_refreshed: float | None, now: float
) -> bool:
    """Daily, plus once after each kickoff so flex-moved or delayed games are seen."""
    if last_refreshed is None or now - last_refreshed >= GAMES_LIST_MAX_AGE_SECONDS:
        return True
    return any(
        g.game_status != GAME_COMPLETED
        and (kickoff := _kickoff(g)) is not None
        and last_refreshed < kickoff <= now
        for g in games
    )


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
                select(NFLGame)
                .where(NFLGame.season == season, NFLGame.season_type == "post")
                .execution_options(populate_existing=True)
            )
        )
        .scalars()
        .all()
    )
    loser_ids = [loser for g in games if (loser := _losing_team_id(g)) is not None]
    await mark_eliminated_teams(db, loser_ids)
    return len(loser_ids)


async def _playoff_games(db: AsyncSession, season: int) -> list[NFLGame]:
    # Upserts bypass the identity map, so reload rather than trust cached rows.
    result = await db.execute(
        select(NFLGame)
        .where(NFLGame.season == season, NFLGame.season_type == "post")
        .execution_options(populate_existing=True)
    )
    return list(result.scalars().all())


async def _games_list_last_refreshed(db: AsyncSession) -> float | None:
    row = await db.get(IngestionStatus, IngestionKind.GAMES.name.lower())
    return row.last_synced_at.timestamp() if row else None


async def run_poll_cycle(
    db: AsyncSession,
    season: int,
    *,
    client: RapidApiClient | None = None,
    now: float | None = None,
) -> int:
    """One live tick: refresh the schedule if due, then one box score per live game.

    Returns the number of box scores stored. A failing game is rolled back and
    skipped, leaving its last good data (and freshness timestamp) untouched.
    """
    now = time.time() if now is None else now
    client = client or get_rapidapi_client()

    games = await _playoff_games(db, season)
    if games_list_due(games, await _games_list_last_refreshed(db), now):
        try:
            await ingest_games_list(db, str(season), client=client)
            await db.commit()
        except IngestionBusy as busy:
            await db.rollback()
            logger.info("Games list refresh skipped: %s", busy)
        except Exception:
            await db.rollback()
            logger.exception("Games list refresh failed; keeping the stored schedule")
        games = await _playoff_games(db, season)

    polled = 0
    # Ids up front: rollback expires loaded rows, and logging must not re-query.
    for game_id in [g.id for g in games_to_poll(games, now)]:
        try:
            await poll_game_box_score(db, game_id, str(season), client=client)
            await db.commit()
            polled += 1
        except IngestionBusy as busy:
            await db.rollback()
            logger.info("Poll of %s skipped: %s", game_id, busy)
        except Exception:
            await db.rollback()
            logger.exception("Poll of %s failed; keeping its last good data", game_id)

    if polled:
        eliminated = await eliminate_losing_teams(db, season)
        await db.commit()
        logger.info("Polled %d live games; %d eliminations applied", polled, eliminated)
    if client.requests_remaining is not None:
        logger.info("RapidAPI requests remaining: %d", client.requests_remaining)
    return polled


async def run_roster_sync() -> None:
    """Teams and players only: season stats are for the draft, not the live loop."""
    async with get_session_factory()() as db:
        await run_full_ingestion_pipeline(db, with_stats=False, with_box_scores=False)
        await db.commit()


async def run_scheduler() -> None:
    """Loop until cancelled; a failing cycle is logged and retried next tick."""
    settings = get_settings()
    roster_interval = settings.scheduler_roster_sync_hours * ONE_HOUR_SECONDS
    last_roster_sync = float("-inf")
    logger.info("Background scheduler started")
    while True:
        try:
            if time.monotonic() - last_roster_sync >= roster_interval:
                await run_roster_sync()
                last_roster_sync = time.monotonic()
            async with get_session_factory()() as db:
                await run_poll_cycle(db, settings.season_year)
        except IngestionBusy as busy:
            logger.info("Scheduler cycle skipped: %s", busy)
        except Exception:
            logger.exception("Scheduler cycle failed")
        await asyncio.sleep(settings.scheduler_live_poll_seconds)
