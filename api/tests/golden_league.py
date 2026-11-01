"""The commissioner's real 2025 league, replayed through our scoring and awards.

Inputs are the committed fixtures in `fixtures/golden_2025/`: all 14 postseason box
scores, the Players & Stats sheet, and `league_2025.json` (draft board, rosters, each
round's lineup and the points the sheet showed for it). The league played with team
QB / team K on, half PPR and no round multipliers, which is what `_sheet_settings`
plus the roster defaults model.

    python -m api.tests.golden_league > docs/research/awards-2025-replay.md
"""

import json
from collections import defaultdict
from dataclasses import dataclass
from decimal import Decimal
from typing import Any

from api.db.models.nfl import NFLPlayer, NFLPlayerGameStats
from api.models.enums import PlayerPosition
from api.services.awards import Award, compute_awards
from api.services.ingestion.box_scores_ingest import parse_game_player_stats
from api.services.ingestion.dst_stats import dst_player_id
from api.services.lineups import BENCH, slot_layout
from api.services.round_points import (
    PointsLine,
    StatsByPlayer,
    point_lines,
    sum_points,
)
from api.tests.test_golden_2025 import FIXTURES, Replay, _sheet_settings

WEEK_OF = {
    "Wild Card": 19,
    "Divisional Round": 20,
    "Conference Championship": 21,
    "Super Bowl": 22,
}
ROUND_NAMES = ("Wild Card", "Divisional", "Conference Championship", "Super Bowl")


@dataclass(frozen=True)
class SlotDifference:
    team: str
    round: int
    slot: str
    player: str | None
    ours: Decimal
    sheet: Decimal


class RealLeague:
    def __init__(self) -> None:
        replay = Replay()
        self.snapshot: dict[str, Any] = json.loads(
            (FIXTURES / "league_2025.json").read_text()
        )
        self.team_names: list[str] = [t["name"] for t in self.snapshot["teams"]]
        self.team_id = {name: i for i, name in enumerate(self.team_names, start=1)}

        self.players: dict[int, NFLPlayer] = {}
        self.ids: dict[str, int] = {}
        for row in replay.sheet:
            if row["playerId"]:
                label = f"{row['name']} ({row['team']}) {row['pos']}"
                self.ids[label] = row["playerId"]
                self.players[row["playerId"]] = NFLPlayer(
                    id=row["playerId"], name=row["name"], position=row["pos"]
                )
        for abv, nfl_team_id in replay.team_ids.items():
            player_id = dst_player_id(nfl_team_id)
            self.ids[f"{abv} DST ({abv}) DST"] = player_id
            self.players[player_id] = NFLPlayer(
                id=player_id, name=f"{abv} DST", position="DST"
            )
        self.nfl_team = {
            self.ids[f"{r['name']} ({r['team']}) {r['pos']}"]: r["team"]
            for r in replay.sheet
            if r["playerId"]
        }

        settings = _sheet_settings()
        for field, count in {
            "qb": 1,
            "rb": 2,
            "wr": 2,
            "te": 1,
            "flex_wr_rb_te": 1,
            "flex_wr_rb": 0,
            "flex_wr_te": 0,
            "flex_qb_wr_rb_te": 0,
            "k": 1,
            "dst": 1,
            "bench": 9,
        }.items():
            setattr(settings, f"roster_num_{field}", count)
        for field in ("wild_card", "divisional", "conference", "super_bowl"):
            setattr(settings, f"multiplier_{field}", Decimal(1))
        self.layout = slot_layout(settings)
        starters = {i for i, s in enumerate(self.layout) if s.slot != BENCH}

        self.rosters = {
            self.team_id[t["name"]]: [self.ids[label] for label in t["roster"]]
            for t in self.snapshot["teams"]
        }
        self.owners = {p: t for t, roster in self.rosters.items() for p in roster}
        placements = {
            (self.team_id[t["name"]], int(round_)): {
                i: self.ids[row["player"]]
                for i, row in enumerate(rows)
                if row["player"]
            }
            for t in self.snapshot["teams"]
            for round_, rows in t["lineups"].items()
        }
        self.picks = {self.ids[d["player"]]: d["pick"] for d in self.snapshot["draft"]}
        stats: StatsByPlayer = defaultdict(list)
        for game_id, box in replay.boxes.items():
            for row in parse_game_player_stats(game_id, box, set(self.players)):
                stats[row["player_id"]].append(
                    (NFLPlayerGameStats(**row), WEEK_OF[box["gameWeek"]])
                )
        self.lines: list[PointsLine] = point_lines(
            settings,
            starters,
            self.rosters,
            placements,
            self.players,
            stats,
            self._unit_members(),
        )
        counted = sum_points(self.lines, counted=True)
        self.round_points = {
            t: [counted.get((t, r), Decimal(0)) for r in (1, 2, 3, 4)]
            for t in self.rosters
        }
        self.totals = {t: sum(p, Decimal(0)) for t, p in self.round_points.items()}
        best = max(self.totals.values())
        self.champions = {t for t, total in self.totals.items() if total == best}
        self.awards = compute_awards(
            self.lines, self.players, self.picks, self.champions, self.owners
        )

    def _unit_members(self) -> dict[int, list[int]]:
        """Team QB / team K: a rostered QB or K scores every QB / K of his NFL team."""
        units: dict[tuple[str, str], list[int]] = defaultdict(list)
        unit_of: dict[int, tuple[str, str]] = {}
        for player_id, nfl_team in self.nfl_team.items():
            position = PlayerPosition.from_str(self.players[player_id].position)
            if position in (PlayerPosition.QB, PlayerPosition.K):
                unit_of[player_id] = (nfl_team, position.value)
                units[unit_of[player_id]].append(player_id)
        return {p: units[unit] for p, unit in unit_of.items()}

    def slot_differences(self) -> list[SlotDifference]:
        """Lineup slots where our points differ from the points the sheet showed."""
        by_slot = {
            (ln.team_id, ln.round, ln.slot_index): ln.points
            for ln in self.lines
            if ln.starter
        }
        out = []
        for t in self.snapshot["teams"]:
            team = self.team_id[t["name"]]
            for round_, rows in t["lineups"].items():
                for i, row in enumerate(rows):
                    ours = by_slot.get((team, int(round_), i), Decimal(0))
                    sheet = Decimal(str(row["sheetPoints"] or 0))
                    if abs(ours - sheet) > Decimal("0.01"):
                        out.append(
                            SlotDifference(
                                t["name"],
                                int(round_),
                                row["slot"],
                                row["player"],
                                ours,
                                sheet,
                            )
                        )
        return out

    def name(self, player_id: int) -> str:
        return self.players[player_id].name or ""

    def ranking(self) -> list[tuple[int, int]]:
        """(rank, team id); level teams share a rank."""
        ordered = sorted(self.totals, key=lambda t: -self.totals[t])
        return [
            (1 + sum(1 for o in ordered if self.totals[o] > self.totals[t]), t)
            for t in ordered
        ]

    def top_scorers(self, count: int) -> list[tuple[int, Decimal, list[Decimal]]]:
        """Players by counted points, each with their four round scores."""
        by_round: dict[int, list[Decimal]] = defaultdict(lambda: [Decimal(0)] * 4)
        for ln in self.lines:
            if ln.starter:
                by_round[ln.player_id][ln.round - 1] += ln.points
        ranked = sorted(by_round.items(), key=lambda kv: (-sum(kv[1]), kv[0]))
        return [(p, sum(r, Decimal(0)), r) for p, r in ranked[:count]]


