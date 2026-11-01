import logging
from decimal import Decimal

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models.draft import Draft
from api.db.models.league import Season, SeasonStanding, Team, TeamPlayer
from api.db.models.nfl import NFLPlayer
from api.models.enums import DraftStatus
from api.services.live_leagues import live_season_ids
from api.services.ranking import RankingFacts, RoundPoints, rank_teams
from api.services.round_points import (
    StatsByPlayer,
    postseason_stats,
    season_point_lines,
    sum_points,
)
from api.services.round_status import (
    ROUNDS,
    GameFacts,
    completed_rounds,
    load_games,
    super_bowl_winner,
)
from api.utils.calculations.standings_utils import get_players_left

logger = logging.getLogger(__name__)

# Namespace for the per-season advisory lock below.
STANDINGS_LOCK = 0x57A2


async def load_ranking_facts(
    db: AsyncSession, season_id: int, games: list[GameFacts]
) -> RankingFacts:
    """What the tiebreaker chain needs: finished rounds and who holds the winner."""
    winner = super_bowl_winner(games)
    on_winner: dict[int, int] = {}
    if winner is not None:
        rows = await db.execute(
            select(TeamPlayer.team_id, func.count())
            .join(NFLPlayer, NFLPlayer.id == TeamPlayer.player_id)
            .where(TeamPlayer.season_id == season_id, NFLPlayer.team_id == winner)
            .group_by(TeamPlayer.team_id)
        )
        on_winner = {team_id: count for team_id, count in rows.all()}
    return RankingFacts(completed_rounds(games), on_winner)


async def _season_round_points(
    db: AsyncSession, season_id: int, stats: StatsByPlayer
) -> dict[int, RoundPoints]:
    team_ids = (
        (await db.execute(select(Team.id).where(Team.season_id == season_id)))
        .scalars()
        .all()
    )
    counted = sum_points(await season_point_lines(db, season_id, stats), counted=True)
    zero = Decimal(0)
    return {
        team_id: (
            counted.get((team_id, ROUNDS[0]), zero),
            counted.get((team_id, ROUNDS[1]), zero),
            counted.get((team_id, ROUNDS[2]), zero),
            counted.get((team_id, ROUNDS[3]), zero),
        )
        for team_id in team_ids
    }


async def _store_season(
    db: AsyncSession, season_id: int, stats: StatsByPlayer, games: list[GameFacts]
) -> None:
    # Serializes writers (poll cycle vs. draft completion) so neither inserts rows
    # the other's delete missed; held until the caller's transaction ends.
    await db.execute(select(func.pg_advisory_xact_lock(STANDINGS_LOCK, season_id)))
    round_points = await _season_round_points(db, season_id, stats)
    ranked = rank_teams(round_points, await load_ranking_facts(db, season_id, games))
    await db.execute(
        delete(SeasonStanding).where(SeasonStanding.season_id == season_id)
    )
    players_left = {
        team.team_id: await get_players_left(team.team_id, season_id, db)
        for team in ranked
    }
    db.add_all(
        SeasonStanding(
            season_id=season_id,
            team_id=team.team_id,
            rank=team.rank,
            players_left=players_left[team.team_id],
            wild_card=round_points[team.team_id][0],
            divisional=round_points[team.team_id][1],
            conf_champ=round_points[team.team_id][2],
            super_bowl=round_points[team.team_id][3],
            total=team.total,
        )
        for team in ranked
    )
    await db.flush()


async def _recompute_seasons(db: AsyncSession, season_ids: list[int], year: int) -> int:
    """Each season in its own savepoint: one that fails keeps its last good rows.

    Caller commits, so every season lands in the same transaction as the scores and
    eliminations that triggered it.
    """
    stats = await postseason_stats(db, year)
    games = await load_games(db, year)
    done = 0
    for season_id in season_ids:
        try:
            async with db.begin_nested():
                await _store_season(db, season_id, stats, games)
            done += 1
        except Exception:
            logger.exception(
                "Standings recompute failed; keeping the last good rows",
                extra={"season_id": season_id},
            )
    return done


async def recompute_standings(db: AsyncSession, year: int) -> int:
    """Rewrite standings for every drafted season of the year; returns successes.

    Seasons still drafting have no table, and writing one would lock their team rows
    (foreign keys) against people joining.
    """
    season_ids = list(
        (
            await db.execute(
                select(Season.id)
                .join(Draft, Draft.season_id == Season.id)
                .where(
                    Season.id.in_(live_season_ids()),
                    Season.year == year,
                    Draft.status == DraftStatus.COMPLETED.value,
                )
            )
        )
        .scalars()
        .all()
    )
    return await _recompute_seasons(db, season_ids, year)


async def recompute_season_standings(db: AsyncSession, season_id: int) -> None:
    """One season, e.g. when its draft finishes and the page needs a zero-point table."""
    year = await db.scalar(select(Season.year).where(Season.id == season_id))
    if year is not None:
        await _recompute_seasons(db, [season_id], year)


async def refresh_standings_if_drafted(db: AsyncSession, season_id: int) -> None:
    """After a lineup move or settings change: scores always follow the latest inputs."""
    drafted = await db.scalar(
        select(Draft.id).where(
            Draft.season_id == season_id,
            Draft.status == DraftStatus.COMPLETED.value,
        )
    )
    if drafted is not None:
        await recompute_season_standings(db, season_id)


async def clear_season_standings(db: AsyncSession, season_id: int) -> None:
    """A draft reopened by an undo is no longer complete, so it has no table."""
    await db.execute(
        delete(SeasonStanding).where(SeasonStanding.season_id == season_id)
    )
