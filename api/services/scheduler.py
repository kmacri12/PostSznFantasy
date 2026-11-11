import asyncio
import logging
import time
from collections.abc import Callable, Sequence
from datetime import UTC, datetime
from pathlib import Path

import sentry_sdk
from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from api.core.config import get_settings
from api.db.models.nfl import IngestionStatus, NFLGame, NFLTeam
from api.db.session import get_session_factory
from api.services.avatars import prune_orphans
from api.services.draft_reminders import send_draft_start_reminders
from api.services.eliminations import mark_eliminated_teams
from api.services.ingestion import (
    ingest_games_list,
    poll_game_box_score,
    run_full_ingestion_pipeline,
)
from api.services.ingestion.guard import IngestionBusy, IngestionKind
from api.services.lineup_reminders import send_lock_reminders
from api.services.notifications import prune_old as prune_old_notifications
from api.services.push import prune_stale_subscriptions
from api.services.replay import ReplayClient, load_replay, virtual_clock
from api.services.standings import recompute_standings
from api.utils.rapidapi.rapidapi import RapidApiClient, get_rapidapi_client

logger = logging.getLogger(__name__)

GAME_COMPLETED = "Completed"
LIST_FINAL = "Final"
ONE_HOUR_SECONDS = 3600
GAMES_LIST_MAX_AGE_SECONDS = 24 * ONE_HOUR_SECONDS
# Longest plausible game (with delays); past this a "live" game is a stale schedule.
MAX_GAME_SECONDS = 8 * ONE_HOUR_SECONDS
# Stat corrections land overnight and again two days on. Measured from kickoff because
# completion time is not stored: a game ends ~3.5h after it, so these are roughly
# "next morning" and "48 hours after the final whistle".
RECONCILE_FIRST_SECONDS = 18 * ONE_HOUR_SECONDS
RECONCILE_SECOND_SECONDS = 48 * ONE_HOUR_SECONDS
# One freshness row per game records its last reconcile (nfl.ingestion_status.kind is
# 32 chars; a game id is 16). Hidden from the public sync-status listing.
RECONCILE_KIND_PREFIX = "rc:"
# Plan requests left (from Tank01's response headers) below which each cycle warns.
LOW_QUOTA_WARNING = 100


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
    if game.game_status == LIST_FINAL:  # finished, but its box score is still unread
        return kickoff <= now
    return kickoff <= now < kickoff + MAX_GAME_SECONDS


def reconcile_due(game: NFLGame, last_reconciled: float | None, now: float) -> bool:
    """A completed game is re-fetched once in each correction window."""
    kickoff = _kickoff(game)
    if game.game_status != GAME_COMPLETED or kickoff is None:
        return False
    last = last_reconciled if last_reconciled is not None else float("-inf")
    return any(
        kickoff + window <= now and last < kickoff + window
        for window in (RECONCILE_FIRST_SECONDS, RECONCILE_SECOND_SECONDS)
    )


def games_list_due(
    games: Sequence[NFLGame], last_refreshed: float | None, now: float
) -> bool:
    """Daily, plus once after each kickoff so flex-moved or delayed games are seen."""
    # A stamp from the future (clock skew, or a replay's virtual clock) is no stamp.
    if (
        last_refreshed is None
        or last_refreshed > now + ONE_HOUR_SECONDS
        or now - last_refreshed >= GAMES_LIST_MAX_AGE_SECONDS
    ):
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


def _winning_team_id(game: NFLGame) -> int | None:
    loser = _losing_team_id(game)
    if loser is None:
        return None
    return game.team_id_home if loser == game.team_id_away else game.team_id_away


async def eliminate_losing_teams(
    db: AsyncSession, season: int, *, reinstate_winners: bool = False
) -> int:
    """Mark losers of finished playoff games as eliminated; safe to re-run.

    With `reinstate_winners` (reconcile only), a team that now wins a game it was
    marked as losing is reactivated, so a corrected final score undoes a wrong cut.
    """
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
    if reinstate_winners:
        winner_ids = {
            winner
            for g in games
            if _losing_team_id(g) is not None
            and (winner := _winning_team_id(g)) is not None
        } - set(loser_ids)
        if winner_ids:
            await db.execute(
                update(NFLTeam).where(NFLTeam.id.in_(winner_ids)).values(is_active=True)
            )
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


