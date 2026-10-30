"""Regenerates nfl.json and replay.json (deterministic: python3 build_fixtures.py).

Eight made-up playoff teams, eight players each, and a four-game divisional round whose
box scores use Tank01's real response shape so the replay exercises the real ingestion.
The generated files are committed; this script only exists to change them reviewably.
"""

import json
import random
from pathlib import Path

HERE = Path(__file__).parent
SEASON = "2026"
SEED = 79

TEAMS = [
    (1, "KCC", "Kansas City", "Comets"),
    (2, "BUF", "Buffalo", "Bisons"),
    (3, "BAL", "Baltimore", "Ravines"),
    (4, "HOU", "Houston", "Rustlers"),
    (5, "PHI", "Philadelphia", "Founders"),
    (6, "LAR", "Los Angeles", "Rams"),
    (7, "DET", "Detroit", "Mechanics"),
    (8, "SFO", "San Francisco", "Prospectors"),
]
# (position, count). Player ids are team_id * 100 + slot; slot 8 is the team defense.
SLOTS = ["QB", "RB", "RB", "WR", "WR", "TE", "K", "DST"]
FIRST = ["Aiden", "Bryce", "Caleb", "Dante", "Eli", "Felix", "Gavin", "Hugo"]
LAST = ["Archer", "Boone", "Cole", "Drake", "Easton", "Frost", "Grady", "Hale"]

# Home, away, winner side, kickoff offset in hours from the first kickoff. The winner of
# game 1 plays on; every team appears once, so each result eliminates exactly one team.
GAMES = [(2, 1, "home", 0), (3, 4, "away", 5), (5, 6, "home", 10), (7, 8, "away", 15)]
FIRST_KICKOFF = 1798500000  # 2026-12-29, only the spacing matters


def player_id(team: int, slot: int) -> int:
    return team * 100 + slot + 1


def roster() -> list[dict]:
    players = []
    for team_id, abv, *_ in TEAMS:
        for slot, position in enumerate(SLOTS):
            index = (team_id - 1) * 8 + slot
            name = (
                f"{abv} Defense"
                if position == "DST"
                else f"{FIRST[index % 8]} {LAST[index // 8]}"
            )
            players.append(
                {
                    "id": player_id(team_id, slot),
                    "name": name,
                    "position": position,
                    "teamId": team_id,
                    "jerseyNum": str(slot + 1),
                }
            )
    names = [p["name"] for p in players]
    assert len(set(names)) == len(names), "player names must be unique"
    return players


def season_stats(rng: random.Random, players: list[dict]) -> list[dict]:
    rows = []
    for p in players:
        base = {"playerId": p["id"], "season": SEASON}
        match p["position"]:
            case "QB":
                stats = {
                    "passing_yards": rng.randint(3000, 4600),
                    "passing_touchdowns": rng.randint(20, 38),
                    "passing_interceptions": rng.randint(5, 14),
                }
            case "RB":
                stats = {
                    "rushing_yards": rng.randint(400, 1500),
                    "rushing_touchdowns": rng.randint(2, 14),
                    "receiving_receptions": rng.randint(15, 70),
                    "receiving_yards": rng.randint(100, 500),
                }
            case "WR" | "TE":
                stats = {
                    "receiving_receptions": rng.randint(30, 110),
                    "receiving_yards": rng.randint(300, 1500),
                    "receiving_touchdowns": rng.randint(1, 12),
                }
            case "K":
                stats = {
                    "kicking_fg_made": rng.randint(18, 36),
                    "kicking_xp_made": rng.randint(25, 55),
                }
            case _:
                stats = {"dst_sacks": rng.randint(25, 55)}
        rows.append({**base, **stats})
    return rows


