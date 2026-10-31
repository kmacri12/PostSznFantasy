"""The commissioner's real 2025 league, replayed end to end.

Rosters, draft, lineups and the sheet's own points come from the workbook
(`fixtures/golden_2025/league_2025.json`); the stats are all 14 cached postseason box
scores. Standings and the points awards are checked against numbers read straight off
the sheet, independent of the awards code. The draft and bench awards have no sheet
counterpart, so they are pinned to hand-derived values explained next to each.
"""

from collections import defaultdict
from decimal import Decimal
from pathlib import Path

import pytest

from api.services.awards import Award
from api.tests.golden_league import RealLeague, report

KMAC, STEARNS, SLADE, MATT, FERG, CRAIG = (1, 2, 3, 4, 5, 6)


@pytest.fixture(scope="module")
def league() -> RealLeague:
    return RealLeague()


@pytest.fixture(scope="module")
def awards(league: RealLeague) -> dict[str, Award]:
    return {a.key: a for a in league.awards}


def sheet_cells(league: RealLeague) -> list[tuple[str, int, str, str, Decimal]]:
    """(team, round, slot, player label, points) for every lineup cell in the sheet."""
    return [
        (
            t["name"],
            int(round_),
            row["slot"],
            row["player"],
            Decimal(str(row["sheetPoints"] or 0)),
        )
        for t in league.snapshot["teams"]
        for round_, rows in t["lineups"].items()
        for row in rows
        if row["player"]
    ]


def test_every_lineup_slot_matches_the_sheet_to_the_cent(league: RealLeague) -> None:
    assert league.slot_differences() == []
    assert len(sheet_cells(league)) > 150


def test_standings_equal_the_sheets_home_tab(league: RealLeague) -> None:
    by_name = {t["name"]: t["sheetTotals"] for t in league.snapshot["teams"]}
    for _rank, team in league.ranking():
        name = league.team_names[team - 1]
        assert [float(p) for p in league.round_points[team]] == pytest.approx(
            by_name[name][:4], abs=0.01
        )
        assert float(league.totals[team]) == pytest.approx(by_name[name][4], abs=0.01)
    assert [(rank, league.team_names[t - 1]) for rank, t in league.ranking()] == [
        (1, "KMac"),
        (2, "Matt"),
        (3, "Ferg"),
        (4, "Stearns"),
        (5, "Slade"),
        (6, "Craig"),
    ]
    assert league.champions == {KMAC}


def test_playoff_mvp_is_the_top_summed_slot_in_the_sheet(
    league: RealLeague, awards: dict[str, Award]
) -> None:
    per_player: dict[str, Decimal] = defaultdict(Decimal)
    for _, _, _, label, points in sheet_cells(league):
        per_player[label] += points
    label, total = max(per_player.items(), key=lambda kv: kv[1])
    # KMac's sheet: Walker 34 + 19.1 + 17.1 (Divisional, Conference, Super Bowl).
    assert (label, total) == ("Kenneth Walker III (SEA) RB", Decimal("70.2"))
    assert league.name(awards["playoff_mvp"].player_id or 0) == "Kenneth Walker III"
    assert awards["playoff_mvp"].team_id == KMAC
    assert awards["playoff_mvp"].value == total


def test_best_game_and_best_round_match_the_sheet(
    league: RealLeague, awards: dict[str, Award]
) -> None:
    cells = sheet_cells(league)
    best_cell = max(cells, key=lambda c: c[4])
    assert (best_cell[3], best_cell[4]) == (
        "Kenneth Walker III (SEA) RB",
        Decimal("34"),
    )
    game = awards["best_game"]
    assert (league.name(game.player_id or 0), game.round, game.value) == (
        "Kenneth Walker III",
        2,
        Decimal("34.00"),
    )
    # Matt's Wild Card 129.66 is the highest round score on the Home tab.
    best_round = awards["best_round"]
    assert (best_round.team_id, best_round.round, best_round.value) == (
        MATT,
        1,
        Decimal("129.66"),
    )


