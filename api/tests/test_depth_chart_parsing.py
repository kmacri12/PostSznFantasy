import json
from pathlib import Path

from api.services.ingestion.schemas import parse_depth_chart_starters

# A real getNFLDepthCharts response trimmed to the QB and PK lists (docs/research).
REAL = json.loads(
    (Path(__file__).parent / "fixtures" / "depth_charts_qb_pk.json").read_text()
)["body"]


def test_every_team_has_one_qb_starter_and_one_kicker_starter() -> None:
    rows = parse_depth_chart_starters(REAL)

    assert len(rows) == 64
    assert len({(row["team_id"], row["position"]) for row in rows}) == 64
    assert {row["position"] for row in rows} == {"QB", "K"}


def test_the_first_name_on_each_list_is_taken() -> None:
    rows = {
        (r["team_id"], r["position"]): r["player_id"]
        for r in parse_depth_chart_starters(REAL)
    }
    arizona = next(team for team in REAL if team["teamAbv"] == "ARI")

    assert rows[(int(arizona["teamID"]), "QB")] == 2578570  # Jacoby Brissett, QB1
    assert rows[(int(arizona["teamID"]), "K")] == 4363538  # Chad Ryland, PK1


def test_backups_malformed_entries_and_teams_without_a_starter_are_skipped() -> None:
    body = [
        {
            "teamID": "7",
            "depthChart": {
                "QB": [
                    {"depthPosition": "QB2", "playerID": "20"},
                    {"depthPosition": "QB1", "playerID": "10"},
                ],
                "PK": [{"depthPosition": "PK1"}],
            },
        },
        {
            "teamID": "8",
            "depthChart": {"QB": [{"depthPosition": "QB2", "playerID": "3"}]},
        },
        {
            "teamID": "oops",
            "depthChart": {"QB": [{"depthPosition": "QB1", "playerID": "1"}]},
        },
        {"teamID": "9"},
    ]

    assert parse_depth_chart_starters(body) == [
        {"team_id": 7, "position": "QB", "player_id": 10}
    ]
