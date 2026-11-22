"""The scoring breakdown must add up to the score it explains, on every real box score."""

import json
from decimal import Decimal
from pathlib import Path

import pytest

from api.db.models.league import SeasonSettings
from api.db.models.nfl import NFLPlayerGameStats
from api.models.league_models import ScoringSettings
from api.services.ingestion.box_scores_ingest import parse_game_player_stats
from api.services.ingestion.dst_stats import dst_player_id
from api.utils.calculations.fantasy_points_utils import calculate_player_points
from api.utils.calculations.points_breakdown import points_breakdown

BOXES = json.loads(
    (Path(__file__).parent / "fixtures" / "golden_2025" / "box_scores.json").read_text()
)
POSITIONS = ("QB", "RB", "WR", "TE", "K", "DST")


def _settings(**overrides: float) -> SeasonSettings:
    values = ScoringSettings(**overrides).model_dump(by_alias=False)
    return SeasonSettings(**{k: Decimal(str(v)) for k, v in values.items()})


def _every_rate_on() -> SeasonSettings:
    """Defaults, with each rate that defaults to 0 given a value, so every line is tried."""
    defaults = ScoringSettings().model_dump(by_alias=False)
    return _settings(
        **{key: 0.25 for key, value in defaults.items() if not value},
    )


def _rows() -> list[NFLPlayerGameStats]:
    rows = []
    for game_id, box in BOXES.items():
        ids = {int(pid) for pid in box["playerStats"]}
        ids |= {dst_player_id(int(side["teamID"])) for side in box["DST"].values()}
        rows += [
            NFLPlayerGameStats(**row)
            for row in parse_game_player_stats(game_id, box, ids)
        ]
    return rows


ROWS = _rows()


@pytest.mark.parametrize(
    "settings", [_settings(), _every_rate_on()], ids=["default", "all"]
)
@pytest.mark.parametrize("position", POSITIONS)
def test_lines_add_up_to_the_score(settings: SeasonSettings, position: str) -> None:
    for row in ROWS:
        lines = points_breakdown([row], settings, position)
        assert sum((ln.points for ln in lines), Decimal(0)) == calculate_player_points(
            row, settings, position
        )


def test_reads_like_the_stats() -> None:
    row = NFLPlayerGameStats(rushing_yards=17, rushing_carries=2)
    lines = points_breakdown([row], _settings(), "RB")
    assert [(ln.label, ln.points) for ln in lines] == [
        ("17 rushing yards", Decimal("1.7")),
    ]


def test_a_quarterback_gets_a_line_per_scoring_stat() -> None:
    row = NFLPlayerGameStats(
        passing_yards=21, passing_touchdowns=1, passing_interceptions=0, rushing_yards=4
    )
    labels = [ln.label for ln in points_breakdown([row], _settings(), "QB")]
    assert labels == ["21 passing yards", "1 passing TD", "4 rushing yards"]


def test_a_team_unit_sums_its_members() -> None:
    starter = NFLPlayerGameStats(passing_yards=200, passing_touchdowns=1)
    backup = NFLPlayerGameStats(passing_yards=40, passing_touchdowns=1)
    lines = points_breakdown([starter, backup], _settings(), "QB")
    assert [ln.label for ln in lines] == ["240 passing yards", "2 passing TDs"]


def test_a_defense_names_points_and_yards_allowed() -> None:
    row = NFLPlayerGameStats(
        dst_sacks=3, dst_points_allowed=0, dst_yards_allowed=250, dst_interceptions=1
    )
    lines = points_breakdown([row], _settings(), "DST")
    labels = [ln.label for ln in lines]
    assert "3 sacks" in labels
    assert "0 points allowed" in labels
    assert "250 yards allowed" in labels


def test_a_bonus_is_named_without_a_count() -> None:
    row = NFLPlayerGameStats(passing_yards=410)
    labels = [
        ln.label
        for ln in points_breakdown(
            [row],
            _settings(
                scoring_passing_bonus_300_yards=2, scoring_passing_bonus_400_yards=3
            ),
            "QB",
        )
    ]
    assert labels == [
        "410 passing yards",
        "300+ passing yard bonus",
        "400+ passing yard bonus",
    ]
