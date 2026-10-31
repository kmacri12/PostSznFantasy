"""Rebuild the golden fixtures from a Tank01 response cache and the 2025 workbook.

    uv run --with openpyxl python build_fixtures.py CACHE_DIR WORKBOOK.xlsx

Only the keys the scorer reads are kept. The workbook's Config sheet holds an API
key; this script never reads that sheet and nothing from it is written out.
"""

import json
import sys
from pathlib import Path
from typing import Any

import openpyxl  # type: ignore[import-untyped,unused-ignore]

KEEP_BOX_KEYS = (
    "gameID",
    "gameWeek",
    "teamIDHome",
    "teamIDAway",
    "homePts",
    "awayPts",
    "DST",
    "scoringPlays",
)
KEEP_TEAM_STATS = (
    "teamID",
    "teamAbv",
    "totalYards",
    "sacksAndYardsLost",
    "interceptionsThrown",
    "fumblesLost",
    "safeties",
    "defensiveOrSpecialTeamsTds",
    "defensiveTwoPointConversionReturns",
    "blockedPunt",
    "blockedFG",
    "blockedXP",
)
ROUNDS = ("Wild Card", "Divisional Round", "Conference Championship", "Super Bowl")


def trimmed_box(box: dict[str, Any]) -> dict[str, Any]:
    out = {key: box[key] for key in KEEP_BOX_KEYS if key in box}
    out["teamStats"] = {
        side: {key: stats[key] for key in KEEP_TEAM_STATS if key in stats}
        for side, stats in box["teamStats"].items()
    }
    out["playerStats"] = {
        pid: {k: v for k, v in stats.items() if k != "snapCounts"}
        for pid, stats in box["playerStats"].items()
    }
    return out


def main(cache_dir: str, workbook_path: str) -> None:
    here = Path(__file__).parent
    boxes: dict[str, Any] = {}
    for path in Path(cache_dir).glob("*.json"):
        raw = json.loads(path.read_text())
        box = raw.get("body", raw) if isinstance(raw, dict) else None
        if isinstance(box, dict) and "playerStats" in box:
            if box["gameID"] >= "20260101":  # the 2025 postseason
                boxes[box["gameID"]] = trimmed_box(box)
    (here / "box_scores.json").write_text(
        json.dumps(dict(sorted(boxes.items())), indent=1, sort_keys=True) + "\n"
    )

    teams = {side["teamAbv"] for box in boxes.values() for side in box["DST"].values()}
    sheet = openpyxl.load_workbook(workbook_path, data_only=True)["Players & Stats"]
    rows: list[dict[str, Any]] = []
    for name, pos, team, pid, _label, *rounds in sheet.iter_rows(
        min_row=2, values_only=True
    ):
        if team not in teams:
            continue
        rows.append(
            {
                "name": name,
                "pos": pos,
                "team": team,
                "playerId": int(pid) if pid else None,
                "rounds": dict(zip(ROUNDS, rounds, strict=True)),
            }
        )
    (here / "sheet_round_points.json").write_text(json.dumps(rows, indent=1) + "\n")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
