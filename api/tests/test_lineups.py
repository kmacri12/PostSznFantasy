import pytest

from api.models.enums import PlayerPosition as P
from api.models.enums import PlayerRoundStatus
from api.models.league_models import LineupPlayer
from api.services.lineups import (
    LineupError,
    SlotSpec,
    bench_order,
    eliminated_order,
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


def test_two_starters_trade_slots_in_one_move() -> None:
    # RB at RB and RB at FLEX: moving the RB into FLEX sends the FLEX RB to the RB slot.
    assert move([1, 2, 3, None, None], 2, 2) == [1, 3, 2, None, None]


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


def test_bench_and_eliminated_sort_by_lineup_position_then_name() -> None:
    def player(pid: int, name: str, position: str) -> LineupPlayer:
        return LineupPlayer(
            id=pid,
            name=name,
            position=position,
            status=PlayerRoundStatus.ALIVE,
            is_active=True,
            locked=False,
        )

    players = [
        player(1, "Zed", "DST"),
        player(2, "Bo", "WR"),
        player(3, "Al", "K"),
        player(4, "Cy", "QB"),
        player(5, "Ann", "WR"),
        player(6, "Di", "TE"),
        player(7, "Ed", "RB"),
    ]
    assert [p.name for p in sorted(players, key=bench_order)] == [
        "Cy",
        "Ed",
        "Ann",
        "Bo",
        "Di",
        "Al",
        "Zed",
    ]


def test_eliminated_sort_latest_round_first_then_position_and_name() -> None:
    def player(name: str, position: str, round_: int) -> LineupPlayer:
        return LineupPlayer(
            id=1,
            name=name,
            position=position,
            status=PlayerRoundStatus.ELIMINATED,
            is_active=True,
            locked=False,
            eliminated_round=round_,
        )

    players = [
        player("Zed", "WR", 1),
        player("Bo", "WR", 2),
        player("Ann", "WR", 2),
        player("Cy", "QB", 2),
        player("Di", "K", 3),
    ]
    assert [p.name for p in sorted(players, key=eliminated_order)] == [
        "Di",
        "Cy",
        "Ann",
        "Bo",
        "Zed",
    ]
