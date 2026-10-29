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


def assign_players(
    specs: list[SlotSpec], players: list[tuple[int, PlayerPosition | None]]
) -> list[int | None]:
    """Fill dedicated slots first, then flex, then bench; returns one entry per slot.

    `players` is (player_id, position) in roster order. Extra players beyond the
    layout are dropped from the result (callers show them separately).
    """
    filled: list[int | None] = [None] * len(specs)
    remaining = list(players)

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
