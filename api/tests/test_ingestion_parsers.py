import json
from pathlib import Path
from typing import Any

import pytest

from api.services.ingestion.box_scores_ingest import (
    normalise_game_status,
    parse_game_player_stats,
)
from api.services.ingestion.schemas import (
    POSTSEASON_WEEKS,
    StatsShapeError,
    field_goal_yards_by_kicker,
    field_goal_yards_missed_by_kicker,
    parse_injury_status,
    parse_stat_line,
    safe_int,
)
from api.services.ingestion.season_stats_ingest import (
    ensure_stats_shape,
    parse_player_season_stats,
)

FIXTURES = Path(__file__).parent / "fixtures"


def load(name: str) -> Any:
    return json.loads((FIXTURES / name).read_text())["body"]


def roster_player(name: str) -> dict[str, Any]:
    return next(
        p for p in load("team_roster_stats.json")["roster"] if p["longName"] == name
    )


def test_safe_int_accepts_float_strings() -> None:
    assert safe_int("124.0") == 124
    assert safe_int(None) == 0
    assert safe_int("n/a") == 0


def test_roster_stats_parse_from_nested_shape() -> None:
    row = parse_player_season_stats(roster_player("Patrick Mahomes"), "2026")
    assert row is not None
    assert row["season"] == "2026"
    assert row["player_id"] == 3139477
    assert row["passing_yards"] == 1474
    assert row["passing_completions"] == 124
    assert row["passing_touchdowns"] == 9
    assert row["passing_interceptions"] == 4
    assert row["rushing_yards"] == 71
    assert row["carrying_fumbles"] == 1


def test_roster_kicker_derives_misses() -> None:
    row = parse_player_season_stats(roster_player("Harrison Butker"), "2026")
    assert row is not None
    assert row["kicking_fg_made"] == 11
    assert row["kicking_fg_missed"] == 5
    assert row["kicking_xp_made"] == 14
    assert row["kicking_xp_missed"] == 1


def test_player_without_stats_gets_zero_row() -> None:
    bare = {"playerID": "42", "stats": {}}
    row = parse_player_season_stats(bare, "2026")
    assert row is not None
    assert row["passing_yards"] == 0
    assert row["kicking_fg_made"] == 0


def test_flat_legacy_shape_is_rejected() -> None:
    flat = [{"playerID": "1", "stats": {"PassingYds": "300", "PassingTD": "2"}}]
    assert parse_stat_line(flat[0]["stats"]) is None
    with pytest.raises(StatsShapeError):
        ensure_stats_shape(flat)


def test_real_roster_passes_shape_guard() -> None:
    ensure_stats_shape(load("team_roster_stats.json")["roster"])


def test_box_score_player_rows() -> None:
    box = load("box_score_lar_car.json")
    ids = {int(pid) for pid in box["playerStats"]}
    rows = {r["player_id"]: r for r in parse_game_player_stats(box["gameID"], box, ids)}

    stafford = rows[12483]
    assert stafford["passing_yards"] == 304
    assert stafford["passing_sacked"] == 1
    assert stafford["passing_sacked_yards"] == 9

    mevis = rows[4574716]
    assert mevis["kicking_fg_made"] == 2
    assert mevis["kicking_xp_made"] == 4
    assert mevis["kicking_fg_missed"] == 0
    assert mevis["kicking_fg_yards_made"] == [46, 42]

    # Snap-count-only entries (linemen) don't get zero rows.
    assert len(rows) == 3


def test_field_goal_yards_group_by_kicker() -> None:
    plays = load("box_score_lar_car.json")["scoringPlays"]
    assert field_goal_yards_by_kicker(plays) == {
        4574716: [46, 42],
        4568263: [46],
    }


def test_missed_field_goal_yards_come_from_play_by_play() -> None:
    # 2026-01-25 NE@DEN: Lutz missed 54 (wide right) and had a 45 blocked; Borregales
    # missed 63 and 46 and made a 23 (made kicks are not misses).
    box = load("box_score_ne_den_kicks.json")
    assert field_goal_yards_missed_by_kicker(box["allPlayByPlay"]) == {
        2985659: [54, 45],
        4569923: [63, 46],
    }
    assert field_goal_yards_missed_by_kicker(None) == {}


def test_game_stat_rows_carry_missed_field_goal_yards() -> None:
    box = load("box_score_ne_den_kicks.json")
    rows = {
        row["player_id"]: row
        for row in parse_game_player_stats("G", box, {2985659, 4569923})
    }
    assert rows[2985659]["kicking_fg_yards_missed"] == [54, 45]
    assert rows[2985659]["kicking_fg_missed"] == 2
    assert rows[4569923]["kicking_fg_yards_missed"] == [63, 46]
    assert rows[4569923]["kicking_fg_yards_made"] == [23]


def test_postseason_weeks_cover_rounds_19_to_22() -> None:
    assert sorted(POSTSEASON_WEEKS.values()) == [19, 20, 21, 22]
    assert POSTSEASON_WEEKS["Super Bowl"] == 22


def test_game_status_normalised() -> None:
    assert normalise_game_status("Final") == "Completed"
    assert normalise_game_status("Completed") == "Completed"
    assert normalise_game_status("Scheduled") == "Scheduled"


@pytest.mark.parametrize(
    ("injury", "expected"),
    [
        ({"designation": "Questionable"}, "Questionable"),
        ({"designation": " doubtful "}, "Doubtful"),
        ({"designation": "OUT"}, "Out"),
        ({"designation": "Injured Reserve"}, "Injured Reserve"),
        ({"designation": "Injured Reserve - Designated to Return"}, "Injured Reserve"),
        ({"designation": ""}, None),
        ({"designation": "Suspended"}, None),
        ({}, None),
        ("", None),
        (None, None),
    ],
)
def test_injury_status_keeps_only_the_four_game_day_tags(
    injury: Any, expected: str | None
) -> None:
    assert parse_injury_status(injury) == expected
