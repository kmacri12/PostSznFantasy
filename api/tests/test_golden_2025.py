"""Acceptance test: replay the 2025 postseason through our scorer and match the sheet.

The commissioner's 2025 league scored these games in a Google Sheet (half PPR that
year). Fixtures in `fixtures/golden_2025/` hold the box scores of the four games we
have cached (Wild Card LAR@CAR, Divisional BUF@DEN and LAR@CHI, Super Bowl SEA@NE)
and the sheet's per-player round points. QB and K rows are compared as team totals
because the sheet combined every QB (and K) of a team into each of their rows.
"""

import json
from collections import defaultdict
from decimal import Decimal
from pathlib import Path
from typing import Any

import pytest

from api.db.models.league import LeagueSettings
from api.db.models.nfl import NFLPlayerGameStats
from api.models.league_models import ScoringSettings
from api.services.ingestion.box_scores_ingest import parse_game_player_stats
from api.services.ingestion.dst_stats import dst_player_id
from api.utils.calculations.fantasy_points_utils import calculate_player_points

FIXTURES = Path(__file__).parent / "fixtures" / "golden_2025"
TOLERANCE = 0.01
COMBINED_POSITIONS = ("QB", "PK")


def _sheet_settings() -> LeagueSettings:
    """Our defaults, except the 2025 sheet paid half a point per reception and nothing
    for blocked kicks (our default is 1; CAR's blocked punt in LAR@CAR would add 1)."""
    template = ScoringSettings(
        scoring_receiving_reception=0.5, scoring_dst_blocked_kick=0
    )
    return LeagueSettings(
        **{k: Decimal(str(v)) for k, v in template.model_dump(by_alias=False).items()}
    )


class Replay:
    def __init__(self) -> None:
        self.boxes: dict[str, dict[str, Any]] = json.loads(
            (FIXTURES / "box_scores.json").read_text()
        )
        self.sheet: list[dict[str, Any]] = json.loads(
            (FIXTURES / "sheet_round_points.json").read_text()
        )
        self.team_ids: dict[str, int] = {}
        self.teams_by_round: dict[str, set[str]] = defaultdict(set)
        positions = {r["playerId"]: r["pos"] for r in self.sheet if r["playerId"]}
        for box in self.boxes.values():
            for side in box["DST"].values():
                self.team_ids[side["teamAbv"]] = int(side["teamID"])
                self.teams_by_round[box["gameWeek"]].add(side["teamAbv"])
                positions[dst_player_id(int(side["teamID"]))] = "DST"

        settings = _sheet_settings()
        self.points: dict[tuple[str, int], float] = {}
        for game_id, box in self.boxes.items():
            for row in parse_game_player_stats(game_id, box, set(positions)):
                stats = NFLPlayerGameStats(**row)
                position = positions[row["player_id"]]
                self.points[(box["gameWeek"], row["player_id"])] = float(
                    calculate_player_points(stats, settings, position)
                )

    def ours(self, round_name: str, row: dict[str, Any]) -> float:
        player_id = (
            dst_player_id(self.team_ids[row["team"]])
            if row["pos"] == "DST"
            else row["playerId"]
        )
        return self.points.get((round_name, player_id), 0.0)

    def comparisons(self) -> list[tuple[str, float, float]]:
        """(label, ours, sheet) for every individual and every team-combined QB/K."""
        out: list[tuple[str, float, float]] = []
        combined: dict[tuple[str, str, str], list[float]] = defaultdict(
            lambda: [0.0, 0.0]
        )
        for row in self.sheet:
            for round_name, sheet_points in row["rounds"].items():
                if row["team"] not in self.teams_by_round[round_name]:
                    continue
                ours = self.ours(round_name, row)
                sheet_value = sheet_points or 0.0
                if row["pos"] in COMBINED_POSITIONS:
                    pair = combined[(round_name, row["team"], row["pos"])]
                    pair[0] += ours
                    pair[1] = max(pair[1], sheet_value)
                else:
                    label = f"{round_name} {row['name']} ({row['pos']} {row['team']})"
                    out.append((label, ours, sheet_value))
        out.extend(
            (f"{rnd} {team} {pos} (team total)", ours, sheet_value)
            for (rnd, team, pos), (ours, sheet_value) in combined.items()
        )
        return out


@pytest.fixture(scope="module")
def replay() -> Replay:
    return Replay()


def test_every_player_and_team_total_matches_the_sheet_within_a_hundredth(
    replay: Replay,
) -> None:
    comparisons = replay.comparisons()
    mismatches = [
        f"{label}: ours {ours:.2f}, sheet {sheet:.2f}"
        for label, ours, sheet in comparisons
        if abs(ours - sheet) > TOLERANCE + 1e-9
    ]
    assert mismatches == []
    # Guard against a vacuous pass: real games with real, non-zero scores.
    assert len(comparisons) > 300
    assert sum(1 for _, ours, _ in comparisons if ours) > 80


def test_dst_rules_match_the_sheet_including_a_pick_six_against_the_offense(
    replay: Replay,
) -> None:
    # Super Bowl: SEA scored 29 with a pick-six, so NE gave up 23 (not 29).
    box = replay.boxes["20260208_SEA@NE"]
    dst_ids = {dst_player_id(replay.team_ids[team]) for team in ("NE", "SEA")}
    rows = {
        r["player_id"]: r
        for r in parse_game_player_stats("20260208_SEA@NE", box, dst_ids)
    }
    ne = rows[dst_player_id(replay.team_ids["NE"])]
    assert ne["dst_points_allowed"] == 23
    assert replay.points[("Super Bowl", dst_player_id(replay.team_ids["NE"]))] == 2.0
    assert replay.points[("Super Bowl", dst_player_id(replay.team_ids["SEA"]))] == 20.0