async def _reconcile_completed(
    db: AsyncSession,
    games: Sequence[NFLGame],
    season: int,
    client: RapidApiClient,
    now: float,
    skip: set[str],
) -> int:
    kinds = {g.id: RECONCILE_KIND_PREFIX + g.id for g in games}
    rows = (
        await db.execute(
            select(IngestionStatus)
            .where(IngestionStatus.kind.in_(kinds.values()))
            .execution_options(populate_existing=True)
        )
    ).scalars()
    last_by_kind = {r.kind: r.last_synced_at.timestamp() for r in rows}
    due = [
        g.id
        for g in games
        if g.id not in skip and reconcile_due(g, last_by_kind.get(kinds[g.id]), now)
    ]

    reconciled = 0
    for game_id in due:
        try:
            await poll_game_box_score(db, game_id, str(season), client=client)
            await db.execute(
                insert(IngestionStatus)
                .values(
                    kind=RECONCILE_KIND_PREFIX + game_id,
                    last_synced_at=datetime.fromtimestamp(now, UTC),
                )
                .on_conflict_do_update(
                    index_elements=[IngestionStatus.kind],
                    set_={"last_synced_at": datetime.fromtimestamp(now, UTC)},
                )
            )
            await db.commit()
            reconciled += 1
        except IngestionBusy as busy:
            await db.rollback()
            logger.info("Reconcile of %s skipped: %s", game_id, busy)
        except Exception:
            await db.rollback()
            logger.exception("Reconcile of %s failed; will retry next tick", game_id)
            sentry_sdk.capture_exception()
    return reconciled


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
    if client.budget_exhausted:
        logger.warning("RapidAPI daily budget spent; skipping this poll cycle")
        return 0

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
            sentry_sdk.capture_exception()
        games = await _playoff_games(db, season)

    polled = 0
    # Ids up front: rollback expires loaded rows, and logging must not re-query.
    live_ids = [g.id for g in games_to_poll(games, now)]
    for game_id in live_ids:
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
            sentry_sdk.capture_exception()

    # A rollback above expired the loaded rows, so reload before reading them.
    games = await _playoff_games(db, season)
    reconciled = await _reconcile_completed(
        db, games, season, client, now, skip=set(live_ids)
    )

    if polled or reconciled:
        eliminated = await eliminate_losing_teams(
            db, season, reinstate_winners=bool(reconciled)
        )
        await recompute_standings(db, season)
        await db.commit()
        logger.info("Polled %d live games; %d eliminations applied", polled, eliminated)
    try:
        await send_lock_reminders(db, season, datetime.fromtimestamp(now, UTC))
    except Exception:
        await db.rollback()
        logger.exception("Lineup lock reminders failed")
        sentry_sdk.capture_exception()
    try:
        await send_draft_start_reminders(db, datetime.fromtimestamp(now, UTC))
    except Exception:
        await db.rollback()
        logger.exception("Draft start reminders failed")
        sentry_sdk.capture_exception()
    limit = get_settings().rapidapi_daily_request_limit
    logger.info(
        "Scheduler cycle: %d polled, %d reconciled; RapidAPI calls today %d/%s, "
        "plan requests remaining %s",
        polled,
        reconciled,
        client.requests_today,
        limit or "unlimited",
        client.requests_remaining if client.requests_remaining is not None else "?",
    )
    if (
        client.requests_remaining is not None
        and client.requests_remaining < LOW_QUOTA_WARNING
    ):
        logger.warning(
            "RapidAPI plan quota is low: %d requests remaining",
            client.requests_remaining,
        )
    return polled


async def run_roster_sync() -> None:
    """Teams and players only (season stats are for the draft, not the live loop), then
    the stale push subscriptions."""
    async with get_session_factory()() as db:
        await run_full_ingestion_pipeline(db, with_stats=False, with_box_scores=False)
        await db.commit()
    async with get_session_factory()() as db:
        await prune_stale_subscriptions(db)
        await prune_old_notifications(db)
        await db.commit()
        try:
            await prune_orphans(db)
        except Exception:
            logger.exception("Avatar orphan sweep failed")


async def run_scheduler() -> None:
    """Loop until cancelled; a failing cycle is logged and retried next tick."""
    settings = get_settings()
    replay = settings.scheduler_replay_file
    season = settings.season_year
    client: RapidApiClient | ReplayClient | None = None
    clock: Callable[[], float] | None = None
    tick_seconds = float(settings.scheduler_live_poll_seconds)
    if replay:
        games, boxes = load_replay(Path(replay))
        season = int(games[0]["season"])
        first_kickoff = min(float(g["gameTime_epoch"]) for g in games)
        clock = virtual_clock(first_kickoff - 300, settings.scheduler_replay_speed)
        client = ReplayClient(games, boxes, clock)
        tick_seconds /= settings.scheduler_replay_speed
        logger.warning(
            "Scheduler REPLAYING season %d from %s; no API calls", season, replay
        )
    roster_interval = settings.scheduler_roster_sync_hours * ONE_HOUR_SECONDS
    last_roster_sync = float("-inf")
    logger.info(
        "Background scheduler started: live poll every %ds, roster sync every %dh",
        settings.scheduler_live_poll_seconds,
        settings.scheduler_roster_sync_hours,
    )
    while True:
        try:
            if not replay and time.monotonic() - last_roster_sync >= roster_interval:
                await run_roster_sync()
                last_roster_sync = time.monotonic()
            async with get_session_factory()() as db:
                await run_poll_cycle(
                    db,
                    season,
                    client=client,  # type: ignore[arg-type]
                    now=clock() if clock else None,
                )
        except IngestionBusy as busy:
            logger.info("Scheduler cycle skipped: %s", busy)
        except Exception:
            logger.exception("Scheduler cycle failed")
            sentry_sdk.capture_exception()
        await asyncio.sleep(tick_seconds)
