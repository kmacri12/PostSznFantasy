"""The points of a stat row, one line per scoring stat ("17 rushing yards", 1.7).

Mirrors `fantasy_points_utils.calculate_player_points` line by line;
`tests/test_points_breakdown.py` checks the lines add up to it on every golden box score.
"""

from collections.abc import Iterable
from dataclasses import dataclass
from decimal import Decimal

from api.db.models.league import SeasonSettings
from api.db.models.nfl import NFLPlayerGameStats
from api.models.enums import PlayerPosition
from api.utils.calculations.fantasy_points_utils import (
    _blocked_kicks,
    _dst_pts_allowed_bonus,
    _dst_yards_allowed_bonus,
    _safe,
)

# key -> (singular, plural); a line reads "<count> <noun>", or the noun alone for a bonus.
_NOUNS: dict[str, tuple[str, str]] = {
    "passing_yards": ("passing yard", "passing yards"),
    "passing_td": ("passing TD", "passing TDs"),
    "passing_2pt": ("passing 2-pt conversion", "passing 2-pt conversions"),
    "passing_int": ("interception thrown", "interceptions thrown"),
    "passing_completions": ("completion", "completions"),
    "passing_attempts": ("pass attempt", "pass attempts"),
    "passing_sacked": ("time sacked", "times sacked"),
    "passing_bonus_300": ("300+ passing yard bonus", "300+ passing yard bonuses"),
    "passing_bonus_400": ("400+ passing yard bonus", "400+ passing yard bonuses"),
    "rushing_yards": ("rushing yard", "rushing yards"),
    "rushing_td": ("rushing TD", "rushing TDs"),
    "rushing_2pt": ("rushing 2-pt conversion", "rushing 2-pt conversions"),
    "rushing_carries": ("carry", "carries"),
    "rushing_bonus_100": ("100+ rushing yard bonus", "100+ rushing yard bonuses"),
    "rushing_bonus_200": ("200+ rushing yard bonus", "200+ rushing yard bonuses"),
    "receiving_receptions": ("reception", "receptions"),
    "receiving_yards": ("receiving yard", "receiving yards"),
    "receiving_td": ("receiving TD", "receiving TDs"),
    "receiving_2pt": ("receiving 2-pt conversion", "receiving 2-pt conversions"),
    "receiving_targets": ("target", "targets"),
    "receiving_bonus_100": ("100+ receiving yard bonus", "100+ receiving yard bonuses"),
    "receiving_bonus_200": ("200+ receiving yard bonus", "200+ receiving yard bonuses"),
    "reception_bonus": ("reception bonus", "reception bonuses"),
    "fumbles": ("fumble", "fumbles"),
    "fumbles_lost": ("fumble lost", "fumbles lost"),
    "punt_return_yards": ("punt return yard", "punt return yards"),
    "kick_return_yards": ("kick return yard", "kick return yards"),
    "xp_made": ("extra point", "extra points"),
    "xp_missed": ("missed extra point", "missed extra points"),
    "fg_missed": ("missed field goal", "missed field goals"),
    "fg_made": ("field goal", "field goals"),
    "fg_yards": ("field goal yard", "field goal yards"),
    "fg_missed_yards": ("missed field goal yard", "missed field goal yards"),
    "dst_td": ("defensive TD", "defensive TDs"),
    "dst_sacks": ("sack", "sacks"),
    "dst_safeties": ("safety", "safeties"),
    "dst_fumbles_recovered": ("fumble recovery", "fumble recoveries"),
    "dst_interceptions": ("interception", "interceptions"),
    "dst_blocked_kicks": ("blocked kick", "blocked kicks"),
    "dst_two_point_returns": ("2-pt return", "2-pt returns"),
    "dst_kick_return_td": ("kick return TD", "kick return TDs"),
    "dst_punt_return_td": ("punt return TD", "punt return TDs"),
    "dst_points_allowed": ("point allowed", "points allowed"),
    "dst_yards_allowed": ("yard allowed", "yards allowed"),
}

# A bonus line names the bonus, without a count in front ("300+ passing yard bonus").
_BONUSES = {key for key in _NOUNS if "bonus" in key}


@dataclass(frozen=True)
class BreakdownLine:
    label: str
    points: Decimal


