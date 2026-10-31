"""Season awards over real 2025 postseason box scores.

Three fantasy teams are fixed in `fixtures/golden_2025/awards_league.json` (rosters,
per-round lineups, overall pick numbers). The stats are the four cached games of the
commissioner's 2025 league (Wild Card LAR@CAR, Divisional BUF@DEN and LAR@CHI, Super
Bowl SEA@NE; no Conference Championship box score is cached, so round 3 scores nothing).

Every expected value below is hand-checkable against the commissioner's sheet
(`sheet_round_points.json`); `test_the_lineup_lines_equal_the_sheet` pins each starter's
points to the sheet so the arithmetic in the comments cannot drift from it.

Points per starter, by round (R1 Wild Card, R2 Divisional, R4 Super Bowl):

  Rams Stack (1) starts the same six every round, all LAR, so only R1 and R2 score:
    Stafford QB 22.16 / 10.22   Kyren Williams RB 14.5 / 25.7   Puka Nacua WR 29.5 / 8.7
    Parkinson TE 10.4 / 7.1     Mevis K 12.8 / 9.4              LAR DST 4 / 6
    R1 93.36, R2 67.12; Davante Adams (WR 9.7 / 3.4) sits on the bench: 13.1.
  Super Bowl Bound (2) leaves R1 empty, starts DEN/BUF/CHI players in R2 and SEA/NE in R4:
    R2: Nix 24.06, Cook 13.1, Mims 19.3, Kincaid 17.3, Lutz 16.4, DEN DST 8 = 98.16
    R4: Maye 17.5, Walker 17.1, Hollins 15.8, Barner 13.4, Myers 20, SEA DST 20 = 103.8
  Bench Warmers (3) starts only Allen (R1: no game, 0; R2: 21.92) and Shakir (R2: 11.0)
    and leaves every CAR player on the bench in R1: Young 20.96 + Hubbard 18.9 +
    Coker 23.9 + Tremble 3.7 + Fitzgerald 8.6 + CAR DST 2 = 78.06. Jaden Shirden
    (CAR RB, no stats at all) is rostered but never appears in a lineup.

Team totals: Super Bowl Bound 201.96, Rams Stack 160.48, Bench Warmers 32.92.
"""

import json
from collections import defaultdict
from decimal import Decimal
from typing import Any

import pytest

from api.db.models.nfl import NFLPlayer, NFLPlayerGameStats
from api.services.awards import Award, compute_awards
from api.services.ingestion.box_scores_ingest import parse_game_player_stats
from api.services.ingestion.dst_stats import dst_player_id
from api.services.lineups import BENCH, slot_layout
from api.services.round_points import PointsLine, StatsByPlayer, point_lines
from api.tests.test_golden_2025 import FIXTURES, Replay, _sheet_settings

# The small hand-checkable league scores these four games only.
GAMES = (
    "20260110_LAR@CAR",
    "20260117_BUF@DEN",
    "20260118_LAR@CHI",
    "20260208_SEA@NE",
)
WEEK_OF = {"Wild Card": 19, "Divisional Round": 20, "Super Bowl": 22}
SHEET_ROUND = {1: "Wild Card", 2: "Divisional Round", 4: "Super Bowl"}
SLOT_COUNTS = {
    "qb": 1,
    "rb": 1,
    "wr": 1,
    "te": 1,
    "flex_wr_rb_te": 0,
    "flex_wr_rb": 0,
    "flex_wr_te": 0,
    "flex_qb_wr_rb_te": 0,
    "k": 1,
    "dst": 1,
    "bench": 4,
}
RAMS, BOUND, WARMERS = 1, 2, 3
PUKA, ADAMS, SHIRDEN = 4426515, 16800, 4775270


