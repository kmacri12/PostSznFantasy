from decimal import Decimal

from api.db.models.nfl import NFLPlayer
from api.services.awards import Award, compute_awards
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
PICKS = {1: 4, 2: 1, 3: 2, 4: 3}  # player id -> overall pick number


def awards() -> dict[str, Award]:
    return {a.key: a for a in compute_awards(LINES, PLAYERS, PICKS, {20})}


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


def test_draft_value_is_the_pick_number_minus_the_rank_by_counted_points() -> None:
    result = awards()
    # Ranks by counted points: Ray 1, Quinn 2, Wes 3, Bo 4 (never started).
    # Values: Quinn 4-2=2, Ray 1-1=0, Bo 2-4=-2, Wes 3-3=0.
    assert (result["draft_value"].player_id, result["draft_value"].value) == (1, 2)  # type: ignore[comparison-overlap]
    assert (result["bust"].player_id, result["bust"].value) == (3, -2)  # type: ignore[comparison-overlap]


def test_no_awards_when_nobody_scored() -> None:
    assert compute_awards([], PLAYERS, PICKS, set()) == []
