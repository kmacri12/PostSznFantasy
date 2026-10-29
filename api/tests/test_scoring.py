from decimal import Decimal

import pytest

from api.db.models.league import LeagueSettings
from api.db.models.nfl import NFLPlayerGameStats
from api.models.enums import PlayerPosition
from api.models.league_models import ScoringSettings
from api.utils.calculations.fantasy_points_utils import (
    calculate_dst_points,
    calculate_kicking_points,
    calculate_passing_points,
    calculate_player_points,
    calculate_receiving_points,
    calculate_rushing_points,
    calculate_special_teams_points,
    calculate_turnover_points,
)


@pytest.fixture
def standard_league_settings() -> LeagueSettings:
    settings = LeagueSettings()
    # Passing
    settings.scoring_passing_yard = Decimal(1)
    settings.scoring_passing_td = Decimal(4)
    settings.scoring_passing_2pt = Decimal(2)
    settings.scoring_passing_interception = Decimal(-2)
    settings.scoring_passing_completion = Decimal(0)
    settings.scoring_passing_attempt = Decimal(0)
    settings.scoring_passing_sack = Decimal(-1)

    # Rushing
    settings.scoring_rushing_yard = Decimal(1)
    settings.scoring_rushing_td = Decimal(6)
    settings.scoring_rushing_2pt = Decimal(2)
    settings.scoring_rushing_attempt = Decimal(0)

    # Receiving
    settings.scoring_receiving_reception = Decimal(1)  # PPR
    settings.scoring_receiving_yard = Decimal(1)
    settings.scoring_receiving_td = Decimal(6)
    settings.scoring_receiving_2pt = Decimal(2)
    settings.scoring_receiving_target = Decimal(0)
    settings.scoring_receiving_reception_bonus_rb = Decimal(0)
    settings.scoring_receiving_reception_bonus_wr = Decimal(0)
    settings.scoring_receiving_reception_bonus_te = Decimal(1)  # TE Premium (+1 pt)

    # Fumbles
    settings.scoring_carrying_fumble = Decimal(-1)
    settings.scoring_carrying_fumble_lost = Decimal(-2)

    # Kicking
    settings.scoring_kicking_xp_made = Decimal(1)
    settings.scoring_kicking_xp_miss = Decimal(-1)
    settings.scoring_kicking_fg_miss = Decimal(-1)
    settings.scoring_kicking_fg_made = Decimal(3)
    settings.scoring_kicking_fg_yard = Decimal(0)
    settings.scoring_kicking_fg_made_0_19 = Decimal(0)
    settings.scoring_kicking_fg_made_20_29 = Decimal(0)
    settings.scoring_kicking_fg_made_30_39 = Decimal(0)
    settings.scoring_kicking_fg_made_40_49 = Decimal(1)
    settings.scoring_kicking_fg_made_50_plus = Decimal(2)

    # DST
    settings.scoring_dst_td = Decimal(6)
    settings.scoring_dst_sack = Decimal(1)
    settings.scoring_dst_safety = Decimal(2)
    settings.scoring_dst_fumble_recover = Decimal(2)
    settings.scoring_dst_interception = Decimal(2)
    settings.scoring_dst_pts_allowed_0 = Decimal(10)
    settings.scoring_dst_pts_allowed_1_6 = Decimal(7)
    settings.scoring_dst_pts_allowed_7_13 = Decimal(4)
    settings.scoring_dst_pts_allowed_14_20 = Decimal(1)
    settings.scoring_dst_pts_allowed_21_27 = Decimal(0)
    settings.scoring_dst_pts_allowed_28_34 = Decimal(-1)
    settings.scoring_dst_pts_allowed_35_plus = Decimal(-4)
    settings.scoring_dst_yards_allowed_under_100 = Decimal(5)
    settings.scoring_dst_yards_allowed_100_199 = Decimal(3)
    settings.scoring_dst_yards_allowed_200_299 = Decimal(2)
    settings.scoring_dst_yards_allowed_300_399 = Decimal(0)
    settings.scoring_dst_yards_allowed_400_499 = Decimal(-1)
    settings.scoring_dst_yards_allowed_500_plus = Decimal(-3)

    return settings


def test_calculate_passing_points(standard_league_settings: LeagueSettings) -> None:
    stats = NFLPlayerGameStats()
    stats.passing_yards = 300
    stats.passing_touchdowns = 3
    stats.passing_two_point_conversions = 1
    stats.passing_interceptions = 1
    stats.passing_sacked = 2

    # 300*1 + 3*4 + 1*2 + 1*(-2) + 2*(-1) = 300 + 12 + 2 - 2 - 2 = 310
    pts = calculate_passing_points(stats, standard_league_settings)
    assert pts == Decimal(310)