class League:
    def __init__(self) -> None:
        replay = Replay()
        league = json.loads((FIXTURES / "awards_league.json").read_text())
        self.sheet: list[dict[str, Any]] = replay.sheet
        self.players = self._players(replay)
        self.picks = {p["playerId"]: p["pick"] for p in league["picks"]}
        self.rosters = {t["id"]: t["roster"] for t in league["teams"]}
        self.owners = {p: t for t, roster in self.rosters.items() for p in roster}
        settings = _sheet_settings()
        for field, count in SLOT_COUNTS.items():
            setattr(settings, f"roster_num_{field}", count)
        for field in ("wild_card", "divisional", "conference", "super_bowl"):
            setattr(settings, f"multiplier_{field}", Decimal(1))
        starters = {i for i, s in enumerate(slot_layout(settings)) if s.slot != BENCH}
        placements = {
            (t["id"], int(round_)): dict(enumerate(ids))
            for t in league["teams"]
            for round_, ids in t["lineups"].items()
        }
        self.lines = point_lines(
            settings,
            starters,
            self.rosters,
            placements,
            self.players,
            self._stats(replay),
        )
        self.champions = {BOUND}

    def _players(self, replay: Replay) -> dict[int, NFLPlayer]:
        players = {
            r["playerId"]: NFLPlayer(
                id=r["playerId"], name=r["name"], position=r["pos"]
            )
            for r in self.sheet
            if r["playerId"]
        }
        for abv, team_id in replay.team_ids.items():
            player_id = dst_player_id(team_id)
            players[player_id] = NFLPlayer(
                id=player_id, name=f"{abv} DST", position="DST"
            )
        return players

    def _stats(self, replay: Replay) -> StatsByPlayer:
        by_player: StatsByPlayer = defaultdict(list)
        for game_id, box in replay.boxes.items():
            if game_id not in GAMES:
                continue
            for row in parse_game_player_stats(game_id, box, set(self.players)):
                by_player[row["player_id"]].append(
                    (NFLPlayerGameStats(**row), WEEK_OF[box["gameWeek"]])
                )
        return by_player

    def sheet_points(self, player_id: int, round_: int) -> float:
        player = self.players[player_id]
        for row in self.sheet:
            if (row["pos"] == "DST" and f"{row['team']} DST" == player.name) or (
                row["playerId"] == player_id
            ):
                return float(row["rounds"][SHEET_ROUND[round_]] or 0)
        raise AssertionError(f"{player.name} is not on the sheet")


@pytest.fixture(scope="module")
def league() -> League:
    return League()


@pytest.fixture(scope="module")
def awards(league: League) -> dict[str, Award]:
    return {
        a.key: a
        for a in compute_awards(
            league.lines, league.players, league.picks, league.champions, league.owners
        )
    }


def test_the_lineup_lines_equal_the_sheet(league: League) -> None:
    # Josh Allen's Wild Card game is not cached (the sheet has 30.22 for it), so only
    # lines whose game we replay are compared.
    scored = [
        ln
        for ln in league.lines
        if ln.starter and ln.round in SHEET_ROUND and ln.played
    ]
    assert sum(1 for ln in scored if ln.points) >= 20
    mismatches = [
        (league.players[ln.player_id].name, ln.round, ln.points)
        for ln in scored
        if abs(float(ln.points) - league.sheet_points(ln.player_id, ln.round)) > 0.01
    ]
    assert mismatches == []


def test_team_totals_are_the_hand_summed_lineups(league: League) -> None:
    totals: dict[int, Decimal] = defaultdict(Decimal)
    for ln in league.lines:
        if ln.starter:
            totals[ln.team_id] += ln.points
    assert dict(totals) == {
        RAMS: Decimal("160.48"),
        BOUND: Decimal("201.96"),
        WARMERS: Decimal("32.92"),
    }


def test_playoff_mvp_is_kyren_williams(
    awards: dict[str, Award], league: League
) -> None:
    # 14.5 + 25.7 = 40.2, ahead of Puka Nacua's 29.5 + 8.7 = 38.2.
    mvp = awards["playoff_mvp"]
    assert league.players[mvp.player_id or 0].name == "Kyren Williams"
    assert (mvp.team_id, mvp.value) == (RAMS, Decimal("40.20"))


def test_champions_mvp_is_bo_nix_on_the_champion_team(
    awards: dict[str, Award], league: League
) -> None:
    # Super Bowl Bound's best: Nix 24.06 (one game), then Myers and SEA DST at 20.
    mvp = awards["champions_mvp"]
    assert league.players[mvp.player_id or 0].name == "Bo Nix"
    assert (mvp.team_id, mvp.value) == (BOUND, Decimal("24.06"))