def test_champions_mvp_is_the_champions_top_scorer(
    league: RealLeague, awards: dict[str, Award]
) -> None:
    # Walker is also KMac's top scorer: KMac's other leaders are SEA DST (41),
    # Smith-Njigba (40.4) and Myers (37.2).
    mvp = awards["champions_mvp"]
    assert (league.name(mvp.player_id or 0), mvp.team_id) == (
        "Kenneth Walker III",
        KMAC,
    )


@pytest.mark.parametrize(
    ("key", "name", "team", "value"),
    [
        # Stearns' Maye: 17.32 + 14.16 + 15.94 + 17.5 over Stafford's 60.94.
        ("top_qb", "Drake Maye", STEARNS, "64.92"),
        ("top_rb", "Kenneth Walker III", KMAC, "70.20"),
        # Ferg's sheet: Puka 29.5 + 8.7 + 27.4.
        ("top_wr", "Puka Nacua", FERG, "65.60"),
        ("top_te", "Colston Loveland", FERG, "27.30"),  # 19.7 + 7.6
        ("top_k", "Jason Myers", KMAC, "37.20"),  # 10.5 + 6.7 + 20
        ("top_dst", "NE DST", STEARNS, "49.00"),  # 14 + 19 + 14 + 2
    ],
)
def test_top_player_at_each_position(
    league: RealLeague,
    awards: dict[str, Award],
    key: str,
    name: str,
    team: int,
    value: str,
) -> None:
    award = awards[key]
    assert (league.name(award.player_id or 0), award.team_id, award.value) == (
        name,
        team,
        Decimal(value),
    )


def test_bench_award_goes_to_slade(
    league: RealLeague, awards: dict[str, Award]
) -> None:
    # Slade left Purdy (16.88 + 6.16), Hubbard (18.9), Kincaid (10.3), Knox (4.5 + 4.7),
    # Diggs (5.2), Coleman (4.1), Davis (2.4) and Dowdle (2) on the bench: 75.14.
    bench = awards["bench_points"]
    assert (bench.team_id, bench.value) == (SLADE, Decimal("75.14"))


def test_best_draft_value_is_the_kicker_taken_89th(
    league: RealLeague, awards: dict[str, Award]
) -> None:
    # Of 108 drafted players 81 scored counted points. Myers (pick 89, 37.2) ranks 13th
    # by counted points: 89 - 13 = +76.
    value = awards["draft_value"]
    assert (league.name(value.player_id or 0), value.team_id, value.value) == (
        "Jason Myers",
        KMAC,
        Decimal(76),
    )
    assert league.picks[value.player_id or 0] == 89


def test_biggest_bust_started_once_and_lost_a_tenth(
    league: RealLeague, awards: dict[str, Award]
) -> None:
    # Omarion Hampton (pick 31) started for Craig in the Wild Card and counted -0.10,
    # below every zero-point player, so he ranks last of 108: 31 - 108 = -77.
    bust = awards["bust"]
    assert (league.name(bust.player_id or 0), bust.team_id, bust.value) == (
        "Omarion Hampton",
        CRAIG,
        Decimal(-77),
    )
    assert league.picks[bust.player_id or 0] == 31


def test_every_award_is_given(awards: dict[str, Award]) -> None:
    assert len(awards) == 13


def test_the_report_names_the_champion_and_the_awards() -> None:
    text = report()
    assert "**Champion: KMac.**" in text
    assert "| Biggest bust | Omarion Hampton | Craig |" in text


def test_the_committed_report_is_current() -> None:
    committed = (
        Path(__file__).parents[2] / "docs" / "research" / "awards-2025-replay.md"
    )
    assert committed.read_text() == report(), (
        "regenerate: python -m api.tests.golden_league > docs/research/awards-2025-replay.md"
    )
