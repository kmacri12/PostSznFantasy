"""Orders fantasy teams by total, applying the tiebreaker chain to equal totals.

The chain (docs/product-rules.md section 6): the score of the latest completed round,
then each earlier round back to the Wild Card, then the number of rostered players on
the Super Bowl winner. Teams still level share a rank.
"""

from collections.abc import Mapping
from dataclasses import dataclass, field
from decimal import Decimal

from api.models.enums import TieRule

RoundPoints = tuple[Decimal, Decimal, Decimal, Decimal]


@dataclass(frozen=True)
class RankingFacts:
    """What the chain needs to know about the postseason so far."""

    # 1-based rounds in which every game is final; an unfinished round never decides.
    completed_rounds: frozenset[int] = frozenset()
    # Fantasy team id -> rostered players (starters and bench) on the Super Bowl
    # winner. Empty until the Super Bowl is final.
    super_bowl_players: Mapping[int, int] = field(default_factory=dict)


@dataclass(frozen=True)
class TieReason:
    """Why a team ranks above `over_team_id` although their totals are equal."""

    rule: TieRule
    round: int | None  # for round_score: the 1-based round that separated them
    over_team_id: int
    ahead_value: Decimal
    behind_value: Decimal


@dataclass(frozen=True)
class RankedTeam:
    team_id: int
    rank: int
    total: Decimal
    # Set when this team is ordered above the next one by the chain, not by total.
    tie_reason: TieReason | None


def _chain_key(
    points: RoundPoints, team_id: int, facts: RankingFacts
) -> tuple[Decimal, ...]:
    latest_first = sorted(facts.completed_rounds, reverse=True)
    return (
        *(points[r - 1] for r in latest_first),
        Decimal(facts.super_bowl_players.get(team_id, 0)),
    )


def _reason(
    above: tuple[int, RoundPoints],
    below: tuple[int, RoundPoints],
    facts: RankingFacts,
) -> TieReason | None:
    above_id, above_points = above
    below_id, below_points = below
    if sum(above_points, Decimal(0)) != sum(below_points, Decimal(0)):
        return None
    for round_ in sorted(facts.completed_rounds, reverse=True):
        mine, theirs = above_points[round_ - 1], below_points[round_ - 1]
        if mine != theirs:
            return TieReason(TieRule.ROUND_SCORE, round_, below_id, mine, theirs)
    mine_sb = facts.super_bowl_players.get(above_id, 0)
    theirs_sb = facts.super_bowl_players.get(below_id, 0)
    if mine_sb != theirs_sb:
        return TieReason(
            TieRule.SUPER_BOWL_WINNER,
            None,
            below_id,
            Decimal(mine_sb),
            Decimal(theirs_sb),
        )
    return None


def rank_teams(
    round_points: Mapping[int, RoundPoints], facts: RankingFacts
) -> list[RankedTeam]:
    """Best first; teams level on the total and every chain step share a rank."""
    totals = {t: sum(p, Decimal(0)) for t, p in round_points.items()}
    keys = {
        t: (totals[t], *_chain_key(round_points[t], t, facts)) for t in round_points
    }
    order = sorted(round_points, key=lambda t: (tuple(-k for k in keys[t]), t))
    ranks: list[int] = []
    for position, team_id in enumerate(order, start=1):
        level = position > 1 and keys[order[position - 2]] == keys[team_id]
        ranks.append(ranks[-1] if level else position)
    return [
        RankedTeam(
            team_id,
            ranks[index],
            totals[team_id],
            _reason(
                (team_id, round_points[team_id]),
                (order[index + 1], round_points[order[index + 1]]),
                facts,
            )
            if index + 1 < len(order)
            else None,
        )
        for index, team_id in enumerate(order)
    ]
