"""Builds the tour's seed (nfl.json) and replay file from last season's real postseason.

    python3 e2e/tour/build_fixtures.py OUT_DIR

Inputs are the committed golden fixtures (all 14 box scores and every rostered player of the
commissioner's 2025 league). Real kickoff dates are replaced by games six virtual hours
apart in real order, which is what the replay clock plays back; the first real game starts
`LEAD_HOURS` after the replay clock does, so a capture has time to draft and set lineups.
"""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
GOLDEN = ROOT / "api/tests/fixtures/golden_2025"
FIRST_KICKOFF = 1798500000  # 2026-12-29; only the spacing matters
LEAD_HOURS = 96
SLOT_HOURS = 6
SEASON = "2026"

TEAMS = {
    "BUF": ("Buffalo", "Bills"),
    "CAR": ("Carolina", "Panthers"),
    "CHI": ("Chicago", "Bears"),
    "DEN": ("Denver", "Broncos"),
    "GB": ("Green Bay", "Packers"),
    "HOU": ("Houston", "Texans"),
    "JAX": ("Jacksonville", "Jaguars"),
    "LAC": ("Los Angeles", "Chargers"),
    "LAR": ("Los Angeles", "Rams"),
    "NE": ("New England", "Patriots"),
    "PHI": ("Philadelphia", "Eagles"),
    "PIT": ("Pittsburgh", "Steelers"),
    "SEA": ("Seattle", "Seahawks"),
    "SF": ("San Francisco", "49ers"),
}


def main(out: Path) -> None:
    boxes = json.loads((GOLDEN / "box_scores.json").read_text())
    sheet = json.loads((GOLDEN / "sheet_round_points.json").read_text())

    team_ids: dict[str, int] = {}
    for box in boxes.values():
        for side in box["DST"].values():
            team_ids[side["teamAbv"]] = int(side["teamID"])
    teams = [
        {"id": team_ids[abv], "teamAbv": abv, "teamCity": city, "teamName": name}
        for abv, (city, name) in TEAMS.items()
    ]
    players = [
        {
            "id": row["playerId"],
            "name": row["name"],
            "position": "K" if row["pos"] == "PK" else row["pos"],
            "teamId": team_ids[row["team"]],
            "jerseyNum": None,
        }
        for row in sheet
        if row["playerId"] and row["pos"] != "DST"
    ]
    players += [
        {
            "id": -team["id"],
            "name": f"{team['teamCity']} {team['teamName']}",
            "position": "DST",
            "teamId": team["id"],
            "jerseyNum": None,
        }
        for team in teams
    ]

    # The depth chart the real app would have synced: whoever threw or kicked most that postseason.
    usage: dict[tuple[int, str], dict[int, int]] = {}
    known = {p["id"]: p for p in players}
    for box in boxes.values():
        for pid_text, stats in box["playerStats"].items():
            player = known.get(int(pid_text))
            if player is None:
                continue
            if player["position"] == "QB":
                amount = int(stats.get("Passing", {}).get("passAttempts", 0) or 0)
            elif player["position"] == "K":
                kicking = stats.get("Kicking", {})
                amount = int(kicking.get("fgAttempts", 0) or 0) + int(
                    kicking.get("xpAttempts", 0) or 0
                )
            else:
                continue
            by_player = usage.setdefault((player["teamId"], player["position"]), {})
            by_player[player["id"]] = by_player.get(player["id"], 0) + amount
    depth_chart = [
        {"teamId": team_id, "position": position, "playerId": max(c, key=c.__getitem__)}
        for (team_id, position), c in usage.items()
    ]

    games = []
    for index, (game_id, box) in enumerate(sorted(boxes.items())):
        date, matchup = game_id.split("_")
        away, home = matchup.split("@")
        kickoff = FIRST_KICKOFF + (LEAD_HOURS + index * SLOT_HOURS) * 3600
        games.append(
            {
                "gameID": game_id,
                "seasonType": "Postseason",
                "away": away,
                "home": home,
                "gameDate": date,
                "gameStatus": "Scheduled",
                "gameWeek": box["gameWeek"],
                "teamIDHome": box["teamIDHome"],
                "teamIDAway": box["teamIDAway"],
                "gameTime": "4:30p",
                "gameTime_epoch": f"{kickoff}.0",
                "season": SEASON,
            }
        )
    by_id = {g["gameID"]: g for g in games}
    replay_boxes = {
        game_id: {**by_id[game_id], **box, "gameStatus": "Completed"}
        for game_id, box in boxes.items()
    }
    # A game with no teams or box score opens the replay clock early: the quiet before game one.
    lead = {
        "gameID": "20261228_LEAD@IN",
        "seasonType": "Postseason",
        "gameDate": "20261228",
        "gameStatus": "Scheduled",
        "teamIDHome": "0",
        "teamIDAway": "0",
        "gameTime_epoch": f"{FIRST_KICKOFF}.0",
        "season": SEASON,
    }

    out.mkdir(parents=True, exist_ok=True)
    (out / "nfl.json").write_text(
        json.dumps(
            {
                "season": SEASON,
                "teams": teams,
                "players": players,
                "seasonStats": [],
                "depthChartStarters": depth_chart,
                "games": games,
            }
        )
    )
    (out / "replay.json").write_text(
        json.dumps({"games": [lead, *games], "boxes": replay_boxes})
    )


if __name__ == "__main__":
    main(Path(sys.argv[1]))
