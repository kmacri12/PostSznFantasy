"""Per-round lineups: slot layout, legal moves and kickoff locks.

A lineup belongs to a fantasy team and a round and is empty until the owner places
players; nothing is copied between rounds or filled in automatically.
"""

from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models.league import LeagueSettings, LineupSlot, Team
from api.db.models.nfl import NFLPlayer
from api.models.enums import PlayerPosition, PlayerRoundStatus
from api.models.league_models import LineupPlayer, LineupSlotView, RoundLineup
from api.services.round_status import ROUNDS, GameFacts, load_games, round_status

FLEX_SLOTS: dict[str, tuple[PlayerPosition, ...]] = {
    "FLEX": (PlayerPosition.WR, PlayerPosition.RB, PlayerPosition.TE),
    "W/R": (PlayerPosition.WR, PlayerPosition.RB),
    "W/T": (PlayerPosition.WR, PlayerPosition.TE),
    "SUPER_FLEX": (
        PlayerPosition.QB,
        PlayerPosition.WR,
        PlayerPosition.RB,
        PlayerPosition.TE,
    ),
}
BENCH = "BENCH"


class LineupError(Exception):
    """The requested move isn't allowed; the message is safe to show to the owner."""


@dataclass(frozen=True)
class SlotSpec:
    slot: str
    allowed: tuple[PlayerPosition, ...] | None  # None: any position (bench)


def slot_layout(settings: LeagueSettings) -> list[SlotSpec]:
    """The empty lineup template implied by the league's roster settings."""
    specs: list[SlotSpec] = []

    def add(name: str, count: int, allowed: tuple[PlayerPosition, ...] | None) -> None:
        specs.extend(SlotSpec(name, allowed) for _ in range(count))

    add("QB", settings.roster_num_qb, (PlayerPosition.QB,))
    add("RB", settings.roster_num_rb, (PlayerPosition.RB,))
    add("WR", settings.roster_num_wr, (PlayerPosition.WR,))
    add("TE", settings.roster_num_te, (PlayerPosition.TE,))
    add("FLEX", settings.roster_num_flex_wr_rb_te, FLEX_SLOTS["FLEX"])
    add("W/R", settings.roster_num_flex_wr_rb, FLEX_SLOTS["W/R"])
    add("W/T", settings.roster_num_flex_wr_te, FLEX_SLOTS["W/T"])
    add("SUPER_FLEX", settings.roster_num_flex_qb_wr_rb_te, FLEX_SLOTS["SUPER_FLEX"])
    add("K", settings.roster_num_k, (PlayerPosition.K,))
    add("DEF", settings.roster_num_dst, (PlayerPosition.DST,))
    add(BENCH, settings.roster_num_bench, None)
    return specs


def _eligible(spec: SlotSpec, position: PlayerPosition | None) -> bool:
    return spec.allowed is None or position in spec.allowed


def move_player(
    specs: list[SlotSpec],
    placement: list[int | None],
    positions: dict[int, PlayerPosition | None],
    locked: set[int],
    player_id: int,
    target: int | None,
) -> list[int | None]:
    """Move a player to slot `target`, or out of the lineup when `target` is None.

    The displaced occupant takes the mover's old slot if eligible, else an open bench
    spot, else leaves the lineup. Legal only if every player involved is unlocked.
    """
    if target is not None and not 0 <= target < len(specs):
        raise LineupError("That slot doesn't exist")
    if target is not None and not _eligible(specs[target], positions.get(player_id)):
        raise LineupError(
            f"A {positions.get(player_id)} can't play {specs[target].slot}"
        )
    result = list(placement)
    old = result.index(player_id) if player_id in result else None
    if old == target:
        return result
    occupant = result[target] if target is not None else None
    for involved in (player_id, occupant):
        if involved in locked:
            raise LineupError("That player is locked: their game has kicked off")
    if old is not None:
        result[old] = None
    if target is None:
        return result
    result[target] = player_id
    if occupant is not None and old is not None:
        if _eligible(specs[old], positions.get(occupant)):
            result[old] = occupant
        else:
            open_bench = next(
                (
                    i
                    for i, spec in enumerate(specs)
                    if spec.allowed is None and result[i] is None
                ),
                None,
            )
            if open_bench is None:
                raise LineupError("No open bench spot for the displaced player")
            result[open_bench] = occupant
    return result


