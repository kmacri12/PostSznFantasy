from decimal import Decimal

from api.services.standings import TeamTally, rank_teams


def tally(team_id: int, left: int, *rounds: str) -> TeamTally:
    padded = [Decimal(r) for r in rounds] + [Decimal(0)] * (4 - len(rounds))
    return TeamTally(team_id, left, tuple(padded))


def test_more_points_ranks_higher_and_total_sums_rounds() -> None:
    ranked = rank_teams([tally(1, 3, "10", "5.5"), tally(2, 3, "20")])
    assert [(r.team_id, r.rank, r.total) for r in ranked] == [
        (2, 1, Decimal("20")),
        (1, 2, Decimal("15.5")),
    ]


def test_equal_points_are_split_by_players_left() -> None:
    ranked = rank_teams([tally(1, 1, "10"), tally(2, 4, "10")])
    assert [(r.team_id, r.rank) for r in ranked] == [(2, 1), (1, 2)]


def test_full_ties_share_a_rank_and_the_next_rank_is_skipped() -> None:
    ranked = rank_teams(
        [tally(3, 2, "5"), tally(1, 2, "5"), tally(2, 2, "9"), tally(4, 0, "1")]
    )
    assert [(r.team_id, r.rank) for r in ranked] == [(2, 1), (1, 2), (3, 2), (4, 4)]


def test_all_zero_teams_all_rank_first() -> None:
    ranked = rank_teams([tally(1, 4), tally(2, 4)])
    assert [r.rank for r in ranked] == [1, 1]
