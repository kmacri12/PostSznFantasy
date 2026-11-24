def test_rank_movement_compares_with_the_round_before() -> None:
    from decimal import Decimal as D

    from api.services.ranking import RankingFacts, rank_movement

    points = {
        1: (D(10), D(0), D(0), D(0)),
        2: (D(5), D(20), D(0), D(0)),
        3: (D(1), D(1), D(0), D(0)),
    }
    moves = rank_movement(points, RankingFacts(frozenset({1, 2})), 2)
    assert moves == {1: -1, 2: 1, 3: 0}
    assert rank_movement(points, RankingFacts(frozenset({1})), 1) == {}
