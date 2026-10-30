"""Shared parsing for Tank01 player stat blocks (see docs/rapidapi-tank01.md).

Roster (`getNFLTeamRoster?getStats=true`) and box score (`getNFLBoxScore`) player stats
share one nested shape: `{"Passing": {"passYds": "1474.0"}, "Rushing": {...}, ...}`.
"""

import re
from typing import Any


class StatsShapeError(ValueError):
    """The upstream stats payload no longer matches the shape the mappers expect."""


# Weeks 19-22 match `round_multiplier` in utils/calculations/standings_utils.py.
POSTSEASON_WEEKS = {
    "Wild Card": 19,
    "Divisional Round": 20,
    "Conference Championship": 21,
    "Super Bowl": 22,
}

STAT_CATEGORIES = frozenset(
    {"Passing", "Rushing", "Receiving", "Defense", "Kicking", "Punting"}
)

# column -> (category, key). Keys marked box-only are absent from roster stats and
# simply resolve to 0 there.
STAT_FIELDS: dict[str, tuple[str, str]] = {
    "passing_completions": ("Passing", "passCompletions"),
    "passing_attempts": ("Passing", "passAttempts"),
    "passing_yards": ("Passing", "passYds"),
    "passing_touchdowns": ("Passing", "passTD"),
    "passing_interceptions": ("Passing", "int"),
    "passing_two_point_conversions": ("Passing", "passingTwoPointConversion"),
    "rushing_carries": ("Rushing", "carries"),
    "rushing_yards": ("Rushing", "rushYds"),
    "rushing_touchdowns": ("Rushing", "rushTD"),
    "rushing_long_rush": ("Rushing", "longRush"),  # box-only
    "rushing_two_point_conversions": ("Rushing", "rushingTwoPointConversion"),
    "receiving_receptions": ("Receiving", "receptions"),
    "receiving_targets": ("Receiving", "targets"),
    "receiving_yards": ("Receiving", "recYds"),
    "receiving_touchdowns": ("Receiving", "recTD"),
    "receiving_long_reception": ("Receiving", "longRec"),  # box-only
    "receiving_two_point_conversions": ("Receiving", "receivingTwoPointConversion"),
    "carrying_fumbles": ("Defense", "fumbles"),
    "carrying_fumbles_lost": ("Defense", "fumblesLost"),
    "punt_return_yards": ("Punting", "puntReturnYds"),  # box-only
    "punt_return_td": ("Punting", "puntReturnTD"),  # box-only
    "kick_return_yards": ("Kicking", "kickReturnYds"),  # box-only
    "kick_return_td": ("Kicking", "kickReturnTD"),  # box-only
    "kicking_xp_made": ("Kicking", "xpMade"),
    "kicking_fg_made": ("Kicking", "fgMade"),
}

# Derived columns are included so a player with no stats still gets a complete zero row.
STAT_COLUMNS = (
    *STAT_FIELDS,
    "passing_sacked",
    "passing_sacked_yards",
    "kicking_xp_missed",
    "kicking_fg_missed",
)

_FIELD_GOAL_YARDS = re.compile(r"(\d+) Yd Field Goal")


def safe_int(val: Any, default: int = 0) -> int:
    """Tank01 numbers are strings like "124.0"; go through float to accept them."""
    try:
        return int(float(val)) if val is not None else default
    except (TypeError, ValueError):
        return default


def safe_str(val: Any) -> str | None:
    if val is None:
        return None
    s = str(val).strip()
    return s if s else None


def normalise_position(raw: Any) -> str | None:
    """Fullbacks are running backs everywhere in the app."""
    position = safe_str(raw)
    return "RB" if position == "FB" else position


def empty_stat_line() -> dict[str, int]:
    return dict.fromkeys(STAT_COLUMNS, 0)


def _category(stats: dict[str, Any], name: str) -> dict[str, Any]:
    block = stats.get(name)
    return block if isinstance(block, dict) else {}


def _sacked(passing: dict[str, Any]) -> tuple[int, int]:
    """Box scores report "times-yards", e.g. "1-9"."""
    times, _, yards = str(passing.get("sacked", "")).partition("-")
    return safe_int(times), safe_int(yards)


def _missed(
    kicking: dict[str, Any], missed_key: str, attempts_key: str, made_key: str
) -> int:
    if missed_key in kicking:
        return safe_int(kicking[missed_key])
    return max(safe_int(kicking.get(attempts_key)) - safe_int(kicking.get(made_key)), 0)


def parse_stat_line(stats: Any) -> dict[str, int] | None:
    """Map a nested stat block to DB columns; None if it has no known category."""
    if not isinstance(stats, dict) or not STAT_CATEGORIES.intersection(stats):
        return None

    line = {
        column: safe_int(_category(stats, category).get(key))
        for column, (category, key) in STAT_FIELDS.items()
    }
    line["passing_sacked"], line["passing_sacked_yards"] = _sacked(
        _category(stats, "Passing")
    )
    kicking = _category(stats, "Kicking")
    line["kicking_xp_missed"] = _missed(kicking, "xpMissed", "xpAttempts", "xpMade")
    line["kicking_fg_missed"] = _missed(kicking, "fgMissed", "fgAttempts", "fgMade")
    return line


def field_goal_yards_by_kicker(scoring_plays: Any) -> dict[int, list[int]]:
    """Made-FG distances per kicker id; box scores have no per-kick list, only these plays."""
    yards_by_kicker: dict[int, list[int]] = {}
    for play in scoring_plays or []:
        if play.get("scoreType") != "FG" or not play.get("playerIDs"):
            continue
        match = _FIELD_GOAL_YARDS.search(str(play.get("score", "")))
        kicker_id = safe_int(play["playerIDs"][0])
        if match and kicker_id:
            yards_by_kicker.setdefault(kicker_id, []).append(int(match.group(1)))
    return yards_by_kicker


# The depth-chart list that names each unit's starter: QB1 and PK1 (kickers are PK).
DEPTH_CHART_STARTERS = {"QB": ("QB1", "QB"), "PK": ("PK1", "K")}


def parse_depth_chart_starters(body: Any) -> list[dict[str, Any]]:
    """The QB1 and PK1 of each team in a `getNFLDepthCharts` body, as starter rows.

    Teams or positions without a usable first entry are skipped; the starter
    resolver falls back to season stats for them.
    """
    rows: list[dict[str, Any]] = []
    for team in body if isinstance(body, list) else []:
        team_id = safe_int(team.get("teamID")) if isinstance(team, dict) else 0
        depth_chart = team.get("depthChart") if team_id else None
        if not isinstance(depth_chart, dict):
            continue
        for list_name, (depth_position, position) in DEPTH_CHART_STARTERS.items():
            entries = depth_chart.get(list_name)
            for entry in entries if isinstance(entries, list) else []:
                player_id = (
                    safe_int(entry.get("playerID")) if isinstance(entry, dict) else 0
                )
                if player_id and entry.get("depthPosition") == depth_position:
                    rows.append(
                        {
                            "team_id": team_id,
                            "position": position,
                            "player_id": player_id,
                        }
                    )
                    break
    return rows