@pytest.mark.parametrize(
    ("key", "name", "team", "value"),
    [
        ("top_qb", "Matthew Stafford", RAMS, "32.38"),  # 22.16 + 10.22 over Nix 24.06
        ("top_rb", "Kyren Williams", RAMS, "40.20"),
        ("top_wr", "Puka Nacua", RAMS, "38.20"),
        ("top_te", "Colby Parkinson", RAMS, "17.50"),  # 10.4 + 7.1 edges Kincaid 17.3
        ("top_k", "Harrison Mevis", RAMS, "22.20"),  # 12.8 + 9.4 over Myers 20
        ("top_dst", "SEA DST", BOUND, "20.00"),  # 20 over LAR DST 4 + 6 = 10
    ],
)
def test_top_player_at_each_position(
    awards: dict[str, Award], league: League, key: str, name: str, team: int, value: str
) -> None:
    award = awards[key]
    assert league.players[award.player_id or 0].name == name
    assert (award.team_id, award.value) == (team, Decimal(value))


def test_best_single_game_is_puka_nacuas_wild_card(
    awards: dict[str, Award],
) -> None:
    # 29.5 beats Kyren Williams's 25.7 in the Divisional round and Stafford's 22.16.
    game = awards["best_game"]
    assert (game.player_id, game.team_id, game.round, game.value) == (
        PUKA,
        RAMS,
        1,
        Decimal("29.50"),
    )


def test_best_round_is_the_super_bowl_lineup_of_super_bowl_bound(
    awards: dict[str, Award],
) -> None:
    # 17.5 + 17.1 + 15.8 + 13.4 + 20 + 20 = 103.8, ahead of its own R2 (98.16)
    # and the Rams' Wild Card (93.36).
    best = awards["best_round"]
    assert (best.team_id, best.round, best.value) == (BOUND, 4, Decimal("103.80"))


def test_bench_award_goes_to_the_team_that_left_its_stars_unplaced(
    awards: dict[str, Award],
) -> None:
    # Bench Warmers' unplaced CAR players earned 78.06 in the Wild Card; Davante Adams
    # on the Rams' bench earned only 9.7 + 3.4.
    bench = awards["bench_points"]
    assert (bench.team_id, bench.value) == (WARMERS, Decimal("78.06"))


def test_best_draft_value_is_the_kicker_taken_25th(
    awards: dict[str, Award],
) -> None:
    # Counted points rank 20 scorers (Kyren 1st, Puka 2nd, Stafford 3rd ...). Jason
    # Myers and the SEA DST tie at 20.0 for 7th: pick 25 - 7 = 18, pick 23 - 7 = 16.
    # The next best, Mevis (pick 15, 5th) and Mims (pick 19, 9th), are +10.
    value = awards["draft_value"]
    assert (value.player_id, value.team_id, value.value) == (
        2473037,
        BOUND,
        Decimal(18),
    )


def test_biggest_bust_is_a_third_round_pick_who_never_had_a_game(
    awards: dict[str, Award],
) -> None:
    # Jaden Shirden (pick 3) is rostered but has no stats and no lineup line, so the
    # 8 players with no counted points all rank 21st: 3 - 21 = -18. The next worst,
    # Bryce Young (pick 7), is -14.
    bust = awards["bust"]
    assert (bust.player_id, bust.team_id, bust.value) == (
        SHIRDEN,
        WARMERS,
        Decimal(-18),
    )


def test_no_award_for_players_without_points(
    awards: dict[str, Award],
) -> None:
    # Adams (pick 28) outranks 20 scorers' slot on paper (+7) but never counted.
    assert awards["draft_value"].player_id != ADAMS
    assert set(awards) == {
        "playoff_mvp",
        "champions_mvp",
        "top_qb",
        "top_rb",
        "top_wr",
        "top_te",
        "top_k",
        "top_dst",
        "best_game",
        "best_round",
        "bench_points",
        "draft_value",
        "bust",
    }


def test_rounds_without_games_score_nothing(league: League) -> None:
    conference: list[PointsLine] = [ln for ln in league.lines if ln.round == 3]
    assert conference
    assert all(ln.points == 0 and not ln.played for ln in conference)
