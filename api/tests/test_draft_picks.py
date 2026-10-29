import pytest

from api.db.models.league import LeagueSettings
from api.models.enums import PlayerPosition
from api.services.draft_picks import (
    DraftPickError,
    check_roster_limits,
    team_on_the_clock,
)


def order_for(draft_type: str, rounds: int = 4) -> list[int]:
    teams = [10, 20, 30]
    return [
        team_on_the_clock(teams, index, draft_type)
        for index in range(len(teams) * rounds)
    ]


def test_snake_order_reverses_odd_rounds() -> None:
    assert order_for("snake", 3) == [10, 20, 30, 30, 20, 10, 10, 20, 30]


def test_linear_order_repeats() -> None:
    assert order_for("linear", 2) == [10, 20, 30, 10, 20, 30]


def test_third_round_reversal_repeats_round_two_direction() -> None:
    assert order_for("third_round_reversal", 5) == [
        10, 20, 30,  # round 1
        30, 20, 10,  # round 2 (reversed)
        30, 20, 10,  # round 3 reverses the reversal: same direction as round 2
        10, 20, 30,  # round 4
        30, 20, 10,  # round 5
    ]  # fmt: skip


def make_settings(**overrides: int | None) -> LeagueSettings:
    settings = LeagueSettings()
    settings.roster_total = 3
    settings.roster_max_qb = 1
    settings.roster_max_rb = 99
    for key, value in overrides.items():
        setattr(settings, key, value)
    return settings


def test_roster_limits_reject_position_overflow() -> None:
    with pytest.raises(DraftPickError, match="QB"):
        check_roster_limits(make_settings(), [PlayerPosition.QB], PlayerPosition.QB)


def test_roster_limits_reject_full_roster() -> None:
    with pytest.raises(DraftPickError, match="full"):
        check_roster_limits(make_settings(), [PlayerPosition.RB] * 3, PlayerPosition.WR)


def test_roster_limits_allow_unlimited_position() -> None:
    check_roster_limits(make_settings(), [PlayerPosition.RB] * 2, PlayerPosition.RB)
