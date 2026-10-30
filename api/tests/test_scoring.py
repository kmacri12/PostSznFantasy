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

    # DST
    settings.scoring_dst_td = Decimal(6)
    settings.scoring_dst_sack = Decimal(1)
    settings.scoring_dst_safety = Decimal(2)
    settings.scoring_dst_fumble_recover = Decimal(2)
    settings.scoring_dst_interception = Decimal(2)
    settings.scoring_dst_pts_allowed_0 = Decimal(10)
    settings.scoring_dst_pts_allowed_1_13 = Decimal(4)
    settings.scoring_dst_pts_allowed_14_21 = Decimal(1)
    settings.scoring_dst_pts_allowed_22_28 = Decimal(-1)
    settings.scoring_dst_pts_allowed_29_plus = Decimal(-4)
    settings.scoring_dst_yards_allowed_under_100 = Decimal(5)
    settings.scoring_dst_yards_allowed_100_199 = Decimal(3)
    settings.scoring_dst_yards_allowed_200_299 = Decimal(2)
    settings.scoring_dst_yards_allowed_300_plus = Decimal(-1)

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
    st_pts = calculate_special_teams_points(stats, standard_league_settings)
    assert st_pts == Decimal(50)  # the return TD scores for the DST, not the returner


def test_calculate_kicking_points(standard_league_settings: LeagueSettings) -> None:
    standard_league_settings.scoring_kicking_fg_made = Decimal(0)
    standard_league_settings.scoring_kicking_fg_yard = Decimal("0.1")
    stats = NFLPlayerGameStats()
    stats.kicking_xp_made = 4
    stats.kicking_xp_missed = 1
    stats.kicking_fg_missed = 1
    stats.kicking_fg_yards_made = [25, 45, 52]

    # FG yards: (25 + 45 + 52) * 0.1 = 12.2; XP 4 - 1; FG miss -1 => 14.2
    pts = calculate_kicking_points(stats, standard_league_settings)
    assert pts == Decimal("14.2")


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
    # Points allowed 1-13: 4
    # Yards allowed 100-199: 3
    # Total = 6 + 4 + 2 + 2 + 4 + 4 + 3 = 25
    pts = calculate_dst_points(stats, standard_league_settings)
    assert pts == Decimal(25)


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


def _default_settings() -> LeagueSettings:
    template = ScoringSettings().model_dump(by_alias=False)
    return LeagueSettings(**{k: Decimal(str(v)) for k, v in template.items()})


def test_default_template_scores_full_ppr_stat_line() -> None:
    stats = NFLPlayerGameStats()
    stats.passing_yards = 250
    stats.passing_touchdowns = 2
    stats.passing_interceptions = 1
    stats.rushing_yards = 30
    stats.rushing_touchdowns = 1
    stats.receiving_receptions = 5
    stats.receiving_yards = 60
    stats.carrying_fumbles_lost = 1

    # 250*.04 + 2*4 - 2 + 30*.1 + 6 + 5*1 + 60*.1 - 2 = 10+8-2+3+6+5+6-2 = 34
    pts = calculate_player_points(stats, _default_settings(), PlayerPosition.RB)
    assert pts == Decimal(34)


def test_default_template_matches_product_rules() -> None:
    d = ScoringSettings()
    assert (d.scoring_passing_yard, d.scoring_passing_td) == (0.04, 4)
    assert d.scoring_passing_interception == -2
    assert (d.scoring_rushing_yard, d.scoring_rushing_td) == (0.1, 6)
    assert (d.scoring_receiving_yard, d.scoring_receiving_td) == (0.1, 6)
    assert d.scoring_receiving_reception == 1
    assert d.scoring_carrying_fumble_lost == -2
    assert d.scoring_passing_2pt == d.scoring_rushing_2pt == 2
    assert d.scoring_receiving_2pt == 2
    # Everything else the old Sleeper template scored is off.
    zeros = [
        d.scoring_passing_completion,
        d.scoring_passing_attempt,
        d.scoring_passing_sack,
        d.scoring_passing_bonus_300_yards,
        d.scoring_passing_bonus_400_yards,
        d.scoring_rushing_attempt,
        d.scoring_rushing_bonus_100_yards,
        d.scoring_rushing_bonus_200_yards,
        d.scoring_receiving_target,
        d.scoring_receiving_bonus_100_yards,
        d.scoring_receiving_bonus_200_yards,
        d.scoring_carrying_fumble,
    ]
    assert all(value == 0 for value in zeros)


def test_default_kicker_scores_per_yard() -> None:
    settings = _default_settings()
    kicker = NFLPlayerGameStats()
    kicker.kicking_fg_yards_made = [34]
    assert calculate_kicking_points(kicker, settings) == Decimal("3.4")

    kicker.kicking_xp_made = 2
    kicker.kicking_xp_missed = 1
    kicker.kicking_fg_missed = 1
    # 3.4 + 2 - 1 - 1 = 3.4
    assert calculate_kicking_points(kicker, settings) == Decimal("3.4")

    kicker.kicking_fg_yards_made = [25, 45, 52]
    kicker.kicking_xp_missed = 0
    kicker.kicking_fg_missed = 0
    # (25 + 45 + 52) * .1 + 2 = 14.2
    assert calculate_kicking_points(kicker, settings) == Decimal("14.2")


