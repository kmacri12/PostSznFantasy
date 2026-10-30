import logging
from collections import defaultdict
from dataclasses import dataclass
from decimal import Decimal

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models.league import (
    League,
    LeagueSettings,
    LeagueStanding,
    Team,
    TeamPlayer,
)
from api.db.models.nfl import NFLGame, NFLPlayer, NFLPlayerGameStats
from api.models.enums import PlayerPosition
from api.services.roster_slots import BENCH, assign_players, slot_layout
from api.utils.calculations.fantasy_points_utils import calculate_player_points
from api.utils.calculations.standings_utils import (
    get_players_left,
    postseason_round_index,
    round_multiplier,
)

logger = logging.getLogger(__name__)

RoundPoints = tuple[Decimal, Decimal, Decimal, Decimal]
CENTS = Decimal("0.01")


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
    roster: dict[int, list[NFLPlayer]] = defaultdict(list)
    preferred: dict[int, int] = {}
    # Same order as the team page, so scored starters are the ones the owner sees.
    for team_id, slot_index, player in (
        await db.execute(
            select(TeamPlayer.team_id, TeamPlayer.slot_index, NFLPlayer)
            .join(NFLPlayer, NFLPlayer.id == TeamPlayer.player_id)
            .where(TeamPlayer.league_id == league_id)
            .order_by(NFLPlayer.name)
        )
    ).all():
        roster[team_id].append(player)
        if slot_index is not None:
            preferred[player.id] = slot_index

    specs = slot_layout(settings)
    tallies = []
    for team_id in team_ids:
        players = roster[team_id]
        position_of = {p.id: PlayerPosition.from_str(p.position) for p in players}
        placed = assign_players(
            specs, [(pid, pos) for pid, pos in position_of.items()], preferred
        )
        starters = [
            pid
            for pid, spec in zip(placed, specs, strict=True)
            if pid is not None and spec.slot != BENCH
        ]
        points = [Decimal(0)] * 4
        for pid in starters:
            for game_stats, week in stats.get(pid, []):
                index = postseason_round_index(week)
                if index is not None:
                    points[index] += calculate_player_points(
                        game_stats, settings, position_of[pid]
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
    """Rewrite standings for every league of the season; returns how many succeeded."""
    league_ids = list(
        (await db.execute(select(League.id).where(League.season == season)))
        .scalars()
        .all()
    )
    return await _recompute_leagues(db, league_ids, season)


async def recompute_league_standings(db: AsyncSession, league_id: int) -> None:
    """One league, e.g. when its draft finishes and the page needs a zero-point table."""
    season = await db.scalar(select(League.season).where(League.id == league_id))
    if season is not None:
        await _recompute_leagues(db, [league_id], season)
