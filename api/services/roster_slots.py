from dataclasses import dataclass

from api.db.models.league import LeagueSettings
from api.models.enums import PlayerPosition

# Slot name -> positions that may fill it.
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


@dataclass(frozen=True)
class SlotSpec:
    slot: str
    allowed: tuple[PlayerPosition, ...] | None  # None: any position (bench)


def slot_layout(settings: LeagueSettings) -> list[SlotSpec]:
    """The empty roster template implied by the league's roster settings."""
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


def assign_players(
    specs: list[SlotSpec],
    players: list[tuple[int, PlayerPosition | None]],
    preferred: dict[int, int] | None = None,
) -> list[int | None]:
    """Place explicit (drag-and-drop) choices first, then fill dedicated slots, flex, bench.

    `players` is (player_id, position) in roster order; `preferred` maps a player id to
    the slot index the owner chose. Choices that are no longer valid are ignored.
    Extra players beyond the layout are dropped (callers show them separately).
    """
    filled: list[int | None] = [None] * len(specs)
    remaining = list(players)
    for candidate in list(remaining):
        index = (preferred or {}).get(candidate[0])
        if (
            index is not None
            and 0 <= index < len(specs)
            and filled[index] is None
            and _eligible(specs[index], candidate[1])
        ):
            filled[index] = candidate[0]
            remaining.remove(candidate)

    def pass_over(match_specific: bool) -> None:
        for index, spec in enumerate(specs):
            if filled[index] is not None or spec.allowed is None:
                continue
            if (len(spec.allowed) == 1) != match_specific:
                continue
            for candidate in remaining:
                if candidate[1] in spec.allowed:
                    filled[index] = candidate[0]
                    remaining.remove(candidate)
                    break

    pass_over(match_specific=True)
    pass_over(match_specific=False)
    for index, spec in enumerate(specs):
        if spec.allowed is None and filled[index] is None and remaining:
            filled[index] = remaining.pop(0)[0]
    return filled


class LineupError(Exception):
    """The requested move isn't allowed; the message is safe to show to the owner."""


def move_player(
    specs: list[SlotSpec],
    placement: list[int | None],
    positions: dict[int, PlayerPosition | None],
    player_id: int,
    target: int,
) -> list[int | None]:
    """Move a player to `target`; the displaced player takes the mover's old slot if eligible."""
    if not 0 <= target < len(specs):
        raise LineupError("That slot doesn't exist")
    if not _eligible(specs[target], positions.get(player_id)):
        raise LineupError(
            f"A {positions.get(player_id)} can't play {specs[target].slot}"
        )
    result = list(placement)
    old = result.index(player_id) if player_id in result else None
    if old == target:
        return result
    occupant = result[target]
    result[target] = player_id
    if old is not None:
        result[old] = None
    if occupant is not None:
        if old is not None and _eligible(specs[old], positions.get(occupant)):
            result[old] = occupant
        else:
            free_bench = next(
                (
                    i
                    for i, spec in enumerate(specs)
                    if spec.allowed is None and result[i] is None
                ),
                None,
            )
            if free_bench is None:
                raise LineupError("No open bench spot for the displaced player")
            result[free_bench] = occupant
    return result
