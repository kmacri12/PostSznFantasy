import logging
from collections import defaultdict
from dataclasses import dataclass
from decimal import Decimal

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models.draft import Draft
from api.db.models.league import (
    League,
    LeagueSettings,
    LeagueStanding,
    LineupSlot,
    Team,
    TeamPlayer,
)
from api.db.models.nfl import NFLGame, NFLPlayer, NFLPlayerGameStats
from api.models.enums import DraftStatus, PlayerPosition
from api.services.lineups import BENCH, slot_layout
from api.utils.calculations.fantasy_points_utils import calculate_player_points
from api.utils.calculations.standings_utils import (
    get_players_left,
    postseason_round_index,
    round_multiplier,
)

logger = logging.getLogger(__name__)

RoundPoints = tuple[Decimal, Decimal, Decimal, Decimal]
CENTS = Decimal("0.01")
# Namespace for the per-league advisory lock below.
STANDINGS_LOCK = 0x57A2


@dataclass(frozen=True)
class TeamTally:
    team_id: int
    players_left: int
    round_points: RoundPoints


@dataclass(frozen=True)
class RankedTeam:
    team_id: int
    rank: int
    players_left: int
    round_points: RoundPoints
    total: Decimal


def rank_teams(tallies: list[TeamTally]) -> list[RankedTeam]:
    """Order by total points, then players left; teams level on both share a rank."""
    keyed = sorted(
        ((sum(t.round_points, Decimal(0)), t) for t in tallies),
        key=lambda pair: (-pair[0], -pair[1].players_left, pair[1].team_id),
    )
    ranked: list[RankedTeam] = []
    for position, (total, tally) in enumerate(keyed, start=1):
        previous = ranked[-1] if ranked else None
        level = (
            previous is not None
            and previous.total == total
            and previous.players_left == tally.players_left
        )
        ranked.append(
            RankedTeam(
                tally.team_id,
                previous.rank if previous is not None and level else position,
                tally.players_left,
                tally.round_points,
                total,
            )
        )
    return ranked


StatsByPlayer = dict[int, list[tuple[NFLPlayerGameStats, int]]]


async def _postseason_stats(db: AsyncSession, season: int) -> StatsByPlayer:
    rows = await db.execute(
        select(NFLPlayerGameStats, NFLGame.game_week)
        .join(NFLGame, NFLPlayerGameStats.game_id == NFLGame.id)
        .where(
            NFLGame.season == season,
            NFLGame.season_type == "post",
            NFLGame.game_week.is_not(None),
        )
        # Box score upserts bypass the identity map, so never trust cached rows.
        .execution_options(populate_existing=True)
    )
    by_player: StatsByPlayer = defaultdict(list)
    for stats, week in rows.all():
        if week is not None:
            by_player[stats.player_id].append((stats, week))
    return by_player


async def _tally_league(
    db: AsyncSession, league_id: int, stats: StatsByPlayer
) -> list[TeamTally]:
    settings = (
        await db.execute(
            select(LeagueSettings).where(LeagueSettings.league_id == league_id)
        )
    ).scalar_one()
    team_ids = (
        (await db.execute(select(Team.id).where(Team.league_id == league_id)))
        .scalars()
        .all()
    )
    specs = slot_layout(settings)
    starter_slots = {i for i, spec in enumerate(specs) if spec.slot != BENCH}
    players = {
        p.id: p
        for p in (
            await db.execute(
                select(NFLPlayer)
                .join(TeamPlayer, TeamPlayer.player_id == NFLPlayer.id)
                .where(TeamPlayer.league_id == league_id)
            )
        ).scalars()
    }
    # Only players the owner placed in a starter slot that round score; no auto-fill.
    starters: dict[tuple[int, int], list[int]] = defaultdict(list)
    for team_id, round_, slot_index, player_id in (
        await db.execute(
            select(
                LineupSlot.team_id,
                LineupSlot.round,
                LineupSlot.slot_index,
                LineupSlot.player_id,
            ).where(LineupSlot.team_id.in_(team_ids))
        )
    ).all():
        if slot_index in starter_slots and player_id in players:
            starters[(team_id, round_)].append(player_id)

    tallies = []
    for team_id in team_ids:
        points = [Decimal(0)] * 4
        for round_ in range(1, 5):
            for pid in starters[(team_id, round_)]:
                position = PlayerPosition.from_str(players[pid].position)
                for game_stats, week in stats.get(pid, []):
                    if postseason_round_index(week) == round_ - 1:
                        points[round_ - 1] += calculate_player_points(
                            game_stats, settings, position
                        ) * round_multiplier(settings, week)
        tallies.append(
            TeamTally(
                team_id,
                await get_players_left(team_id, league_id, db),
                tuple(p.quantize(CENTS) for p in points),  # type: ignore[arg-type]
            )
        )
    return tallies


async def _store_league(db: AsyncSession, league_id: int, stats: StatsByPlayer) -> None:
    # Serializes writers (poll cycle vs. draft completion) so neither inserts rows
    # the other's delete missed; held until the caller's transaction ends.
    await db.execute(select(func.pg_advisory_xact_lock(STANDINGS_LOCK, league_id)))
    ranked = rank_teams(await _tally_league(db, league_id, stats))
    await db.execute(
        delete(LeagueStanding).where(LeagueStanding.league_id == league_id)
    )
    db.add_all(
        LeagueStanding(
            league_id=league_id,
            team_id=team.team_id,
            rank=team.rank,
            players_left=team.players_left,
            wild_card=team.round_points[0],
            divisional=team.round_points[1],
            conf_champ=team.round_points[2],
            super_bowl=team.round_points[3],
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
    stats = await _postseason_stats(db, season)
    done = 0
    for league_id in league_ids:
        try:
            async with db.begin_nested():
                await _store_league(db, league_id, stats)
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


async def clear_league_standings(db: AsyncSession, league_id: int) -> None:
    """A draft reopened by an undo is no longer complete, so it has no table."""
    await db.execute(
        delete(LeagueStanding).where(LeagueStanding.league_id == league_id)
    )
