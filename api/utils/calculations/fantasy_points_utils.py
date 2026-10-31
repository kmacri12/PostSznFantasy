from decimal import Decimal

from api.db.models.league import LeagueSettings
from api.db.models.nfl import NFLPlayerGameStats, NFLPlayerSeasonStats
from api.models.enums import PlayerPosition


def _safe(val: Decimal | float | None) -> Decimal:
    # str() keeps float rates like 0.04 exact instead of Decimal(0.04)'s binary expansion.
    return Decimal(str(val)) if val is not None else Decimal(0)


def _dst_pts_allowed_bonus(pts: int | None, settings: LeagueSettings) -> Decimal:
    if pts is None:
        return Decimal(0)
    if pts == 0:
        return _safe(settings.scoring_dst_pts_allowed_0)
    if pts <= 13:
        return _safe(settings.scoring_dst_pts_allowed_1_13)
    if pts <= 21:
        return _safe(settings.scoring_dst_pts_allowed_14_21)
    if pts <= 28:
        return _safe(settings.scoring_dst_pts_allowed_22_28)
    return _safe(settings.scoring_dst_pts_allowed_29_plus)


def _dst_yards_allowed_bonus(yards: int | None, settings: LeagueSettings) -> Decimal:
    if yards is None:
        return Decimal(0)
    if yards < 100:
        return _safe(settings.scoring_dst_yards_allowed_under_100)
    if yards < 200:
        return _safe(settings.scoring_dst_yards_allowed_100_199)
    if yards < 300:
        return _safe(settings.scoring_dst_yards_allowed_200_299)
    return _safe(settings.scoring_dst_yards_allowed_300_plus)


def _yardage_bonus(
    yards: int | None, lower: Decimal, upper: Decimal, thresholds: tuple[int, int]
) -> Decimal:
    # Thresholds stack: a 400-yard passer earns both the 300 and the 400 bonus.
    total = _safe(yards)
    low, high = thresholds
    return (lower if total >= low else Decimal(0)) + (
        upper if total >= high else Decimal(0)
    )


def calculate_passing_points(
    stats: NFLPlayerGameStats, settings: LeagueSettings
) -> Decimal:
    return (
        _safe(stats.passing_yards) * _safe(settings.scoring_passing_yard)
        + _safe(stats.passing_touchdowns) * _safe(settings.scoring_passing_td)
        + _safe(stats.passing_two_point_conversions)
        * _safe(settings.scoring_passing_2pt)
        + _safe(stats.passing_interceptions)
        * _safe(settings.scoring_passing_interception)
        + _safe(stats.passing_completions) * _safe(settings.scoring_passing_completion)
        + _safe(stats.passing_attempts) * _safe(settings.scoring_passing_attempt)
        + _safe(stats.passing_sacked) * _safe(settings.scoring_passing_sack)
        + _yardage_bonus(
            stats.passing_yards,
            _safe(settings.scoring_passing_bonus_300_yards),
            _safe(settings.scoring_passing_bonus_400_yards),
            (300, 400),
        )
    )


def calculate_rushing_points(
    stats: NFLPlayerGameStats, settings: LeagueSettings
) -> Decimal:
    return (
        _safe(stats.rushing_yards) * _safe(settings.scoring_rushing_yard)
        + _safe(stats.rushing_touchdowns) * _safe(settings.scoring_rushing_td)
        + _safe(stats.rushing_two_point_conversions)
        * _safe(settings.scoring_rushing_2pt)
        + _safe(stats.rushing_carries) * _safe(settings.scoring_rushing_attempt)
        + _yardage_bonus(
            stats.rushing_yards,
            _safe(settings.scoring_rushing_bonus_100_yards),
            _safe(settings.scoring_rushing_bonus_200_yards),
            (100, 200),
        )
    )


def calculate_receiving_points(
    stats: NFLPlayerGameStats,
    settings: LeagueSettings,
    player_position: PlayerPosition | str | None,
) -> Decimal:
    points = (
        _safe(stats.receiving_receptions) * _safe(settings.scoring_receiving_reception)
        + _safe(stats.receiving_yards) * _safe(settings.scoring_receiving_yard)
        + _safe(stats.receiving_touchdowns) * _safe(settings.scoring_receiving_td)
        + _safe(stats.receiving_two_point_conversions)
        * _safe(settings.scoring_receiving_2pt)
        + _safe(stats.receiving_targets) * _safe(settings.scoring_receiving_target)
        + _yardage_bonus(
            stats.receiving_yards,
            _safe(settings.scoring_receiving_bonus_100_yards),
            _safe(settings.scoring_receiving_bonus_200_yards),
            (100, 200),
        )
    )

    pos = (
        player_position
        if isinstance(player_position, PlayerPosition)
        else PlayerPosition.from_str(player_position)
    )
    if pos == PlayerPosition.RB:
        points += _safe(stats.receiving_receptions) * _safe(
            settings.scoring_receiving_reception_bonus_rb
        )
    elif pos == PlayerPosition.WR:
        points += _safe(stats.receiving_receptions) * _safe(
            settings.scoring_receiving_reception_bonus_wr
        )
    elif pos == PlayerPosition.TE:
        points += _safe(stats.receiving_receptions) * _safe(
            settings.scoring_receiving_reception_bonus_te
        )

    return points


