from decimal import Decimal

from api.models.enums import TieRule
from api.services.ranking import RankingFacts, TieReason, rank_teams

NO_FACTS = RankingFacts()


def pts(*rounds: str) -> tuple[Decimal, Decimal, Decimal, Decimal]:
    a, b, c, d = [Decimal(r) for r in rounds] + [Decimal(0)] * (4 - len(rounds))
    return (a, b, c, d)


def test_more_points_ranks_higher_and_total_sums_rounds() -> None:
    ranked = rank_teams({1: pts("10", "5.5"), 2: pts("20")}, NO_FACTS)
    assert [(r.team_id, r.rank, r.total, r.tie_reason) for r in ranked] == [
        (2, 1, Decimal("20"), None),
        (1, 2, Decimal("15.5"), None),
    ]


def test_teams_level_on_every_step_share_a_rank_and_the_next_is_skipped() -> None:
    ranked = rank_teams(
        {3: pts("5"), 1: pts("5"), 2: pts("9"), 4: pts("1")},
        RankingFacts(completed_rounds=frozenset({1})),
    )
    assert [(r.team_id, r.rank) for r in ranked] == [(2, 1), (1, 2), (3, 2), (4, 4)]
    assert [r.tie_reason for r in ranked] == [None, None, None, None]


def test_all_zero_teams_all_rank_first() -> None:
    ranked = rank_teams({1: pts(), 2: pts()}, NO_FACTS)
    assert [r.rank for r in ranked] == [1, 1]


def test_equal_totals_go_to_the_latest_completed_round() -> None:
    facts = RankingFacts(completed_rounds=frozenset({1, 2}))
    ranked = rank_teams({1: pts("30", "20"), 2: pts("20", "30")}, facts)

    assert [(r.team_id, r.rank) for r in ranked] == [(2, 1), (1, 2)]
    assert ranked[0].tie_reason == TieReason(
        rule=TieRule.ROUND_SCORE,
        round=2,
        over_team_id=1,
        ahead_value=Decimal("30"),
        behind_value=Decimal("20"),
    )
    assert ranked[1].tie_reason is None


def test_a_round_still_being_played_is_not_a_tiebreaker() -> None:
    # Divisional is under way: the Wild Card is the latest completed round.
    facts = RankingFacts(completed_rounds=frozenset({1}))
    ranked = rank_teams({1: pts("20", "30"), 2: pts("30", "20")}, facts)

    assert [
        (r.team_id, r.tie_reason.round if r.tie_reason else None) for r in ranked
    ] == [
        (2, 1),
        (1, None),
    ]


def test_a_tie_in_the_latest_round_walks_back_to_earlier_rounds() -> None:
    facts = RankingFacts(completed_rounds=frozenset({1, 2, 3}))
    ranked = rank_teams(
        {1: pts("10", "20", "20"), 2: pts("20", "10", "20")},
        facts,
    )

    # Round 3 is level at 20 each, so round 2 decides: team 1's 20 beats team 2's 10.
    assert [r.team_id for r in ranked] == [1, 2]
    assert ranked[0].tie_reason is not None
    assert (ranked[0].tie_reason.rule, ranked[0].tie_reason.round) == (
        TieRule.ROUND_SCORE,
        2,
    )


def test_the_walk_ends_at_the_wild_card() -> None:
    facts = RankingFacts(completed_rounds=frozenset({1, 2}))
    ranked = rank_teams({1: pts("25", "25"), 2: pts("25", "25")}, facts)
    assert [r.rank for r in ranked] == [1, 1]
    assert [r.tie_reason for r in ranked] == [None, None]


def test_level_rounds_fall_to_players_on_the_super_bowl_winner() -> None:
    facts = RankingFacts(
        completed_rounds=frozenset({1, 2, 3, 4}),
        super_bowl_players={1: 2, 2: 5},
    )
    ranked = rank_teams(
        {1: pts("10", "10", "10", "10"), 2: pts("10", "10", "10", "10")}, facts
    )

    assert [(r.team_id, r.rank) for r in ranked] == [(2, 1), (1, 2)]
    assert ranked[0].tie_reason == TieReason(
        rule=TieRule.SUPER_BOWL_WINNER,
        round=None,
        over_team_id=1,
        ahead_value=Decimal(5),
        behind_value=Decimal(2),
    )


def test_a_team_with_no_players_on_the_winner_counts_zero() -> None:
    facts = RankingFacts(
        completed_rounds=frozenset({1, 2, 3, 4}), super_bowl_players={2: 1}
    )
    ranked = rank_teams({1: pts("10"), 2: pts("10")}, facts)
    assert [r.team_id for r in ranked] == [2, 1]


def test_equal_players_on_the_winner_share_the_title() -> None:
    facts = RankingFacts(
        completed_rounds=frozenset({1, 2, 3, 4}),
        super_bowl_players={1: 3, 2: 3},
    )
    ranked = rank_teams({1: pts("10"), 2: pts("10")}, facts)
    assert [r.rank for r in ranked] == [1, 1]
    assert [r.tie_reason for r in ranked] == [None, None]


def test_super_bowl_players_are_ignored_until_there_is_a_winner() -> None:
    # No Super Bowl winner yet means no counts, so nothing separates the teams.
    ranked = rank_teams({1: pts("10"), 2: pts("10")}, RankingFacts())
    assert [r.rank for r in ranked] == [1, 1]


def test_each_neighbouring_pair_gets_its_own_reason() -> None:
    facts = RankingFacts(completed_rounds=frozenset({1, 2}))
    ranked = rank_teams(
        {
            1: pts("30", "10"),  # 40, loses the latest round to 2
            2: pts("10", "30"),  # 40, wins round 2 over 1 and 3
            3: pts("20", "30"),  # 50
            4: pts("5", "5"),  # 10
        },
        facts,
    )
    assert [r.team_id for r in ranked] == [3, 2, 1, 4]
    assert [r.tie_reason is not None for r in ranked] == [False, True, False, False]
    assert ranked[1].tie_reason is not None
    assert ranked[1].tie_reason.over_team_id == 1
