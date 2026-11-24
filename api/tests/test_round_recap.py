from decimal import Decimal

from api.models.activity_models import RoundHighlight
from api.services.round_points import PointsLine
from api.services.round_recap import round_highlights, team_scores

A, B, C, D = 1, 2, 3, 4
NAMES = {A: "Kmac", B: "Team 2", C: "Team 3", D: "Team 4"}
PLAYERS = {10: "Josh Allen", 11: "Backup Wr", 12: "Star Rb"}


def line(team: int, player: int, points: str, starter: bool = True) -> PointsLine:
    return PointsLine(
        team, 1, player, 0 if starter else None, starter, True, Decimal(points)
    )


def kinds(highlights: list[RoundHighlight]) -> list[str]:
    return [h.kind for h in highlights]


def build(
    *,
    team_names: dict[int, str] | None = None,
    lines: list[PointsLine] | None = None,
    rank_before: dict[int, int] | None = None,
    rank_after: dict[int, int] | None = None,
    players_lost: dict[int, int] | None = None,
) -> list[RoundHighlight]:
    return round_highlights(
        team_names=team_names if team_names is not None else NAMES,
        lines=lines
        if lines is not None
        else [
            line(A, 10, "40"),
            line(B, 12, "20"),
            line(C, 12, "15.5"),
            line(D, 10, "5"),
        ],
        player_names=PLAYERS,
        rank_before=rank_before,
        rank_after=rank_after if rank_after is not None else {A: 1, B: 2, C: 3, D: 4},
        players_lost=players_lost
        if players_lost is not None
        else {A: 1, B: 1, C: 1, D: 1},
    )


def test_the_best_and_worst_team_and_the_top_starter_are_always_named() -> None:
    result = build()
    assert kinds(result) == ["top_team", "low_team", "top_starter"]
    assert result[0].text == "Kmac led the week with 40."
    assert [h.stat for h in result] == ["40", "5", "40"]
    assert result[1].text == "Team 4 had the toughest week with 5."
    assert "Josh Allen was the top starter with 40 for Kmac" in result[2].text


def test_the_top_bench_scorer_in_the_league_is_always_named() -> None:
    small = build(lines=[line(A, 10, "40"), line(B, 11, "2.5", starter=False)])
    bench = next(h for h in small if h.kind == "top_bench")
    assert bench.text == "Backup Wr scored 2.5 on Team 2's bench."
    assert bench.stat == "2.5"
    nobody = build(lines=[line(A, 10, "40"), line(B, 11, "0", starter=False)])
    assert "top_bench" not in kinds(nobody)


def test_only_moves_of_two_or_more_places_count() -> None:
    result = build(
        rank_before={A: 1, B: 4, C: 3, D: 2},
        rank_after={A: 1, B: 2, C: 4, D: 3},
    )
    climber = next(h for h in result if h.kind == "climber")
    assert climber.text == "Team 2 climbed 2 spots to 2nd."
    assert climber.stat == "+2"
    assert "faller" not in kinds(result)  # a one-place drop is not news


def test_a_fall_is_named_and_the_first_round_has_no_moves() -> None:
    fell = build(
        rank_before={A: 3, B: 1, C: 2, D: 4},
        rank_after={A: 1, B: 2, C: 3, D: 4},
    )
    assert next(h for h in fell if h.kind == "climber").text == (
        "Kmac climbed 2 spots to 1st."
    )
    assert "climber" not in kinds(build(rank_before=None))


def test_heavy_eliminations_and_the_fewest_are_named() -> None:
    result = build(players_lost={A: 0, B: 4, C: 1, D: 0})
    assert next(h for h in result if h.kind == "most_lost").text == (
        "Team 2 had 4 players eliminated."
    )
    survivor = next(h for h in result if h.kind == "fewest_lost")
    assert survivor.text == "Kmac and Team 4 had the fewest players eliminated (0)."
    assert survivor.stat == "0"


def test_the_survivor_is_the_fewest_even_when_nobody_lost_none() -> None:
    result = build(players_lost={A: 2, B: 3, C: 3, D: 4})
    survivor = next(h for h in result if h.kind == "fewest_lost")
    assert survivor.text == "Kmac had the fewest players eliminated (2)."
    assert survivor.team_id == A
    many = build(players_lost={A: 1, B: 1, C: 1, D: 5})
    assert next(h for h in many if h.kind == "fewest_lost").text == (
        "3 teams had the fewest players eliminated (1)."
    )


def test_nothing_to_say_about_eliminations_when_everyone_is_alike() -> None:
    assert not {"most_lost", "fewest_lost"} & set(
        kinds(build(players_lost={A: 2, B: 2, C: 2, D: 2}))
    )


def test_team_scores_rank_every_owned_team_best_first() -> None:
    scores = team_scores(
        NAMES,
        [line(B, 12, "20"), line(A, 10, "40"), line(A, 11, "2", starter=False)],
    )
    assert [(s.team_name, s.points) for s in scores] == [
        ("Kmac", 40.0),
        ("Team 2", 20.0),
        ("Team 3", 0.0),
        ("Team 4", 0.0),
    ]


def test_unowned_teams_and_tiny_leagues_are_left_out() -> None:
    assert build(team_names={A: "Kmac"}) == []
    two = build(team_names={A: "Kmac", B: "Team 2"})
    assert "low_team" not in kinds(two)  # worst of two is just the other one