def calculate_turnover_points(
    stats: NFLPlayerGameStats, settings: LeagueSettings
) -> Decimal:
    return _safe(stats.carrying_fumbles) * _safe(
        settings.scoring_carrying_fumble
    ) + _safe(stats.carrying_fumbles_lost) * _safe(
        settings.scoring_carrying_fumble_lost
    )


def calculate_special_teams_points(
    stats: NFLPlayerGameStats, settings: LeagueSettings
) -> Decimal:
    # Return TDs are scored by the DST, never by the returner (product rules, section 5).
    return _safe(stats.punt_return_yards) * _safe(
        settings.scoring_special_punt_return_yard
    ) + _safe(stats.kick_return_yards) * _safe(
        settings.scoring_special_kick_return_yard
    )


def calculate_kicking_points(
    stats: NFLPlayerGameStats, settings: LeagueSettings
) -> Decimal:
    fg_yards: list[int] = stats.kicking_fg_yards_made or []
    flat_per_fg = _safe(settings.scoring_kicking_fg_made)
    # Season rows carry a made count but no distances, so they cannot earn per-yard points.
    missed_yards = Decimal(sum(stats.kicking_fg_yards_missed or []))
    made_without_distance = max((stats.kicking_fg_made or 0) - len(fg_yards), 0)
    return (
        _safe(stats.kicking_xp_made) * _safe(settings.scoring_kicking_xp_made)
        + _safe(stats.kicking_xp_missed) * _safe(settings.scoring_kicking_xp_miss)
        + _safe(stats.kicking_fg_missed) * _safe(settings.scoring_kicking_fg_miss)
        + flat_per_fg * (len(fg_yards) + made_without_distance)
        + Decimal(sum(fg_yards)) * _safe(settings.scoring_kicking_fg_yard)
        + missed_yards * _safe(settings.scoring_kicking_fg_miss_yard)
    )


def _blocked_kicks(stats: NFLPlayerGameStats) -> Decimal:
    # Stored by kind so the setting can be split later without re-ingesting.
    return (
        _safe(stats.dst_blocked_punts)
        + _safe(stats.dst_blocked_field_goals)
        + _safe(stats.dst_blocked_extra_points)
    )


def calculate_dst_points(
    stats: NFLPlayerGameStats, settings: LeagueSettings
) -> Decimal:
    return (
        _safe(stats.dst_def_td) * _safe(settings.scoring_dst_td)
        + _safe(stats.dst_sacks) * _safe(settings.scoring_dst_sack)
        + _safe(stats.dst_safeties) * _safe(settings.scoring_dst_safety)
        + _safe(stats.dst_fumbles_recovered)
        * _safe(settings.scoring_dst_fumble_recover)
        + _safe(stats.dst_interceptions) * _safe(settings.scoring_dst_interception)
        + _blocked_kicks(stats) * _safe(settings.scoring_dst_blocked_kick)
        + _safe(stats.dst_two_point_returns)
        * _safe(settings.scoring_dst_two_point_return)
        + _dst_pts_allowed_bonus(stats.dst_points_allowed, settings)
        + _dst_yards_allowed_bonus(stats.dst_yards_allowed, settings)
    )


def calculate_player_points(
    stats: NFLPlayerGameStats,
    settings: LeagueSettings,
    player_position: PlayerPosition | str | None,
) -> Decimal:
    """Return fantasy points for a single player game stat row under the given league settings.

    Scoring fields are decimal points-per-unit (or per-event), e.g. 0.04 per passing yard.
    None means the scoring category is disabled; treated as 0.
    """
    position = (
        player_position
        if isinstance(player_position, PlayerPosition)
        else PlayerPosition.from_str(player_position)
    )
    total = (
        calculate_passing_points(stats, settings)
        + calculate_rushing_points(stats, settings)
        + calculate_receiving_points(stats, settings, player_position)
        + calculate_turnover_points(stats, settings)
        + calculate_special_teams_points(stats, settings)
        + calculate_kicking_points(stats, settings)
    )
    # A non-defense row has 0 points allowed, which would otherwise earn the shutout bonus.
    if position == PlayerPosition.DST:
        total += calculate_dst_points(stats, settings)
    return total


_SHARED_STAT_COLUMNS = [
    column.key
    for column in NFLPlayerSeasonStats.__table__.columns
    if column.key in NFLPlayerGameStats.__table__.columns and column.key != "player_id"
]


def season_points(
    stats: NFLPlayerSeasonStats,
    settings: LeagueSettings,
    player_position: PlayerPosition | str | None,
) -> Decimal:
    """Fantasy points for a season-stat row, scored like a single game under `settings`."""
    view = NFLPlayerGameStats()
    for column in _SHARED_STAT_COLUMNS:
        setattr(view, column, getattr(stats, column))
    return calculate_player_points(view, settings, player_position)
