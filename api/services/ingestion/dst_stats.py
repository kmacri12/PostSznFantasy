"""Per-team, per-game DST stat rows from a box score (docs/research/dst-per-team-stats.md).

A DST is a synthetic player whose id is the negated NFL team id, so it never collides
with an ESPN player id and drafts, rosters and standings treat it like any other player.
"""

from typing import Any

from api.services.ingestion.schemas import empty_stat_line, safe_int

DST_STAT_COLUMNS = (
    "dst_yards_allowed",
    "dst_points_allowed",
    "dst_sacks",
    "dst_def_td",
    "dst_safeties",
    "dst_fumbles_recovered",
    "dst_interceptions",
    "dst_blocked_punts",
    "dst_blocked_field_goals",
    "dst_blocked_extra_points",
    "dst_two_point_returns",
)

# Real-game points, not the league's `scoring_dst_td`.
POINTS_PER_TOUCHDOWN = 6


def dst_player_id(team_id: int) -> int:
    return -team_id


def empty_dst_columns() -> dict[str, int]:
    return dict.fromkeys(DST_STAT_COLUMNS, 0)


def _by_team_id(section: Any) -> dict[int, dict[str, Any]]:
    sides = section.values() if isinstance(section, dict) else []
    return {
        safe_int(side.get("teamID")): side for side in sides if isinstance(side, dict)
    }


def _final_scores(box: dict[str, Any]) -> dict[int, int]:
    return {
        safe_int(box.get("teamIDHome")): safe_int(box.get("homePts")),
        safe_int(box.get("teamIDAway")): safe_int(box.get("awayPts")),
    }


def _has_scores(box: dict[str, Any]) -> bool:
    # A game that has not kicked off reports blank scores and zeroed team stats, which
    # would otherwise score as a shutout holding the opponent to 0 yards.
    return all(str(box.get(key) or "").strip() for key in ("homePts", "awayPts"))


def parse_dst_stat_rows(
    game_id: str, box: dict[str, Any], valid_player_ids: set[int]
) -> list[dict[str, Any]]:
    if not _has_scores(box):
        return []
    team_stats = _by_team_id(box.get("teamStats"))
    dst = _by_team_id(box.get("DST"))
    scores = _final_scores(box)
    rows: list[dict[str, Any]] = []
    for team_id, own in team_stats.items():
        opponent_id = next((other for other in team_stats if other != team_id), None)
        if opponent_id is None or dst_player_id(team_id) not in valid_player_ids:
            continue
        opponent = team_stats[opponent_id]
        own_dst = dst.get(team_id, {})
        # Points the opponent's own defense or special teams scored were not given up
        # by this defense.
        points_allowed = scores.get(opponent_id, 0) - POINTS_PER_TOUCHDOWN * safe_int(
            opponent.get("defensiveOrSpecialTeamsTds")
        )
        rows.append(
            {
                "game_id": game_id,
                "player_id": dst_player_id(team_id),
                **empty_stat_line(),
                "kicking_fg_yards_made": [],
                "kicking_fg_yards_missed": [],
                **empty_dst_columns(),
                "dst_yards_allowed": safe_int(opponent.get("totalYards")),
                "dst_points_allowed": max(points_allowed, 0),
                "dst_sacks": safe_int(own_dst.get("sacks")),
                "dst_interceptions": safe_int(own_dst.get("defensiveInterceptions")),
                "dst_fumbles_recovered": safe_int(opponent.get("fumblesLost")),
                "dst_def_td": safe_int(own.get("defensiveOrSpecialTeamsTds")),
                "dst_safeties": safe_int(own_dst.get("safeties")),
                "dst_blocked_punts": safe_int(own.get("blockedPunt")),
                "dst_blocked_field_goals": safe_int(own.get("blockedFG")),
                "dst_blocked_extra_points": safe_int(own.get("blockedXP")),
                "dst_two_point_returns": safe_int(
                    own.get("defensiveTwoPointConversionReturns")
                ),
            }
        )
    return rows