def test_calculate_rushing_points(standard_league_settings: LeagueSettings) -> None:
    stats = NFLPlayerGameStats()
    stats.rushing_yards = 120
    stats.rushing_touchdowns = 2
    stats.rushing_two_point_conversions = 0
    stats.rushing_carries = 20

    # 120*1 + 2*6 = 132
    pts = calculate_rushing_points(stats, standard_league_settings)
    assert pts == Decimal(132)


def test_calculate_receiving_points_te_premium(
    standard_league_settings: LeagueSettings,
) -> None:
    stats = NFLPlayerGameStats()
    stats.receiving_receptions = 6
    stats.receiving_yards = 80
    stats.receiving_touchdowns = 1
    stats.receiving_two_point_conversions = 0

    # For WR: rec 6*1 + yds 80*1 + td 1*6 = 92
    wr_pts = calculate_receiving_points(
        stats, standard_league_settings, PlayerPosition.WR
    )
    assert wr_pts == Decimal(92)

    # For TE with +1 bonus: 92 + 6*1 = 98
    te_pts = calculate_receiving_points(
        stats, standard_league_settings, PlayerPosition.TE
    )
    assert te_pts == Decimal(98)


def test_calculate_turnover_and_special_teams_points(
    standard_league_settings: LeagueSettings,
) -> None:
    stats = NFLPlayerGameStats()
    stats.carrying_fumbles = 2
    stats.carrying_fumbles_lost = 1
    # 2*(-1) + 1*(-2) = -4
    turnover_pts = calculate_turnover_points(stats, standard_league_settings)
    assert turnover_pts == Decimal(-4)

    stats.punt_return_yards = 50
    stats.punt_return_td = 1
    standard_league_settings.scoring_special_punt_return_yard = Decimal(1)
    standard_league_settings.scoring_special_punt_return_td = Decimal(6)
    st_pts = calculate_special_teams_points(stats, standard_league_settings)
    assert st_pts == Decimal(56)


def test_calculate_kicking_points(standard_league_settings: LeagueSettings) -> None:
    stats = NFLPlayerGameStats()
    stats.kicking_xp_made = 4
    stats.kicking_xp_missed = 1
    stats.kicking_fg_missed = 1
    stats.kicking_fg_yards_made = [25, 45, 52]

    # XP made: 4*1 = 4
    # XP missed: 1*(-1) = -1
    # FG miss: 1*(-1) = -1
    # FG made base: 3*3 = 9
    # FG 25 yds bonus: 0
    # FG 45 yds bonus: 1
    # FG 52 yds bonus: 2
    # Total = 4 - 1 - 1 + 9 + 0 + 1 + 2 = 14
    pts = calculate_kicking_points(stats, standard_league_settings)
    assert pts == Decimal(14)


def test_calculate_dst_points(standard_league_settings: LeagueSettings) -> None:
    stats = NFLPlayerGameStats()
    stats.dst_def_td = 1
    stats.dst_sacks = 4
    stats.dst_safeties = 1
    stats.dst_fumbles_recovered = 1
    stats.dst_interceptions = 2
    stats.dst_points_allowed = 6
    stats.dst_yards_allowed = 180

    # TD: 6
    # Sacks: 4*1 = 4
    # Safeties: 1*2 = 2
    # Fumbles: 1*2 = 2
    # INTs: 2*2 = 4
    # Points allowed <=6: 7
    # Yards allowed 100-199: 3
    # Total = 6 + 4 + 2 + 2 + 4 + 7 + 3 = 28
    pts = calculate_dst_points(stats, standard_league_settings)
    assert pts == Decimal(28)


def test_calculate_player_points_total(
    standard_league_settings: LeagueSettings,
) -> None:
    stats = NFLPlayerGameStats()
    stats.rushing_yards = 50
    stats.rushing_touchdowns = 1
    stats.receiving_receptions = 3
    stats.receiving_yards = 30
    stats.carrying_fumbles = 1
    stats.carrying_fumbles_lost = 1

    # Rush: 50 + 6 = 56
    # Rec (RB): 3*1 + 30*1 = 33
    # Turnovers: 1*(-1) + 1*(-2) = -3
    # Total = 56 + 33 - 3 = 86
    pts = calculate_player_points(stats, standard_league_settings, PlayerPosition.RB)
    assert pts == Decimal(86)


def test_default_template_scores_sleeper_ppr_stat_line() -> None:
    template = ScoringSettings().model_dump(by_alias=False)
    settings = LeagueSettings(**{k: Decimal(str(v)) for k, v in template.items()})

    stats = NFLPlayerGameStats()
    stats.passing_yards = 250
    stats.passing_touchdowns = 2
    stats.passing_interceptions = 1
    stats.rushing_yards = 30
    stats.rushing_touchdowns = 1
    stats.receiving_receptions = 5
    stats.receiving_yards = 60
    stats.carrying_fumbles_lost = 1

    # 250*.04 + 2*4 - 1 + 30*.1 + 6 + 5*1 + 60*.1 - 2 = 10+8-1+3+6+5+6-2 = 35
    pts = calculate_player_points(stats, settings, PlayerPosition.RB)
    assert pts == Decimal(35)


