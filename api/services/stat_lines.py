"""One-line summary of a player's game stats for the team page ("14/21, 168 yds, 2 TD")."""

from collections.abc import Sequence

from api.db.models.nfl import NFLPlayerGameStats
from api.models.enums import PlayerPosition


def _total(rows: Sequence[NFLPlayerGameStats], field: str) -> int:
    return sum(getattr(row, field) or 0 for row in rows)


def _count(value: int, label: str) -> str | None:
    return f"{value} {label}" if value else None


def _joined(parts: Sequence[str | None], separator: str = ", ") -> str:
    return separator.join(part for part in parts if part)


def _rushing(rows: Sequence[NFLPlayerGameStats], always: bool) -> str:
    carries = _total(rows, "rushing_carries")
    if not carries and not always:
        return ""
    return _joined(
        [
            f"{carries} car",
            f"{_total(rows, 'rushing_yards')} yds",
            _count(_total(rows, "rushing_touchdowns"), "TD"),
        ]
    )


def _receiving(rows: Sequence[NFLPlayerGameStats], always: bool) -> str:
    receptions = _total(rows, "receiving_receptions")
    if not receptions and not always:
        return ""
    return _joined(
        [
            f"{receptions} rec",
            f"{_total(rows, 'receiving_yards')} yds",
            _count(_total(rows, "receiving_touchdowns"), "TD"),
        ]
    )


def _passing(rows: Sequence[NFLPlayerGameStats]) -> str:
    rushing_yards = _total(rows, "rushing_yards")
    passing = (
        f"{_total(rows, 'passing_completions')}/{_total(rows, 'passing_attempts')}, "
        f"{_total(rows, 'passing_yards')} yds, "
        f"{_total(rows, 'passing_touchdowns')} TD, "
        f"{_total(rows, 'passing_interceptions')} INT"
    )
    if _total(rows, "rushing_carries") and rushing_yards:
        return f"{passing} · {rushing_yards} rush yds"
    return passing


def _kicking(rows: Sequence[NFLPlayerGameStats]) -> str:
    made, missed = _total(rows, "kicking_fg_made"), _total(rows, "kicking_fg_missed")
    xp_made, xp_missed = (
        _total(rows, "kicking_xp_made"),
        _total(rows, "kicking_xp_missed"),
    )
    return f"{made}/{made + missed} FG, {xp_made}/{xp_made + xp_missed} XP"


def _defense(rows: Sequence[NFLPlayerGameStats]) -> str:
    plays = _joined(
        [
            _count(_total(rows, "dst_sacks"), "sacks"),
            _count(_total(rows, "dst_interceptions"), "INT"),
            _count(_total(rows, "dst_fumbles_recovered"), "FR"),
            _count(_total(rows, "dst_def_td"), "TD"),
            _count(_total(rows, "dst_safeties"), "safety"),
        ]
    )
    allowed = f"{_total(rows, 'dst_points_allowed')} pts allowed"
    return _joined([plays, allowed], " · ")


def stat_line(
    rows: Sequence[NFLPlayerGameStats], position: PlayerPosition | None
) -> str | None:
    """The line for one round; None when the player has no stats that round.

    `rows` is every game row feeding the slot (a team QB / team K sums its unit).
    """
    if not rows or position is None:
        return None
    match position:
        case PlayerPosition.QB:
            return _passing(rows)
        case PlayerPosition.K:
            return _kicking(rows)
        case PlayerPosition.DST:
            return _defense(rows)
        case PlayerPosition.RB:
            return _joined(
                [_rushing(rows, always=True), _receiving(rows, always=False)], " · "
            )
        case PlayerPosition.WR | PlayerPosition.TE:
            return _joined(
                [_receiving(rows, always=True), _rushing(rows, always=False)], " · "
            )
