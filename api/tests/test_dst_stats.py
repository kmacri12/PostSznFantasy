from typing import Any

from api.services.ingestion.dst_stats import dst_player_id, parse_dst_stat_rows

HOME, AWAY = 17, 19


def _team_stats(team_id: int, **overrides: str) -> dict[str, str]:
    return {
        "teamID": str(team_id),
        "totalYards": "300",
        "sacksAndYardsLost": "0-0",
        "interceptionsThrown": "0",
        "fumblesLost": "0",
        "safeties": "0",
        "defensiveOrSpecialTeamsTds": "0",
        "defensiveTwoPointConversionReturns": "0",
        **overrides,
    }


def _box(
    home_points: int = 20,
    away_points: int = 10,
    home: dict[str, str] | None = None,
    away: dict[str, str] | None = None,
    scoring_plays: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    return {
        "teamIDHome": str(HOME),
        "teamIDAway": str(AWAY),
        "homePts": str(home_points),
        "awayPts": str(away_points),
        "DST": {
            "home": {"teamID": str(HOME), "sacks": "3", "defensiveInterceptions": "1"},
            "away": {"teamID": str(AWAY), "sacks": "1", "defensiveInterceptions": "0"},
        },
        "teamStats": {
            "home": _team_stats(HOME, **(home or {})),
            "away": _team_stats(AWAY, **(away or {})),
        },
        "scoringPlays": scoring_plays or [],
        "playerStats": {},
    }


def _rows(box: dict[str, Any]) -> dict[int, dict[str, Any]]:
    valid = {dst_player_id(HOME), dst_player_id(AWAY)}
    rows = parse_dst_stat_rows("G1", box, valid)
    return {row["player_id"]: row for row in rows}


def test_each_team_gets_its_own_row_with_the_opponents_offense_as_allowed() -> None:
    rows = _rows(_box(home={"totalYards": "250"}, away={"totalYards": "410"}))

    home, away = rows[dst_player_id(HOME)], rows[dst_player_id(AWAY)]
    assert home["game_id"] == away["game_id"] == "G1"
    assert home["dst_yards_allowed"] == 410
    assert away["dst_yards_allowed"] == 250
    assert (home["dst_sacks"], away["dst_sacks"]) == (3, 1)
    assert (home["dst_interceptions"], away["dst_interceptions"]) == (1, 0)


def test_points_allowed_exclude_the_opponents_defensive_and_special_teams_tds() -> None:
    # Away scored 29 including one pick-six against the home offense.
    rows = _rows(
        _box(home_points=13, away_points=29, away={"defensiveOrSpecialTeamsTds": "1"})
    )

    assert rows[dst_player_id(HOME)]["dst_points_allowed"] == 23
    assert rows[dst_player_id(AWAY)]["dst_points_allowed"] == 13


def test_fumble_recoveries_are_the_opponents_fumbles_lost() -> None:
    rows = _rows(_box(away={"fumblesLost": "2"}))

    assert rows[dst_player_id(HOME)]["dst_fumbles_recovered"] == 2
    assert rows[dst_player_id(AWAY)]["dst_fumbles_recovered"] == 0


def test_defensive_and_return_tds_and_two_point_returns_come_from_team_stats() -> None:
    rows = _rows(
        _box(
            home={
                "defensiveOrSpecialTeamsTds": "2",
                "defensiveTwoPointConversionReturns": "1",
            }
        )
    )

    assert rows[dst_player_id(HOME)]["dst_def_td"] == 2
    assert rows[dst_player_id(HOME)]["dst_two_point_returns"] == 1
    assert rows[dst_player_id(AWAY)]["dst_def_td"] == 0


def test_safeties_are_counted_from_scoring_plays_for_the_scoring_team() -> None:
    plays = [
        {"scoreType": "SF", "teamID": str(AWAY)},
        {"scoreType": "TD", "teamID": str(AWAY)},
    ]
    rows = _rows(_box(scoring_plays=plays))

    assert rows[dst_player_id(AWAY)]["dst_safeties"] == 1
    assert rows[dst_player_id(HOME)]["dst_safeties"] == 0


def test_unknown_dst_players_are_skipped() -> None:
    rows = parse_dst_stat_rows("G1", _box(), {dst_player_id(HOME)})

    assert [row["player_id"] for row in rows] == [dst_player_id(HOME)]


def test_a_box_score_without_team_stats_yields_no_rows() -> None:
    box = _box()
    del box["teamStats"]

    assert parse_dst_stat_rows("G1", box, {dst_player_id(HOME)}) == []


def test_a_game_without_scores_yet_yields_no_rows() -> None:
    box = _box()
    box["homePts"] = ""
    box["awayPts"] = ""

    assert _rows(box) == {}