def _item_points(
    stats: NFLPlayerGameStats,
    settings: SeasonSettings,
    position: PlayerPosition | None,
) -> list[tuple[str, Decimal, Decimal]]:
    """(key, count, points) for every scoring stat of one row, zeros included."""
    s = stats
    c = settings
    items: list[tuple[str, Decimal, Decimal]] = []

    def per(key: str, count: int | None, rate: float | Decimal | None) -> None:
        items.append((key, _safe(count), _safe(count) * _safe(rate)))

    def bonus(
        key: str, yards: int | None, threshold: int, rate: float | Decimal | None
    ) -> None:
        earned = _safe(yards) >= threshold
        items.append((key, Decimal(earned), _safe(rate) if earned else Decimal(0)))

    per("passing_yards", s.passing_yards, c.scoring_passing_yard)
    per("passing_td", s.passing_touchdowns, c.scoring_passing_td)
    per("passing_2pt", s.passing_two_point_conversions, c.scoring_passing_2pt)
    per("passing_int", s.passing_interceptions, c.scoring_passing_interception)
    per("passing_completions", s.passing_completions, c.scoring_passing_completion)
    per("passing_attempts", s.passing_attempts, c.scoring_passing_attempt)
    per("passing_sacked", s.passing_sacked, c.scoring_passing_sack)
    bonus("passing_bonus_300", s.passing_yards, 300, c.scoring_passing_bonus_300_yards)
    bonus("passing_bonus_400", s.passing_yards, 400, c.scoring_passing_bonus_400_yards)

    per("rushing_yards", s.rushing_yards, c.scoring_rushing_yard)
    per("rushing_td", s.rushing_touchdowns, c.scoring_rushing_td)
    per("rushing_2pt", s.rushing_two_point_conversions, c.scoring_rushing_2pt)
    per("rushing_carries", s.rushing_carries, c.scoring_rushing_attempt)
    bonus("rushing_bonus_100", s.rushing_yards, 100, c.scoring_rushing_bonus_100_yards)
    bonus("rushing_bonus_200", s.rushing_yards, 200, c.scoring_rushing_bonus_200_yards)

    per("receiving_receptions", s.receiving_receptions, c.scoring_receiving_reception)
    per("receiving_yards", s.receiving_yards, c.scoring_receiving_yard)
    per("receiving_td", s.receiving_touchdowns, c.scoring_receiving_td)
    per("receiving_2pt", s.receiving_two_point_conversions, c.scoring_receiving_2pt)
    per("receiving_targets", s.receiving_targets, c.scoring_receiving_target)
    bonus(
        "receiving_bonus_100",
        s.receiving_yards,
        100,
        c.scoring_receiving_bonus_100_yards,
    )
    bonus(
        "receiving_bonus_200",
        s.receiving_yards,
        200,
        c.scoring_receiving_bonus_200_yards,
    )
    reception_bonus = (
        {
            PlayerPosition.RB: c.scoring_receiving_reception_bonus_rb,
            PlayerPosition.WR: c.scoring_receiving_reception_bonus_wr,
            PlayerPosition.TE: c.scoring_receiving_reception_bonus_te,
        }.get(position)
        if position
        else None
    )
    per("reception_bonus", s.receiving_receptions, reception_bonus)

    per("fumbles", s.carrying_fumbles, c.scoring_carrying_fumble)
    per("fumbles_lost", s.carrying_fumbles_lost, c.scoring_carrying_fumble_lost)
    per("punt_return_yards", s.punt_return_yards, c.scoring_special_punt_return_yard)
    per("kick_return_yards", s.kick_return_yards, c.scoring_special_kick_return_yard)

    fg_yards: list[int] = s.kicking_fg_yards_made or []
    made_without_distance = max((s.kicking_fg_made or 0) - len(fg_yards), 0)
    per("xp_made", s.kicking_xp_made, c.scoring_kicking_xp_made)
    per("xp_missed", s.kicking_xp_missed, c.scoring_kicking_xp_miss)
    per("fg_missed", s.kicking_fg_missed, c.scoring_kicking_fg_miss)
    per("fg_made", len(fg_yards) + made_without_distance, c.scoring_kicking_fg_made)
    per("fg_yards", sum(fg_yards), c.scoring_kicking_fg_yard)
    per(
        "fg_missed_yards",
        sum(s.kicking_fg_yards_missed or []),
        c.scoring_kicking_fg_miss_yard,
    )

    # A non-defense row has 0 points allowed, which would otherwise earn the shutout.
    if position == PlayerPosition.DST:
        per("dst_td", s.dst_def_td, c.scoring_dst_td)
        per("dst_sacks", s.dst_sacks, c.scoring_dst_sack)
        per("dst_safeties", s.dst_safeties, c.scoring_dst_safety)
        per(
            "dst_fumbles_recovered",
            s.dst_fumbles_recovered,
            c.scoring_dst_fumble_recover,
        )
        per("dst_interceptions", s.dst_interceptions, c.scoring_dst_interception)
        blocked = _blocked_kicks(s)
        items.append(
            ("dst_blocked_kicks", blocked, blocked * _safe(c.scoring_dst_blocked_kick))
        )
        per(
            "dst_two_point_returns",
            s.dst_two_point_returns,
            c.scoring_dst_two_point_return,
        )
        per("dst_kick_return_td", s.dst_kick_return_td, c.scoring_dst_kick_return_td)
        per("dst_punt_return_td", s.dst_punt_return_td, c.scoring_dst_punt_return_td)
        if s.dst_points_allowed is not None:
            items.append(
                (
                    "dst_points_allowed",
                    _safe(s.dst_points_allowed),
                    _dst_pts_allowed_bonus(s.dst_points_allowed, c),
                )
            )
        if s.dst_yards_allowed is not None:
            items.append(
                (
                    "dst_yards_allowed",
                    _safe(s.dst_yards_allowed),
                    _dst_yards_allowed_bonus(s.dst_yards_allowed, c),
                )
            )
    return items


def _label(key: str, count: Decimal) -> str:
    singular, plural = _NOUNS[key]
    if key in _BONUSES:
        return singular if count == 1 else f"{plural} ×{count.normalize():f}"
    noun = singular if count == 1 else plural
    return f"{count.normalize():f} {noun}"


def points_breakdown(
    rows: Iterable[NFLPlayerGameStats],
    settings: SeasonSettings,
    position: PlayerPosition | str | None,
) -> list[BreakdownLine]:
    """The scoring lines of one or more stat rows (a team QB / K unit sums its members),
    in scoring order, leaving out what scored nothing. Raw points: no round multiplier."""
    pos = (
        position
        if isinstance(position, PlayerPosition)
        else PlayerPosition.from_str(position)
    )
    counts: dict[str, Decimal] = {}
    points: dict[str, Decimal] = {}
    for row in rows:
        for key, count, pts in _item_points(row, settings, pos):
            counts[key] = counts.get(key, Decimal(0)) + count
            points[key] = points.get(key, Decimal(0)) + pts
    return [
        BreakdownLine(_label(key, counts[key]), points[key])
        for key in counts
        if points[key] != 0
    ]
