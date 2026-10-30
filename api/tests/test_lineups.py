import pytest

from api.models.enums import PlayerPosition as P
from api.services.lineups import LineupError, SlotSpec, move_player

SPECS = [
    SlotSpec("QB", (P.QB,)),
    SlotSpec("RB", (P.RB,)),
    SlotSpec("FLEX", (P.RB, P.WR, P.TE)),
    SlotSpec("BENCH", None),
    SlotSpec("BENCH", None),
]
POS: dict[int, P | None] = {1: P.QB, 2: P.RB, 3: P.RB, 4: P.WR}


def move(
    placement: list[int | None],
    player: int,
    target: int | None,
    locked: set[int] | None = None,
) -> list[int | None]:
    return move_player(SPECS, placement, POS, locked or set(), player, target)


def test_unassigned_player_takes_an_empty_slot() -> None:
    assert move([None] * 5, 2, 1) == [None, 2, None, None, None]


def test_move_swaps_with_the_occupant_when_both_fit() -> None:
    assert move([1, 2, 3, 4, None], 4, 2) == [1, 2, 4, 3, None]


def test_displaced_player_goes_to_an_open_bench_spot_when_old_slot_is_ineligible() -> (
    None
):
    assert move([1, 2, 3, None, None], 2, 3) == [1, None, 3, 2, None]


def test_displaced_player_becomes_unassigned_when_the_mover_was_unassigned() -> None:
    assert move([None, 2, None, None, None], 3, 1) == [None, 3, None, None, None]


def test_a_player_can_be_cleared_from_the_lineup() -> None:
    assert move([1, 2, None, None, None], 2, None) == [1, None, None, None, None]


def test_ineligible_and_unknown_slots_are_rejected() -> None:
    with pytest.raises(LineupError, match="can't play"):
        move([None] * 5, 1, 1)
    with pytest.raises(LineupError, match="doesn't exist"):
        move([None] * 5, 1, 9)


def test_a_locked_mover_cannot_be_moved_or_cleared() -> None:
    with pytest.raises(LineupError, match="locked"):
        move([1, 2, None, None, None], 2, 2, locked={2})
    with pytest.raises(LineupError, match="locked"):
        move([1, 2, None, None, None], 2, None, locked={2})
    with pytest.raises(LineupError, match="locked"):
        move([None] * 5, 2, 1, locked={2})


def test_a_locked_occupant_cannot_be_displaced_by_an_unlocked_mover() -> None:
    with pytest.raises(LineupError, match="locked"):
        move([None, 2, None, 3, None], 3, 1, locked={2})


def test_locked_bench_player_cannot_be_swapped_out() -> None:
    with pytest.raises(LineupError, match="locked"):
        move([None, 2, None, 3, None], 2, 3, locked={3})


def test_unlocked_players_move_freely_next_to_locked_ones() -> None:
    assert move([1, 2, 3, None, None], 3, 4, locked={2}) == [1, 2, None, None, 3]
