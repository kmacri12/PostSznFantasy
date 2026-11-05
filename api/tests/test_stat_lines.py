from api.db.models import NFLPlayerGameStats
from api.models.enums import PlayerPosition
from api.services.stat_lines import stat_line


def stats(**fields: int) -> NFLPlayerGameStats:
    return NFLPlayerGameStats(game_id="g", player_id=1, **fields)


def test_no_rows_means_no_line() -> None:
    assert stat_line([], PlayerPosition.QB) is None


def test_quarterback_line_adds_rushing_yards_only_when_he_ran() -> None:
    passing = dict(
        passing_completions=22, passing_attempts=31, passing_yards=241,
        passing_touchdowns=3, passing_interceptions=1,
    )  # fmt: skip
    assert stat_line([stats(**passing)], PlayerPosition.QB) == (
        "22/31, 241 yds, 3 TD, 1 INT"
    )
    ran = stats(**passing, rushing_carries=4, rushing_yards=33)
    assert stat_line([ran], PlayerPosition.QB) == (
        "22/31, 241 yds, 3 TD, 1 INT · 33 rush yds"
    )


def test_running_back_always_shows_rushing_and_receiving_only_when_he_caught_one() -> (
    None
):
    rushing = dict(rushing_carries=15, rushing_yards=88, rushing_touchdowns=1)
    assert stat_line([stats(**rushing)], PlayerPosition.RB) == "15 car, 88 yds, 1 TD"
    caught = stats(**rushing, receiving_receptions=2, receiving_yards=9)
    assert stat_line([caught], PlayerPosition.RB) == (
        "15 car, 88 yds, 1 TD · 2 rec, 9 yds"
    )


def test_receivers_always_show_receiving_and_hide_zero_rushing() -> None:
    row = stats(receiving_receptions=5, receiving_yards=74, receiving_touchdowns=1)
    assert stat_line([row], PlayerPosition.WR) == "5 rec, 74 yds, 1 TD"
    assert stat_line([stats()], PlayerPosition.TE) == "0 rec, 0 yds"
    swept = stats(receiving_receptions=1, receiving_yards=5, rushing_carries=1)
    assert stat_line([swept], PlayerPosition.WR) == "1 rec, 5 yds · 1 car, 0 yds"


def test_kicker_line_counts_makes_over_attempts() -> None:
    row = stats(
        kicking_fg_made=2, kicking_fg_missed=0, kicking_xp_made=3, kicking_xp_missed=0
    )
    assert stat_line([row], PlayerPosition.K) == "2/2 FG, 3/3 XP"


def test_defense_lists_plays_then_points_allowed() -> None:
    row = stats(dst_sacks=3, dst_interceptions=1, dst_points_allowed=17)
    assert stat_line([row], PlayerPosition.DST) == "3 sacks, 1 INT · 17 pts allowed"
    assert stat_line([stats()], PlayerPosition.DST) == "0 pts allowed"


def test_a_team_unit_sums_its_members() -> None:
    rows = [stats(rushing_carries=1, rushing_yards=2), stats(rushing_carries=2)]
    assert stat_line(rows, PlayerPosition.RB) == "3 car, 2 yds"
