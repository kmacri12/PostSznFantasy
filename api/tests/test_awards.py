from decimal import Decimal

from api.db.models.nfl import NFLPlayer
from api.services.awards import Award, DraftValue, compute_awards
from api.services.round_points import PointsLine


def line(
    team: int, round_: int, player: int, points: str, *, starter: bool = True
) -> PointsLine:
    return PointsLine(
        team, round_, player, 0 if starter else None, starter, True, Decimal(points)
    )


PLAYERS = {
    1: NFLPlayer(id=1, name="Quinn QB", position="QB"),
    2: NFLPlayer(id=2, name="Ray RB", position="RB"),
    3: NFLPlayer(id=3, name="Bo Bench", position="RB"),
    4: NFLPlayer(id=4, name="Wes WR", position="WR"),
}
# team 10 owns players 1 and 2 (+ the bencher 3); team 20 owns player 4.
LINES = [
    line(10, 1, 1, "20"),
    line(10, 2, 1, "10"),
    line(10, 1, 2, "5"),
    line(10, 2, 2, "40"),
    line(10, 1, 3, "50", starter=False),
    line(20, 1, 4, "12"),
    line(20, 2, 4, "13"),
]
OWNERS = {1: 10, 2: 10, 3: 10, 4: 20}
PICKS = {1: 4, 2: 1, 3: 2, 4: 3}  # player id -> overall pick number


def awards() -> dict[str, Award]:
    return {a.key: a for a in compute_awards(LINES, PLAYERS, PICKS, {20}, OWNERS)}


def test_playoff_mvp_is_the_top_counted_scorer_and_ignores_the_bench() -> None:
    mvp = awards()["playoff_mvp"]
    assert (mvp.player_id, mvp.team_id, mvp.value) == (2, 10, Decimal("45"))


def test_champions_mvp_is_the_top_scorer_on_the_champion_team() -> None:
    mvp = awards()["champions_mvp"]
    assert (mvp.player_id, mvp.team_id, mvp.value) == (4, 20, Decimal("25"))


def test_top_player_at_each_position_that_scored() -> None:
    result = awards()
    assert result["top_qb"].player_id == 1
    assert result["top_rb"].player_id == 2
    assert result["top_wr"].player_id == 4
    assert "top_te" not in result


def test_best_single_game_is_one_players_counted_round() -> None:
    game = awards()["best_game"]
    assert (game.player_id, game.round, game.value) == (2, 2, Decimal("40"))


def test_best_round_is_a_teams_counted_total_for_one_round() -> None:
    best = awards()["best_round"]
    assert (best.team_id, best.round, best.value) == (10, 2, Decimal("50"))


def test_bench_points_are_summed_per_team() -> None:
    bench = awards()["bench_points"]
    assert (bench.team_id, bench.value) == (10, Decimal("50"))


def test_draft_value_compares_draft_order_with_finish_within_the_position() -> None:
    # Bo is taken before Ray among RBs but never started: Ray drafted RB2, finished
    # RB1; Bo drafted RB1, finished RB2.
    picks = {**PICKS, 2: 3, 3: 1}
    result = {a.key: a for a in compute_awards(LINES, PLAYERS, picks, {20}, OWNERS)}
    ray, bo = result["best_value_rb"], result["bust_rb"]
    assert (ray.player_id, ray.value) == (2, Decimal(1))
    assert (bo.player_id, bo.value) == (3, Decimal(-1))
    assert ray.draft == DraftValue(2, 1, 1, Decimal("45"))
    assert bo.draft == DraftValue(1, 2, -1, Decimal("0"))
    assert (ray.pick_number, bo.pick_number) == (3, 1)


def test_a_lone_player_at_a_position_gets_both_awards_at_zero() -> None:
    result = awards()
    for key in ("best_value_qb", "bust_qb"):
        assert (result[key].player_id, result[key].value) == (1, Decimal(0))
    assert "best_value_te" not in result


def test_a_best_value_can_be_negative() -> None:
    # Ray (pick 1) and Bo (pick 2) are the only RBs, both with gap 0; add a better
    # RB drafted last so both fall behind him: Ray 1-2, Bo 2-3.
    players = {**PLAYERS, 6: NFLPlayer(id=6, name="Late RB", position="RB")}
    lines = [*LINES, line(20, 1, 6, "100")]
    picks = {**PICKS, 6: 9}
    result = {
        a.key: a for a in compute_awards(lines, players, picks, {20}, {**OWNERS, 6: 20})
    }
    assert result["best_value_rb"].player_id == 6
    assert result["best_value_rb"].value == 2
    assert result["bust_rb"].value == -1


def test_players_level_on_points_share_the_better_finish_rank() -> None:
    players = {
        1: NFLPlayer(id=1, name="A", position="WR"),
        2: NFLPlayer(id=2, name="B", position="WR"),
        3: NFLPlayer(id=3, name="C", position="WR"),
    }
    lines = [line(10, 1, 1, "5"), line(10, 1, 2, "5"), line(10, 1, 3, "9")]
    result = {
        a.key: a
        for a in compute_awards(
            lines, players, {1: 1, 2: 2, 3: 3}, set(), {1: 10, 2: 10, 3: 10}
        )
    }
    # C: drafted 3rd, finished 1st (+2). A and B tie for 2nd: A 1-2=-1, B 2-2=0.
    assert (result["best_value_wr"].player_id, result["best_value_wr"].value) == (
        3,
        Decimal(2),
    )
    assert (result["bust_wr"].player_id, result["bust_wr"].value) == (1, Decimal(-1))


def test_no_awards_when_nobody_scored() -> None:
    assert compute_awards([], PLAYERS, PICKS, set(), {}) == []


def test_a_rostered_player_with_no_line_can_still_be_the_biggest_bust() -> None:
    # Player 5 was drafted first overall, never started and never played.
    players = {**PLAYERS, 5: NFLPlayer(id=5, name="Pat", position="RB")}
    result = {
        a.key: a
        for a in compute_awards(
            LINES, players, {**PICKS, 5: 0}, {20}, {**OWNERS, 5: 20}
        )
    }
    assert (result["bust_rb"].player_id, result["bust_rb"].team_id) == (5, 20)