def test_default_template_dst_and_kicker() -> None:
    template = ScoringSettings().model_dump(by_alias=False)
    settings = LeagueSettings(**{k: Decimal(str(v)) for k, v in template.items()})

    dst = NFLPlayerGameStats()
    dst.dst_points_allowed = 10
    dst.dst_sacks = 3
    dst.dst_interceptions = 1
    dst.dst_yards_allowed = 250
    # 4 (7-13 pts) + 3 + 2 + 0 (yards bands default to 0) = 9
    assert calculate_dst_points(dst, settings) == Decimal(9)

    kicker = NFLPlayerGameStats()
    kicker.kicking_fg_yards_made = [25, 45, 52]
    kicker.kicking_xp_made = 2
    # 3 + 4 + 5 + 2 = 14
    assert calculate_kicking_points(kicker, settings) == Decimal(14)


def test_yardage_bonuses_stack_at_each_threshold(
    standard_league_settings: LeagueSettings,
) -> None:
    standard_league_settings.scoring_passing_bonus_300_yards = Decimal(3)
    standard_league_settings.scoring_passing_bonus_400_yards = Decimal(2)
    standard_league_settings.scoring_rushing_bonus_100_yards = Decimal(3)
    standard_league_settings.scoring_rushing_bonus_200_yards = Decimal(2)
    standard_league_settings.scoring_receiving_bonus_100_yards = Decimal(3)
    standard_league_settings.scoring_receiving_bonus_200_yards = Decimal(2)

    stats = NFLPlayerGameStats()
    stats.passing_yards = 299
    stats.rushing_yards = 99
    stats.receiving_yards = 99
    assert calculate_passing_points(stats, standard_league_settings) == Decimal(299)
    assert calculate_rushing_points(stats, standard_league_settings) == Decimal(99)
    assert calculate_receiving_points(
        stats, standard_league_settings, PlayerPosition.WR
    ) == Decimal(99)

    stats.passing_yards = 300
    stats.rushing_yards = 100
    stats.receiving_yards = 100
    assert calculate_passing_points(stats, standard_league_settings) == Decimal(303)
    assert calculate_rushing_points(stats, standard_league_settings) == Decimal(103)
    assert calculate_receiving_points(
        stats, standard_league_settings, PlayerPosition.WR
    ) == Decimal(103)

    stats.passing_yards = 400
    stats.rushing_yards = 200
    stats.receiving_yards = 200
    assert calculate_passing_points(stats, standard_league_settings) == Decimal(405)
    assert calculate_rushing_points(stats, standard_league_settings) == Decimal(205)
    assert calculate_receiving_points(
        stats, standard_league_settings, PlayerPosition.WR
    ) == Decimal(205)


def test_fg_miss_penalties_apply_per_missed_length(
    standard_league_settings: LeagueSettings,
) -> None:
    standard_league_settings.scoring_kicking_fg_miss = Decimal(0)
    standard_league_settings.scoring_kicking_fg_miss_0_19 = Decimal(-4)
    standard_league_settings.scoring_kicking_fg_miss_20_29 = Decimal(-3)
    standard_league_settings.scoring_kicking_fg_miss_30_39 = Decimal(-2)
    standard_league_settings.scoring_kicking_fg_miss_40_49 = Decimal(-1)
    standard_league_settings.scoring_kicking_fg_miss_50_plus = Decimal(0)

    stats = NFLPlayerGameStats()
    stats.kicking_fg_yards_missed = [19, 25, 39, 40, 55]
    assert calculate_kicking_points(stats, standard_league_settings) == Decimal(-10)


def test_dst_blocked_kick_and_two_point_return(
    standard_league_settings: LeagueSettings,
) -> None:
    standard_league_settings.scoring_dst_blocked_kick = Decimal(2)
    standard_league_settings.scoring_dst_two_point_return = Decimal(2)

    stats = NFLPlayerGameStats()
    stats.dst_blocked_kicks = 2
    stats.dst_two_point_returns = 1
    assert calculate_dst_points(stats, standard_league_settings) == Decimal(6)


def test_orm_settings_columns_match_pydantic_schemas() -> None:
    from api.models.league_models import RosterSettings

    columns = {c.key for c in LeagueSettings.__table__.columns}
    declared = set(RosterSettings.model_fields) | set(ScoringSettings.model_fields)
    assert declared <= columns
    assert columns - declared == {"id", "league_id"}
