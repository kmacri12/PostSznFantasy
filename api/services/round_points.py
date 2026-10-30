"""Counted and bench points per fantasy team, round and player.

One calculation behind the standings, the round-by-round breakdown and the season
awards. A starter's points in a round are counted points; anyone else on the roster who
played that round, whether placed on the bench or never placed, earns bench points.
Nothing is stored: every call reads the lineups, game stats and league settings.
"""

from collections import defaultdict
from collections.abc import Collection, Mapping
from dataclasses import dataclass
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models.league import LeagueSettings, LineupSlot, Team, TeamPlayer
from api.db.models.nfl import NFLGame, NFLPlayer, NFLPlayerGameStats
from api.models.enums import PlayerPosition
from api.services.lineups import BENCH, slot_layout
from api.services.round_status import ROUNDS
from api.services.team_units import scoring_members
from api.utils.calculations.fantasy_points_utils import calculate_player_points
from api.utils.calculations.standings_utils import (
    ROUND_MULTIPLIER_FIELDS,
    postseason_round_index,
)

CENTS = Decimal("0.01")

# player id -> (game stats row, the game's week) for every postseason game they played.
StatsByPlayer = dict[int, list[tuple[NFLPlayerGameStats, int]]]


@dataclass(frozen=True)
class PointsLine:
    """What one rostered player earned a fantasy team in one round."""

    team_id: int
    round: int
    player_id: int
    # Index into the league's slot layout; None when the owner never placed them.
    slot_index: int | None
    starter: bool
    played: bool
    # After the round multiplier, in cents. Counted points for a starter, bench
    # points otherwise.
    points: Decimal


def _multiplier(settings: LeagueSettings, round_: int) -> Decimal:
    return Decimal(str(getattr(settings, ROUND_MULTIPLIER_FIELDS[round_ - 1])))


def point_lines(
    settings: LeagueSettings,
    starter_slots: Collection[int],
    rosters: Mapping[int, Collection[int]],
    placements: Mapping[tuple[int, int], Mapping[int, int]],
    players: Mapping[int, NFLPlayer],
    stats: StatsByPlayer,
    unit_members: Mapping[int, Collection[int]] | None = None,
) -> list[PointsLine]:
    """A line for every starter slot player, and for every other rostered player who
    played, in each round.

    `placements` maps (team id, round) to slot index -> player id, straight from the
    lineup rows: an owner who set nothing has starters nowhere, so everyone is bench.
    `unit_members` names whose stats feed a team QB / team K (team_units.scoring_members);
    anyone absent scores only for themselves.
    """
    unit_members = unit_members or {}
    lines: list[PointsLine] = []
    for team_id, roster in rosters.items():
        for round_ in ROUNDS:
            slot_of = {
                player_id: slot
                for slot, player_id in placements.get((team_id, round_), {}).items()
            }
            round_lines = []
            for player_id in roster:
                if player_id not in players:
                    continue
                slot = slot_of.get(player_id)
                starter = slot is not None and slot in starter_slots
                games = [
                    row
                    for scorer_id in unit_members.get(player_id, [player_id])
                    for row, week in stats.get(scorer_id, [])
                    if postseason_round_index(week) == round_ - 1
                ]
                if not starter and not games:
                    continue
                position = PlayerPosition.from_str(players[player_id].position)
                raw = sum(
                    (calculate_player_points(g, settings, position) for g in games),
                    Decimal(0),
                )
                round_lines.append(
                    PointsLine(
                        team_id,
                        round_,
                        player_id,
                        slot,
                        starter,
                        bool(games),
                        (raw * _multiplier(settings, round_)).quantize(CENTS),
                    )
                )
            round_lines.sort(
                key=lambda ln: (ln.slot_index is None, ln.slot_index or 0, ln.player_id)
            )
            lines.extend(round_lines)
    return lines


def sum_points(
    lines: list[PointsLine], *, counted: bool
) -> dict[tuple[int, int], Decimal]:
    """(team id, round) -> counted points (starters) or bench points (everyone else)."""
    totals: dict[tuple[int, int], Decimal] = defaultdict(Decimal)
    for ln in lines:
        if ln.starter == counted:
            totals[(ln.team_id, ln.round)] += ln.points
    return dict(totals)


async def postseason_stats(db: AsyncSession, season: int) -> StatsByPlayer:
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


async def league_point_lines(
    db: AsyncSession, league_id: int, stats: StatsByPlayer
) -> list[PointsLine]:
    """Every team's lines for a league; pass `postseason_stats` so callers can share it."""
    settings = (
        await db.execute(
            select(LeagueSettings).where(LeagueSettings.league_id == league_id)
        )
    ).scalar_one()
    starter_slots = {
        index for index, spec in enumerate(slot_layout(settings)) if spec.slot != BENCH
    }
    rosters: dict[int, list[int]] = defaultdict(list)
    for team_id, player_id in (
        await db.execute(
            select(TeamPlayer.team_id, TeamPlayer.player_id).where(
                TeamPlayer.league_id == league_id
            )
        )
    ).all():
        rosters[team_id].append(player_id)
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
    placements: dict[tuple[int, int], dict[int, int]] = defaultdict(dict)
    for team_id, round_, slot_index, player_id in (
        await db.execute(
            select(
                LineupSlot.team_id,
                LineupSlot.round,
                LineupSlot.slot_index,
                LineupSlot.player_id,
            )
            .join(Team, Team.id == LineupSlot.team_id)
            .where(Team.league_id == league_id)
        )
    ).all():
        placements[(team_id, round_)][slot_index] = player_id
    unit_members = await scoring_members(db, settings, players.values())
    return point_lines(
        settings, starter_slots, rosters, placements, players, stats, unit_members
    )
