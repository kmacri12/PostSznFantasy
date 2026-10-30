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
    "dst_two_point_returns",
)

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


def _safeties_by_team(scoring_plays: Any) -> dict[int, int]:
    counts: dict[int, int] = {}
    for play in scoring_plays or []:
        if play.get("scoreType") == "SF":
            team_id = safe_int(play.get("teamID"))
            counts[team_id] = counts.get(team_id, 0) + 1
    return counts


def parse_dst_stat_rows(
    game_id: str, box: dict[str, Any], valid_player_ids: set[int]
) -> list[dict[str, Any]]:
    team_stats = _by_team_id(box.get("teamStats"))
    dst = _by_team_id(box.get("DST"))
    scores = _final_scores(box)
    safeties = _safeties_by_team(box.get("scoringPlays"))
    rows: list[dict[str, Any]] = []
    for team_id, own in team_stats.items():
        opponent_id = next((other for other in team_stats if other != team_id), None)
        if opponent_id is None or dst_player_id(team_id) not in valid_player_ids:
            continue
        opponent = team_stats[opponent_id]
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
                **empty_dst_columns(),
                "dst_yards_allowed": safe_int(opponent.get("totalYards")),
                "dst_points_allowed": max(points_allowed, 0),
                "dst_sacks": safe_int(dst.get(team_id, {}).get("sacks")),
                "dst_interceptions": safe_int(
                    dst.get(team_id, {}).get("defensiveInterceptions")
                ),
                "dst_fumbles_recovered": safe_int(opponent.get("fumblesLost")),
                "dst_def_td": safe_int(own.get("defensiveOrSpecialTeamsTds")),
                "dst_safeties": safeties.get(team_id, 0),
                "dst_two_point_returns": safe_int(
                    own.get("defensiveTwoPointConversionReturns")
                ),
            }
        )
    return rows