def test_season_rows_cannot_score_a_kicker_by_distance() -> None:
    kicker = NFLPlayerGameStats()
    kicker.kicking_fg_made = 11
    kicker.kicking_fg_yards_made = []
    assert calculate_kicking_points(kicker, _default_settings()) == Decimal(0)


def _dst_stats(points_allowed: int, yards_allowed: int) -> NFLPlayerGameStats:
    stats = NFLPlayerGameStats()
    stats.dst_points_allowed = points_allowed
    stats.dst_yards_allowed = yards_allowed
    return stats


@pytest.mark.parametrize(
    ("points_allowed", "expected"),
    [
        (0, 7),
        (1, 5),
        (13, 5),
        (14, 3),
        (21, 3),
        (22, 1),
        (28, 1),
        (29, 0),
        (60, 0),
    ],
)
def test_default_dst_points_allowed_band_edges(
    points_allowed: int, expected: int
) -> None:
    pts = calculate_dst_points(_dst_stats(points_allowed, 400), _default_settings())
    assert pts == Decimal(expected)


@pytest.mark.parametrize(
    ("yards_allowed", "expected"),
    [(0, 6), (99, 6), (100, 4), (199, 4), (200, 2), (299, 2), (300, 0), (550, 0)],
)
def test_default_dst_yards_allowed_band_edges(
    yards_allowed: int, expected: int
) -> None:
    pts = calculate_dst_points(_dst_stats(40, yards_allowed), _default_settings())
    assert pts == Decimal(expected)


def test_default_dst_event_values() -> None:
    stats = _dst_stats(40, 400)
    stats.dst_sacks = 3
    stats.dst_interceptions = 2
    stats.dst_fumbles_recovered = 1
    stats.dst_safeties = 1
    stats.dst_def_td = 2
    stats.dst_two_point_returns = 1
    # 3 + 2 + 1 + 2 + 12 + 2 = 22
    assert calculate_dst_points(stats, _default_settings()) == Decimal(22)


def test_default_dst_hand_calculated_game() -> None:
    stats = _dst_stats(23, 288)
    stats.dst_sacks = 4
    stats.dst_interceptions = 1
    stats.dst_fumbles_recovered = 1
    stats.dst_def_td = 1
    # 1 (23 allowed is 22-28) + 2 (200-299) + 4 + 1 + 1 + 6 = 15
    assert calculate_player_points(
        stats, _default_settings(), PlayerPosition.DST
    ) == Decimal(15)


def test_return_tds_never_score_for_the_individual() -> None:
    returner = NFLPlayerGameStats()
    returner.kick_return_td = 1
    returner.punt_return_td = 1
    returner.receiving_receptions = 2
    returner.receiving_yards = 20
    # Only the 2 receptions and 20 yards count: 2 + 2 = 4
    pts = calculate_player_points(returner, _default_settings(), PlayerPosition.WR)
    assert pts == Decimal(4)


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
    from api.models.league_models import PostseasonSettings, RosterSettings

    columns = {c.key for c in LeagueSettings.__table__.columns}
    declared = (
        set(RosterSettings.model_fields)
        | set(ScoringSettings.model_fields)
        | set(PostseasonSettings.model_fields)
    )
    assert declared <= columns
    assert columns - declared == {"id", "league_id"}


@pytest.mark.parametrize(
    ("week", "expected"),
    [(1, 1), (2, 1.5), (3, 2), (4, 3), (19, 1), (22, 3), (7, 1), (0, 1)],
)
def test_round_multiplier_maps_postseason_weeks(week: int, expected: float) -> None:
    from api.utils.calculations.standings_utils import round_multiplier

    settings = LeagueSettings()
    settings.multiplier_wild_card = Decimal(1)
    settings.multiplier_divisional = Decimal("1.5")
    settings.multiplier_conference = Decimal(2)
    settings.multiplier_super_bowl = Decimal(3)
    assert round_multiplier(settings, week) == Decimal(str(expected))


def test_defense_scoring_only_applies_to_defenses(
    standard_league_settings: LeagueSettings,
) -> None:
    """A QB row has 0 points allowed; it must not earn the shutout bonus."""
    stats = NFLPlayerGameStats()
    stats.dst_points_allowed = 0
    assert calculate_player_points(stats, standard_league_settings, "QB") == Decimal(0)
    assert calculate_player_points(stats, standard_league_settings, "DST") == Decimal(
        10
    )


def test_season_kicking_points_use_flat_rate_for_count_without_distances(
    standard_league_settings: LeagueSettings,
) -> None:
    stats = NFLPlayerGameStats()
    stats.kicking_fg_made = 11
    stats.kicking_fg_yards_made = []

    assert calculate_kicking_points(stats, standard_league_settings) == Decimal(33)
