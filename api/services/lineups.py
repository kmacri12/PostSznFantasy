"""Per-round lineups: slot layout, legal moves and kickoff locks.

A lineup belongs to a fantasy team and a round and is empty until the owner places
players; nothing is copied between rounds or filled in automatically.
"""

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models.league import LineupSlot, SeasonSettings, Team
from api.db.models.nfl import NFLGame, NFLPlayer, NFLPlayerGameStats
from api.db.models.user import User
from api.models.activity_models import (
    CommissionerOverridePayload,
    DisplacedPlayer,
    LineupMovePayload,
    ScoreChange,
    SlotMark,
)
from api.models.enums import PlayerPosition, PlayerRoundStatus
from api.models.league_models import LineupPlayer, LineupSlotView, RoundLineup
from api.services import activity
from api.services.round_status import ROUNDS, GameFacts, load_games, round_status
from api.services.stat_lines import stat_line
from api.services.team_units import (
    combined_positions,
    scores_whole_team,
    scoring_members,
)
from api.utils.calculations.fantasy_points_utils import calculate_player_points
from api.utils.calculations.standings_utils import (
    ROUND_MULTIPLIER_FIELDS,
    postseason_round_index,
)

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


class OverrideConfirmationRequired(LineupError):
    """A commissioner's move would be an override and they haven't confirmed it."""

    def __init__(self) -> None:
        super().__init__(
            "That player is locked: their game has kicked off. This is a "
            "commissioner-only move and the league will be notified"
        )


@dataclass(frozen=True)
class LineupActor:
    user: User
    is_commissioner: bool
    # The commissioner agreed that a locked slot or past round may be changed.
    confirmed_override: bool = False


@dataclass(frozen=True)
class SlotSpec:
    slot: str
    allowed: tuple[PlayerPosition, ...] | None  # None: any position (bench)


def slot_layout(settings: SeasonSettings) -> list[SlotSpec]:
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
    player: NFLPlayer,
    games: list[GameFacts],
    round_: int,
    now: datetime,
    combined: frozenset[PlayerPosition] = frozenset(),
) -> LineupPlayer:
    standing = round_status(games, player.team_id, round_)
    return LineupPlayer(
        id=player.id,
        name=player.name or "",
        position=player.position or "",
        team_abv=player.team.team_abv if player.team else None,
        is_active=player.team.is_active if player.team else False,
        injury_status=player.injury_status,
        status=standing.status,
        kickoff=standing.kickoff,
        game_state=standing.game_state,
        game_clock=standing.game_clock,
        eliminated_round=standing.eliminated_in,
        locked=standing.kickoff is not None and now >= standing.kickoff,
        scores_whole_team=scores_whole_team(combined, player.position),
    )


def _eliminated_ids(
    players: list[NFLPlayer], games: list[GameFacts], round_: int
) -> set[int]:
    return {
        p.id
        for p in players
        if round_status(games, p.team_id, round_).status is PlayerRoundStatus.ELIMINATED
    }


def fillable_starter_slots(
    specs: list[SlotSpec],
    players: list[NFLPlayer],
    games: list[GameFacts],
    stored: dict[int, int],
    round_: int,
) -> int:
    """Empty starter slots the owner could still fill: capped by the players not yet placed."""
    eliminated = _eliminated_ids(players, games, round_)
    roster = {p.id for p in players}
    placed = {pid for pid in stored.values() if pid in roster and pid not in eliminated}
    placed_slots = {i for i, pid in stored.items() if pid in placed}
    empty = sum(
        1
        for i, spec in enumerate(specs)
        if spec.slot != BENCH and i not in placed_slots
    )
    return min(empty, len(roster - eliminated - placed))


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


def _visible_mark(
    mark: SlotMark | None, player: LineupPlayer | None
) -> SlotMark | None:
    """An override marker stays for good; the asterisk only while its player can move."""
    if mark is not None and mark.kind == "commissioner_set":
        return mark if player is not None and not player.locked else None
    return mark


