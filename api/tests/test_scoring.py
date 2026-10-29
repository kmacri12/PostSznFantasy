from decimal import Decimal

import pytest
from api.db.models.league import LeagueSettings
from api.db.models.nfl import NFLPlayerGameStats
from api.models.enums import PlayerPosition
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
    settings.scoring_passing_yard = 1  # 1 pt per 25 yds -> usually integer, let's say 1 per unit or 0.04 in real or whatever int is in model
    settings.scoring_passing_td = 4
    settings.scoring_passing_2pt = 2
    settings.scoring_passing_interception = -2
    settings.scoring_passing_completion = 0
    settings.scoring_passing_attempt = 0
    settings.scoring_passing_sack = -1

    # Rushing
    settings.scoring_rushing_yard = 1
    settings.scoring_rushing_td = 6
    settings.scoring_rushing_2pt = 2
    settings.scoring_rushing_attempt = 0

    # Receiving
    settings.scoring_receiving_reception = 1  # PPR
    settings.scoring_receiving_yard = 1
    settings.scoring_receiving_td = 6
    settings.scoring_receiving_2pt = 2
    settings.scoring_receiving_target = 0
    settings.scoring_receiving_reception_bonus_rb = 0
    settings.scoring_receiving_reception_bonus_wr = 0
    settings.scoring_receiving_reception_bonus_te = 1  # TE Premium (+1 pt)

    # Fumbles
    settings.scoring_carrying_fumble = -1
    settings.scoring_carrying_fumble_lost = -2

    # Kicking
    settings.scoring_kicking_xp_made = 1
    settings.scoring_kicking_xp_miss = -1
    settings.scoring_kicking_fg_miss = -1
    settings.scoring_kicking_fg_made = 3
    settings.scoring_kicking_fg_yard = 0
    settings.scoring_kicking_fg_made_0_19 = 0
    settings.scoring_kicking_fg_made_20_29 = 0
    settings.scoring_kicking_fg_made_30_39 = 0
    settings.scoring_kicking_fg_made_40_49 = 1
    settings.scoring_kicking_fg_made_50_plus = 2

    # DST
    settings.scoring_dst_td = 6
    settings.scoring_dst_sack = 1
    settings.scoring_dst_safety = 2
    settings.scoring_dst_fumble_recover = 2
    settings.scoring_dst_interception = 2
    settings.scoring_dst_pts_allowed_0 = 10
    settings.scoring_dst_pts_allowed_1_6 = 7
    settings.scoring_dst_pts_allowed_7_13 = 4
    settings.scoring_dst_pts_allowed_14_20 = 1
    settings.scoring_dst_pts_allowed_21_27 = 0
    settings.scoring_dst_pts_allowed_28_34 = -1
    settings.scoring_dst_pts_allowed_35_plus = -4
    settings.scoring_dst_yards_allowed_under_100 = 5
    settings.scoring_dst_yards_allowed_100_199 = 3
    settings.scoring_dst_yards_allowed_200_299 = 2
    settings.scoring_dst_yards_allowed_300_399 = 0
    settings.scoring_dst_yards_allowed_400_499 = -1
    settings.scoring_dst_yards_allowed_500_plus = -3

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
    standard_league_settings.scoring_special_punt_return_yard = 1
    standard_league_settings.scoring_special_punt_return_td = 6
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
