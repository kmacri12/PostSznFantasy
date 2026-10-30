from dataclasses import dataclass
from decimal import Decimal


@dataclass(frozen=True)
class TeamTally:
    team_id: int
    players_left: int
    round_points: tuple[Decimal, Decimal, Decimal, Decimal]


@dataclass(frozen=True)
class RankedTeam:
    team_id: int
    rank: int
    players_left: int
    round_points: tuple[Decimal, Decimal, Decimal, Decimal]
    total: Decimal


def rank_teams(tallies: list[TeamTally]) -> list[RankedTeam]:
    """Order by total points, then players left; teams level on both share a rank."""
    keyed = sorted(
        ((sum(t.round_points, Decimal(0)), t) for t in tallies),
        key=lambda pair: (-pair[0], -pair[1].players_left, pair[1].team_id),
    )
    ranked: list[RankedTeam] = []
    for position, (total, tally) in enumerate(keyed, start=1):
        previous = ranked[-1] if ranked else None
        level = (
            previous is not None
            and previous.total == total
            and previous.players_left == tally.players_left
        )
        ranked.append(
            RankedTeam(
                tally.team_id,
                previous.rank if previous is not None and level else position,
                tally.players_left,
                tally.round_points,
                total,
            )
        )
    return ranked