def _round_lineup(
    specs: list[SlotSpec],
    players: list[NFLPlayer],
    games: list[GameFacts],
    stored: dict[int, int],
    round_: int,
    now: datetime,
    marks: dict[int, SlotMark],
    points: dict[int, Decimal],
    stat_lines: dict[int, str],
    changes: dict[int, ScoreChange],
    combined: frozenset[PlayerPosition],
) -> RoundLineup:
    views = {p.id: _view(p, games, round_, now, combined) for p in players}
    for pid, view in views.items():
        view.points = float(points[pid]) if pid in points else None
        view.stat_line = stat_lines.get(pid)
        view.score_change = changes.get(pid)
    # Eliminated players drop out of any slot they were placed in early.
    placed = {
        index: pid
        for index, pid in stored.items()
        if pid in views and views[pid].status is not PlayerRoundStatus.ELIMINATED
    }
    occupants = {index: views[pid] for index, pid in placed.items()}
    slots = [
        LineupSlotView(
            index=index,
            slot=spec.slot,
            player=occupants.get(index),
            mark=_visible_mark(marks.get(index), occupants.get(index)),
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
    settings: SeasonSettings,
    players: list[NFLPlayer],
    season: int,
    now: datetime,
) -> list[RoundLineup]:
    """All four rounds' lineups for a team; a round nobody has set is empty."""
    games = await load_games(db, season)
    specs = slot_layout(settings)
    placements = await _placements(db, team.id)
    marks = await activity.slot_marks(db, team.id)
    rows = await _round_rows(db, settings, players, season)
    points = _round_points(settings, players, rows)
    lines = _stat_lines(players, rows)
    changes = await activity.score_changes(db, team.id)
    return [
        _round_lineup(
            specs,
            players,
            games,
            placements[r],
            r,
            now,
            {index: mark for (round_, index), mark in marks.items() if round_ == r},
            {pid: pts for (pid, round_), pts in points.items() if round_ == r},
            {pid: line for (pid, round_), line in lines.items() if round_ == r},
            {
                pid: scaled_change(change, _multiplier(settings, r))
                for (pid, round_), change in changes.items()
                if round_ == r
            },
            combined_positions(settings),
        )
        for r in ROUNDS
    ]


def _multiplier(settings: SeasonSettings, round_: int) -> float:
    return float(getattr(settings, ROUND_MULTIPLIER_FIELDS[round_ - 1]))


def scaled_change(change: ScoreChange, multiplier: float) -> ScoreChange:
    """A correction in raw points, restated as counted points like the round's score."""
    return ScoreChange(
        previous_points=round(change.previous_points * multiplier, 2),
        new_points=round(change.new_points * multiplier, 2),
        changed_at=change.changed_at,
    )


# (rostered player id, round) -> the postseason game rows that score for the slot.
RoundRows = dict[tuple[int, int], list[NFLPlayerGameStats]]


async def _round_rows(
    db: AsyncSession,
    settings: SeasonSettings,
    players: list[NFLPlayer],
    season: int,
) -> RoundRows:
    """Each rostered player's game stats per round."""
    # A team QB / team K shows the whole unit's stats, as his slot scores them.
    members = await scoring_members(db, settings, players)
    feeds: dict[int, list[int]] = {}
    for rostered in players:
        for scorer_id in members.get(rostered.id, [rostered.id]):
            feeds.setdefault(scorer_id, []).append(rostered.id)
    rows = await db.execute(
        select(NFLPlayerGameStats, NFLGame.game_week)
        .join(NFLGame, NFLPlayerGameStats.game_id == NFLGame.id)
        .where(
            NFLPlayerGameStats.player_id.in_(feeds),
            NFLGame.season == season,
            NFLGame.season_type == "post",
            NFLGame.game_week.is_not(None),
        )
        .execution_options(populate_existing=True)
    )
    by_round: RoundRows = {}
    for stats, week in rows.all():
        index = postseason_round_index(week or 0)
        if index is None:
            continue
        for rostered_id in feeds[stats.player_id]:
            by_round.setdefault((rostered_id, index + 1), []).append(stats)
    return by_round


def _round_points(
    settings: SeasonSettings, players: list[NFLPlayer], rows: RoundRows
) -> dict[tuple[int, int], Decimal]:
    """Each rostered player's counted points per round: league scoring, round multiplier."""
    by_id = {p.id: p for p in players}
    points: dict[tuple[int, int], Decimal] = {}
    for (player_id, round_), game_rows in rows.items():
        position = PlayerPosition.from_str(by_id[player_id].position)
        raw = sum(
            (calculate_player_points(g, settings, position) for g in game_rows),
            Decimal(0),
        )
        points[(player_id, round_)] = (
            raw * Decimal(str(_multiplier(settings, round_)))
        ).quantize(Decimal("0.01"))
    return points


def _stat_lines(
    players: list[NFLPlayer], rows: RoundRows
) -> dict[tuple[int, int], str]:
    by_id = {p.id: p for p in players}
    lines = {
        key: stat_line(game_rows, PlayerPosition.from_str(by_id[key[0]].position))
        for key, game_rows in rows.items()
    }
    return {key: line for key, line in lines.items() if line}


async def move_in_lineup(
    db: AsyncSession,
    team: Team,
    settings: SeasonSettings,
    players: list[NFLPlayer],
    season: int,
    round_: int,
    player_id: int,
    slot_index: int | None,
    now: datetime,
    *,
    actor: LineupActor,
) -> None:
    """Persist one legal move in a round's lineup and record it in the activity feed.

    An owner may only move unlocked players. A commissioner may move anyone, but a
    move that touches a locked player (everyone with a game in a past round is) is an
    override and needs `confirmed_override`. Raises LineupError when not allowed.
    """
    by_id = {p.id: p for p in players}
    if player_id not in by_id:
        raise LineupError("That player is not on the roster")
    games = await load_games(db, season)
    eliminated = _eliminated_ids(players, games, round_)
    if player_id in eliminated:
        raise LineupError("That player's team has been eliminated")
    specs = slot_layout(settings)
    stored = (await _placements(db, team.id))[round_]
    placement: list[int | None] = [stored.get(i) for i in range(len(specs))]
    # A stale placement of an eliminated player is empty space, not a blocker.
    placement = [None if pid in eliminated else pid for pid in placement]
    locked = {p.id for p in players if _view(p, games, round_, now).locked}
    # The commissioner's lock check is the empty set; what the move touched decides
    # afterwards whether it was an override.
    moved = move_player(
        specs,
        placement,
        {p.id: PlayerPosition.from_str(p.position) for p in players},
        set() if actor.is_commissioner else locked,
        player_id,
        slot_index,
    )
    changed = [
        i
        for i, (was, now_) in enumerate(zip(placement, moved, strict=True))
        if was != now_
    ]
    is_override = actor.is_commissioner and _touches(placement, moved, changed, locked)
    if is_override and not actor.confirmed_override:
        raise OverrideConfirmationRequired()
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
    if changed:
        move = _move_payload(
            specs, placement, moved, changed, by_id, round_, player_id, slot_index
        )
        move_fields = move.model_dump(by_alias=False)
        if is_override:
            move_fields["by_commissioner"] = True
            payload: LineupMovePayload = CommissionerOverridePayload(**move_fields)
        else:
            move_fields["by_commissioner"] = (
                actor.is_commissioner and team.owner_id != actor.user.id
            )
            payload = LineupMovePayload(**move_fields)
        await activity.append(
            db,
            team.season_id,
            payload,
            team_id=team.id,
            actor=activity.Actor.of(actor.user),
            at=now,
        )


def _touches(
    before: list[int | None],
    after: list[int | None],
    changed: list[int],
    locked: set[int],
) -> bool:
    """Whether the move changed the slot of any locked player."""
    return any(
        pid in locked
        for i in changed
        for pid in (before[i], after[i])
        if pid is not None
    )


def _move_payload(
    specs: list[SlotSpec],
    before: list[int | None],
    after: list[int | None],
    changed: list[int],
    by_id: dict[int, NFLPlayer],
    round_: int,
    player_id: int,
    target: int | None,
) -> LineupMovePayload:
    def label(index: int | None) -> str | None:
        return specs[index].slot if index is not None else None

    def slot_of(placement: list[int | None], pid: int) -> int | None:
        return placement.index(pid) if pid in placement else None

    occupant = before[target] if target is not None else None
    displaced = (
        DisplacedPlayer(
            player_id=occupant,
            player_name=by_id[occupant].name or "",
            to_slot=label(slot_of(after, occupant)),
        )
        if occupant is not None and occupant != player_id
        else None
    )
    return LineupMovePayload(
        round=round_,
        player_id=player_id,
        player_name=by_id[player_id].name or "",
        from_slot=label(slot_of(before, player_id)),
        to_slot=label(target),
        displaced=displaced,
        changed_slots=changed,
    )