def _fmt(value: Decimal | float) -> str:
    return f"{Decimal(str(value)).quantize(Decimal('0.01'))}"


def report() -> str:
    league = RealLeague()
    team_name = {v: k for k, v in league.team_id.items()}
    sheet_total = {t["name"]: t["sheetTotals"] for t in league.snapshot["teams"]}
    out = ["# 2025 postseason awards, replayed on the real league", ""]
    out.append(
        "Generated by `python -m api.tests.golden_league` from the commissioner's "
        "workbook (draft board, rosters and each round's lineup as set in the sheet) "
        "and all 14 postseason box scores. Scoring: half PPR, team QB and team K on, "
        "no round multipliers."
    )
    out += ["", "## Final standings", ""]
    out.append(
        "| Rank | Team | Wild Card | Divisional | Conference | Super Bowl | Total | Sheet total |"
    )
    out.append("| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |")
    for rank, team in league.ranking():
        name = team_name[team]
        rounds = " | ".join(_fmt(p) for p in league.round_points[team])
        out.append(
            f"| {rank} | {name} | {rounds} | **{_fmt(league.totals[team])}** "
            f"| {_fmt(sheet_total[name][4])} |"
        )
    champions = ", ".join(team_name[t] for t in sorted(league.champions))
    out += ["", f"**Champion: {champions}.**", "", "## Awards", ""]
    out.append("| Award | Player | Team | Points |")
    out.append("| --- | --- | --- | ---: |")
    for award in league.awards:
        out.append(_award_row(league, award, team_name))
    out += ["", "## Top scorers (counted points)", ""]
    out.append("| # | Player | Pos | Team | NFL | WC | Div | Conf | SB | Total |")
    out.append("| ---: | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: |")
    for i, (pid, total, by_round) in enumerate(league.top_scorers(15), start=1):
        player = league.players[pid]
        cells = " | ".join(_fmt(r) for r in by_round)
        out.append(
            f"| {i} | {player.name} | {player.position} | {team_name[league.owners[pid]]} "
            f"| {league.nfl_team.get(pid, league.name(pid).removesuffix(' DST'))} | {cells} | **{_fmt(total)}** |"
        )
    out += ["", "## Differences from the sheet", ""]
    diffs = league.slot_differences()
    if not diffs:
        out.append(
            "None: every lineup slot in every round matches the sheet within a cent."
        )
    else:
        out.append("| Team | Round | Slot | Player | Ours | Sheet |")
        out.append("| --- | --- | --- | --- | ---: | ---: |")
        out += [
            f"| {d.team} | {ROUND_NAMES[d.round - 1]} | {d.slot} | {d.player} "
            f"| {_fmt(d.ours)} | {_fmt(d.sheet)} |"
            for d in diffs
        ]
    out += [
        "",
        "## Reading the draft awards",
        "",
        "Draft value is per position: the order a player was drafted among his "
        "position's picks minus his finish among them by counted points. Each position "
        "has a best value and a biggest bust, with no cutoff at zero.",
    ]
    return "\n".join(out) + "\n"


def _award_row(league: RealLeague, award: Award, team_name: dict[int, str]) -> str:
    player = league.name(award.player_id) if award.player_id else "(team)"
    detail = f" ({ROUND_NAMES[award.round - 1]})" if award.round else ""
    if award.draft:
        d = award.draft
        pos = award.key.rsplit("_", 1)[1].upper()
        points = (
            f"drafted {pos}{d.drafted_as}, finished {pos}{d.finished_as}, "
            f"{d.places:+d} places, {_fmt(d.points)}"
        )
    else:
        points = _fmt(award.value)
    return (
        f"| {award.title}{detail} | {player} | {team_name[award.team_id]} | {points} |"
    )


if __name__ == "__main__":
    print(report(), end="")
