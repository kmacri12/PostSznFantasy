import pytest
from pydantic import ValidationError

from api.models.enums import PlayerPosition
from api.models.league_models import (
    LeagueCreate,
    RosterSettings,
    SeasonUpdate,
    TeamUnitSettings,
)


def test_team_qb_and_k_have_no_default() -> None:
    with pytest.raises(ValidationError):
        LeagueCreate(league_name="x")
    with pytest.raises(ValidationError):
        TeamUnitSettings(team_qb=True)
    with pytest.raises(ValidationError):
        TeamUnitSettings(team_qb=True, team_k="yes")


def test_new_league_defaults() -> None:
    create = LeagueCreate(
        league_name="x",
        team_unit_settings=TeamUnitSettings(team_qb=False, team_k=False),
    )
    roster = create.roster_settings
    assert create.time_per_pick_seconds == 90
    assert roster.number_teams == 6
    assert roster.roster_total == 18
    assert (roster.roster_num_qb, roster.roster_num_rb, roster.roster_num_wr) == (
        1,
        2,
        2,
    )
    assert (roster.roster_num_te, roster.roster_num_flex_wr_rb_te) == (1, 1)
    assert (roster.roster_num_k, roster.roster_num_dst, roster.roster_num_bench) == (
        1,
        1,
        9,
    )
    assert (roster.roster_max_qb, roster.roster_max_k, roster.roster_max_dst) == (
        2,
        2,
        2,
    )
    assert roster.roster_max_rb >= roster.roster_total
    assert roster.roster_max_wr >= roster.roster_total
    assert roster.roster_max_te >= roster.roster_total


@pytest.mark.parametrize("teams", [1, 15])
def test_league_size_is_two_to_fourteen(teams: int) -> None:
    with pytest.raises(ValidationError):
        RosterSettings(number_teams=teams)
    with pytest.raises(ValidationError):
        SeasonUpdate(number_teams=teams)


def test_fullback_means_running_back() -> None:
    assert PlayerPosition.from_str("FB") is PlayerPosition.RB


def test_create_league_roster_must_be_consistent() -> None:
    import pytest
    from pydantic import ValidationError

    from api.models.league_models import RosterSettingsInput

    assert RosterSettingsInput().roster_total == 18
    for bad in (
        {"roster_num_bench": 2_000_000_000},
        {"roster_total": 41},
        {"roster_total": 5},
        {"roster_max_qb": 0},
        {"roster_num_bench": -1},
    ):
        with pytest.raises(ValidationError):
            RosterSettingsInput(**bad)
