"""Keeps the frontend's field schemas in step with the API's settings schemas."""

import re
from pathlib import Path

from api.models.league_models import (
    PostseasonSettings,
    RosterSettings,
    ScoringSettings,
    TeamUnitSettings,
)

SETTINGS_DIR = Path(__file__).resolve().parents[2] / "frontend" / "src" / "settings"


def declared_keys(filename: str) -> list[str]:
    return re.findall(r'key: "([a-z0-9_]+)"', (SETTINGS_DIR / filename).read_text())


def test_scoring_groups_cover_every_scoring_setting_once() -> None:
    keys = declared_keys("scoringGroups.ts")
    assert sorted(keys) == sorted(ScoringSettings.model_fields)


def test_roster_groups_cover_roster_settings_except_totals() -> None:
    keys = declared_keys("rosterGroups.ts")
    expected = set(RosterSettings.model_fields) - {"number_teams", "roster_total"}
    assert sorted(keys) == sorted(expected)


def test_postseason_fields_cover_postseason_and_team_unit_settings() -> None:
    keys = declared_keys("postseasonFields.ts")
    expected = set(PostseasonSettings.model_fields) | set(TeamUnitSettings.model_fields)
    assert sorted(keys) == sorted(expected)