def stat_line(rng: random.Random, position: str) -> dict | None:
    match position:
        case "QB":
            attempts = rng.randint(24, 42)
            return {
                "Passing": {
                    "passCompletions": str(int(attempts * 0.65)),
                    "passAttempts": str(attempts),
                    "passYds": str(rng.randint(180, 340)),
                    "passTD": str(rng.randint(0, 3)),
                    "int": str(rng.randint(0, 2)),
                    "sacked": f"{rng.randint(0, 3)}-{rng.randint(0, 20)}",
                }
            }
        case "RB":
            return {
                "Rushing": {
                    "carries": str(rng.randint(8, 24)),
                    "rushYds": str(rng.randint(20, 130)),
                    "rushTD": str(rng.randint(0, 2)),
                    "longRush": str(rng.randint(5, 40)),
                },
                "Receiving": {
                    "receptions": str(rng.randint(0, 6)),
                    "targets": str(rng.randint(0, 8)),
                    "recYds": str(rng.randint(0, 50)),
                    "recTD": "0",
                    "longRec": str(rng.randint(0, 25)),
                },
            }
        case "WR" | "TE":
            return {
                "Receiving": {
                    "receptions": str(rng.randint(2, 9)),
                    "targets": str(rng.randint(3, 12)),
                    "recYds": str(rng.randint(20, 140)),
                    "recTD": str(rng.randint(0, 2)),
                    "longRec": str(rng.randint(10, 55)),
                }
            }
        case "K":
            made = rng.randint(0, 3)
            return {
                "Kicking": {
                    "fgMade": str(made),
                    "fgAttempts": str(made + rng.randint(0, 1)),
                    "xpMade": str(rng.randint(1, 4)),
                    "xpAttempts": "4",
                }
            }
    return None


def replay(rng: random.Random, players: list[dict]) -> dict:
    abv = {t[0]: t[1] for t in TEAMS}
    by_team: dict[int, list[dict]] = {}
    for p in players:
        by_team.setdefault(p["teamId"], []).append(p)

    games, boxes = [], {}
    for home, away, winner, hours in GAMES:
        kickoff = FIRST_KICKOFF + hours * 3600
        game_id = f"20261229_{abv[away]}@{abv[home]}"
        loser_pts, winner_pts = rng.randint(10, 24), rng.randint(27, 38)
        home_pts, away_pts = (
            (winner_pts, loser_pts) if winner == "home" else (loser_pts, winner_pts)
        )
        summary = {
            "gameID": game_id,
            "seasonType": "Postseason",
            "away": abv[away],
            "home": abv[home],
            "gameDate": "20261229",
            "gameStatus": "Scheduled",
            "gameWeek": "Divisional Round",
            "teamIDHome": str(home),
            "teamIDAway": str(away),
            "gameTime": "4:30p",
            "gameTime_epoch": f"{float(kickoff)}",
            "season": SEASON,
            "espnLink": f"https://example.test/{game_id}",
        }
        games.append(summary)
        player_stats = {}
        for team in (home, away):
            for p in by_team[team]:
                line = stat_line(rng, p["position"])
                if line:
                    player_stats[str(p["id"])] = {
                        **line,
                        "gameID": game_id,
                        "teamID": str(team),
                        "team": abv[team],
                    }
        dst = {
            side: {
                "teamAbv": abv[team],
                "teamID": str(team),
                "defTD": "0",
                "defensiveInterceptions": str(rng.randint(0, 2)),
                "sacks": str(rng.randint(0, 5)),
                "ydsAllowed": str(rng.randint(200, 420)),
            }
            for side, team in (("home", home), ("away", away))
        }
        boxes[game_id] = {
            **summary,
            "gameStatus": "Completed",
            "homePts": str(home_pts),
            "awayPts": str(away_pts),
            "scoringPlays": [],
            "DST": dst,
            "playerStats": player_stats,
        }
    return {"games": games, "boxes": boxes}


def main() -> None:
    rng = random.Random(SEED)
    players = roster()
    nfl = {
        "season": SEASON,
        "teams": [
            {"id": i, "teamAbv": abv, "teamCity": city, "teamName": name}
            for i, abv, city, name in TEAMS
        ],
        "players": players,
        "seasonStats": season_stats(rng, players),
        "games": replay(random.Random(SEED), players)["games"],
    }
    (HERE / "nfl.json").write_text(json.dumps(nfl, indent=1) + "\n")
    (HERE / "replay.json").write_text(json.dumps(replay(random.Random(SEED), players)))


if __name__ == "__main__":
    main()
