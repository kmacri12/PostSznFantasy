import pytest

from api.models.enums import PlayerPosition as P
from api.services.roster_slots import (
    LineupError,
    SlotSpec,
    assign_players,
    move_player,
)

SPECS = [
    SlotSpec("QB", (P.QB,)),
    SlotSpec("RB", (P.RB,)),
    SlotSpec("FLEX", (P.RB, P.WR, P.TE)),
    SlotSpec("BENCH", None),
    SlotSpec("BENCH", None),
]
POS: dict[int, P | None] = {1: P.QB, 2: P.RB, 3: P.RB, 4: P.WR}


def test_explicit_choices_beat_auto_placement() -> None:
    players: list[tuple[int, P | None]] = [(2, P.RB), (3, P.RB)]
    assert assign_players(SPECS, players) == [None, 2, 3, None, None]
    # Owner benched player 2 and started player 3 at RB.
    assert assign_players(SPECS, players, {2: 3, 3: 1}) == [None, 3, None, 2, None]


def test_invalid_preferences_are_ignored() -> None:
    placed = assign_players(SPECS, [(1, P.QB)], {1: 1})  # a QB can't take RB
    assert placed == [1, None, None, None, None]


def test_move_swaps_with_the_occupant_when_both_fit() -> None:
    placement = [1, 2, 3, 4, None]
    assert move_player(SPECS, placement, POS, 4, 2) == [1, 2, 4, 3, None]


def test_displaced_player_goes_to_the_bench_when_the_old_slot_is_ineligible() -> None:
    placement = [1, 2, None, 3, None]
    # Bench RB #3 starts at RB; RB #2 takes the bench spot the mover left.
    assert move_player(SPECS, placement, POS, 3, 1) == [1, 3, None, 2, None]
    # A QB's slot can't take an RB, so the displaced QB lands on an open bench spot.
    placement = [1, 2, 3, None, None]
    assert move_player(SPECS, placement, POS, 2, 3) == [1, None, 3, 2, None]


def test_ineligible_target_and_full_bench_are_rejected() -> None:
    with pytest.raises(LineupError, match="can't play"):
        move_player(SPECS, [1, 2, 3, None, None], POS, 1, 1)
    full = [SlotSpec("QB", (P.QB,)), SlotSpec("RB", (P.RB,)), SlotSpec("BENCH", None)]
    with pytest.raises(LineupError, match="No open bench"):
        # RB starter moves to the bench... the bench occupant (a QB) can't take RB.
        move_player(full, [1, 2, 3], {1: P.QB, 2: P.RB, 3: P.QB}, 2, 2)
    with pytest.raises(LineupError, match="doesn't exist"):
        move_player(SPECS, [1, None, None, None, None], POS, 1, 9)