def _view(
    player: NFLPlayer, games: list[GameFacts], round_: int, now: datetime
) -> LineupPlayer:
    standing = round_status(games, player.team_id, round_)
    return LineupPlayer(
        id=player.id,
        name=player.name or "",
        position=player.position or "",
        team_abv=player.team.team_abv if player.team else None,
        is_active=player.team.is_active if player.team else False,
        status=standing.status,
        kickoff=standing.kickoff,
        locked=standing.kickoff is not None and now >= standing.kickoff,
    )


def _eliminated_ids(
    players: list[NFLPlayer], games: list[GameFacts], round_: int
) -> set[int]:
    return {
        p.id
        for p in players
        if round_status(games, p.team_id, round_).status is PlayerRoundStatus.ELIMINATED
    }


async def _placements(db: AsyncSession, team_id: int) -> dict[int, dict[int, int]]:
    """round -> slot index -> player id, straight from the stored rows."""
    rows = await db.execute(
        select(LineupSlot.round, LineupSlot.slot_index, LineupSlot.player_id).where(
            LineupSlot.team_id == team_id
        )
    )
    by_round: dict[int, dict[int, int]] = {r: {} for r in ROUNDS}
    for round_, slot_index, player_id in rows.all():
        by_round[round_][slot_index] = player_id
    return by_round


def _round_lineup(
    specs: list[SlotSpec],
    players: list[NFLPlayer],
    games: list[GameFacts],
    stored: dict[int, int],
    round_: int,
    now: datetime,
) -> RoundLineup:
    views = {p.id: _view(p, games, round_, now) for p in players}
    # Eliminated players drop out of any slot they were placed in early.
    placed = {
        index: pid
        for index, pid in stored.items()
        if pid in views and views[pid].status is not PlayerRoundStatus.ELIMINATED
    }
    slots = [
        LineupSlotView(
            index=index,
            slot=spec.slot,
            player=views[placed[index]] if index in placed else None,
        )
        for index, spec in enumerate(specs)
    ]
    in_lineup = set(placed.values())
    return RoundLineup(
        round=round_,
        slots=slots,
        unassigned=[
            v
            for pid, v in views.items()
            if pid not in in_lineup and v.status is not PlayerRoundStatus.ELIMINATED
        ],
        eliminated=[
            v for v in views.values() if v.status is PlayerRoundStatus.ELIMINATED
        ],
        empty_starter_slots=sum(
            1 for s in slots if s.slot != BENCH and s.player is None
        ),
        first_kickoff=min(
            (g.kickoff for g in games if g.round == round_ and g.kickoff), default=None
        ),
    )


async def team_lineups(
    db: AsyncSession,
    team: Team,
    settings: LeagueSettings,
    players: list[NFLPlayer],
    season: int,
    now: datetime,
) -> list[RoundLineup]:
    """All four rounds' lineups for a team; a round nobody has set is empty."""
    games = await load_games(db, season)
    specs = slot_layout(settings)
    placements = await _placements(db, team.id)
    return [_round_lineup(specs, players, games, placements[r], r, now) for r in ROUNDS]


async def move_in_lineup(
    db: AsyncSession,
    team: Team,
    settings: LeagueSettings,
    players: list[NFLPlayer],
    season: int,
    round_: int,
    player_id: int,
    slot_index: int | None,
    now: datetime,
) -> None:
    """Persist one legal move in a round's lineup; raises LineupError otherwise."""
    by_id = {p.id: p for p in players}
    if player_id not in by_id:
        raise LineupError("That player is not on your roster")
    games = await load_games(db, season)
    if player_id in _eliminated_ids(players, games, round_):
        raise LineupError("That player's team has been eliminated")
    specs = slot_layout(settings)
    stored = (await _placements(db, team.id))[round_]
    placement: list[int | None] = [stored.get(i) for i in range(len(specs))]
    # A stale placement of an eliminated player is empty space, not a blocker.
    gone = _eliminated_ids(players, games, round_)
    placement = [None if pid in gone else pid for pid in placement]
    locked = {p.id for p in players if _view(p, games, round_, now).locked}
    moved = move_player(
        specs,
        placement,
        {p.id: PlayerPosition.from_str(p.position) for p in players},
        locked,
        player_id,
        slot_index,
    )
    await db.execute(
        delete(LineupSlot).where(
            LineupSlot.team_id == team.id, LineupSlot.round == round_
        )
    )
    await db.flush()
    db.add_all(
        LineupSlot(team_id=team.id, round=round_, player_id=pid, slot_index=index)
        for index, pid in enumerate(moved)
        if pid is not None
    )
    await db.flush()
