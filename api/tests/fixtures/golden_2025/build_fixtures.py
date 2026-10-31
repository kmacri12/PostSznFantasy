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
    (here / "league_2025.json").write_text(
        json.dumps(
            league_snapshot(openpyxl.load_workbook(workbook_path, data_only=True)),
            indent=1,
        )
        + "\n"
    )


def league_snapshot(workbook: Any) -> dict[str, Any]:
    """The real league: draft board, rosters, each round's lineup with the sheet's points."""
    home = workbook["Home"]
    names = [row[0] for row in home.iter_rows(min_row=3, max_row=8, values_only=True)]
    totals = {
        row[0]: list(row[1:6])
        for row in home.iter_rows(min_row=3, max_row=8, values_only=True)
    }
    board = workbook["Draft Board"]
    order = [
        c
        for c in next(board.iter_rows(min_row=2, max_row=2, values_only=True))[1:]
        if c
    ]
    draft = []
    for rd, *cells in board.iter_rows(min_row=3, max_row=20, values_only=True):
        seats = range(len(order)) if int(rd) % 2 else reversed(range(len(order)))
        for index, seat in enumerate(seats):
            draft.append(
                {
                    "pick": (int(rd) - 1) * len(order) + index + 1,
                    "round": int(rd),
                    "team": order[seat],
                    "player": cells[seat],
                }
            )
    teams = []
    for name in names:
        sheet = workbook[name]
        rows = list(
            sheet.iter_rows(min_row=3, max_row=11, max_col=12, values_only=True)
        )
        roster = [
            r[1]
            for r in sheet.iter_rows(min_row=3, max_row=20, max_col=2, values_only=True)
            if r[1]
        ]
        lineups = {
            str(round_): [
                {
                    "slot": r[3],
                    "player": r[4 + 2 * (round_ - 1)],
                    "sheetPoints": r[5 + 2 * (round_ - 1)],
                }
                for r in rows
            ]
            for round_ in (1, 2, 3, 4)
        }
        teams.append(
            {
                "name": name,
                "roster": roster,
                "lineups": lineups,
                "sheetTotals": totals[name],
            }
        )
    return {"draftOrder": order, "draft": draft, "teams": teams}


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
