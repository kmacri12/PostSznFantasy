import logging
from decimal import Decimal

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models.draft import Draft
from api.db.models.league import League, LeagueStanding, Team, TeamPlayer
from api.db.models.nfl import NFLPlayer
from api.models.enums import DraftStatus
from api.services.ranking import RankingFacts, RoundPoints, rank_teams
from api.services.round_points import (
    StatsByPlayer,
    league_point_lines,
    postseason_stats,
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

# Namespace for the per-league advisory lock below.
STANDINGS_LOCK = 0x57A2


async def load_ranking_facts(
    db: AsyncSession, league_id: int, games: list[GameFacts]
) -> RankingFacts:
    """What the tiebreaker chain needs: finished rounds and who holds the winner."""
    winner = super_bowl_winner(games)
    on_winner: dict[int, int] = {}
    if winner is not None:
        rows = await db.execute(
            select(TeamPlayer.team_id, func.count())
            .join(NFLPlayer, NFLPlayer.id == TeamPlayer.player_id)
            .where(TeamPlayer.league_id == league_id, NFLPlayer.team_id == winner)
            .group_by(TeamPlayer.team_id)
        )
        on_winner = {team_id: count for team_id, count in rows.all()}
    return RankingFacts(completed_rounds(games), on_winner)


async def _league_round_points(
    db: AsyncSession, league_id: int, stats: StatsByPlayer
) -> dict[int, RoundPoints]:
    team_ids = (
        (await db.execute(select(Team.id).where(Team.league_id == league_id)))
        .scalars()
        .all()
    )
    counted = sum_points(await league_point_lines(db, league_id, stats), counted=True)
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


async def _store_league(
    db: AsyncSession, league_id: int, stats: StatsByPlayer, games: list[GameFacts]
) -> None:
    # Serializes writers (poll cycle vs. draft completion) so neither inserts rows
    # the other's delete missed; held until the caller's transaction ends.
    await db.execute(select(func.pg_advisory_xact_lock(STANDINGS_LOCK, league_id)))
    round_points = await _league_round_points(db, league_id, stats)
    ranked = rank_teams(round_points, await load_ranking_facts(db, league_id, games))
    await db.execute(
        delete(LeagueStanding).where(LeagueStanding.league_id == league_id)
    )
    players_left = {
        team.team_id: await get_players_left(team.team_id, league_id, db)
        for team in ranked
    }
    db.add_all(
        LeagueStanding(
            league_id=league_id,
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


async def _recompute_leagues(
    db: AsyncSession, league_ids: list[int], season: int
) -> int:
    """Each league in its own savepoint: one that fails keeps its last good rows.

    Caller commits, so every league lands in the same transaction as the scores and
    eliminations that triggered it.
    """
    stats = await postseason_stats(db, season)
    games = await load_games(db, season)
    done = 0
    for league_id in league_ids:
        try:
            async with db.begin_nested():
                await _store_league(db, league_id, stats, games)
            done += 1
        except Exception:
            logger.exception(
                "Standings recompute failed; keeping the last good rows",
                extra={"league_id": league_id},
            )
    return done


async def recompute_standings(db: AsyncSession, season: int) -> int:
    """Rewrite standings for every drafted league of the season; returns successes.

    Leagues still drafting have no table, and writing one would lock their team rows
    (foreign keys) against people joining.
    """
    league_ids = list(
        (
            await db.execute(
                select(League.id)
                .join(Draft, Draft.league_id == League.id)
                .where(
                    League.season == season,
                    Draft.status == DraftStatus.COMPLETED.value,
                )
            )
        )
        .scalars()
        .all()
    )
    return await _recompute_leagues(db, league_ids, season)


async def recompute_league_standings(db: AsyncSession, league_id: int) -> None:
    """One league, e.g. when its draft finishes and the page needs a zero-point table."""
    season = await db.scalar(select(League.season).where(League.id == league_id))
    if season is not None:
        await _recompute_leagues(db, [league_id], season)


async def refresh_standings_if_drafted(db: AsyncSession, league_id: int) -> None:
    """After a lineup move or settings change: scores always follow the latest inputs."""
    drafted = await db.scalar(
        select(Draft.id).where(
            Draft.league_id == league_id,
            Draft.status == DraftStatus.COMPLETED.value,
        )
    )
    if drafted is not None:
        await recompute_league_standings(db, league_id)


async def clear_league_standings(db: AsyncSession, league_id: int) -> None:
    """A draft reopened by an undo is no longer complete, so it has no table."""
    await db.execute(
        delete(LeagueStanding).where(LeagueStanding.league_id == league_id)
    )
