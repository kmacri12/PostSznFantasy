"""Where each rostered player stands in a round (the dots on the Team and League pages).

Four statuses cover the whole roster: advanced (his team won the round, or is on a bye), live,
to play (the game has not started) and eliminated (his team lost, now or earlier). The SPA's
`playerStatus` in `lineupView.ts` applies the same rule to a lineup player.
"""

from collections.abc import Iterable
from datetime import datetime

from api.models.enums import GameState, PlayerRoundStatus
from api.models.league_models import RosterStatus
from api.services.round_status import ROUNDS, GameFacts, TeamRound, round_status


def status_round(games: list[GameFacts], now: datetime) -> int:
    """The latest round whose first kickoff has passed, so a win stays "advanced" until the next
    round's first kickoff. Before any kickoff, the first round with games."""
    started = [g.round for g in games if g.kickoff and g.kickoff <= now]
    if started:
        return max(started)
    return min((g.round for g in games), default=ROUNDS[0])


def _tally(team: TeamRound, counts: dict[str, int]) -> None:
    if team.status is PlayerRoundStatus.ELIMINATED:
        counts["eliminated"] += 1
    elif team.status is PlayerRoundStatus.BYE:
        counts["advanced"] += 1
    elif team.game_state is GameState.LIVE:
        counts["live"] += 1
    elif (
        team.game_state is GameState.FINAL
        and team.points is not None
        and team.opponent_points is not None
        and team.points != team.opponent_points
    ):
        counts["advanced" if team.points > team.opponent_points else "eliminated"] += 1
    else:
        counts["to_play"] += 1


def roster_status(
    games: list[GameFacts], nfl_team_ids: Iterable[int | None], round_: int
) -> RosterStatus | None:
    """The counts for one fantasy team's roster; None for an empty roster."""
    counts = {"advanced": 0, "live": 0, "to_play": 0, "eliminated": 0}
    total = 0
    for nfl_team_id in nfl_team_ids:
        _tally(round_status(games, nfl_team_id, round_), counts)
        total += 1
    return RosterStatus(**counts) if total else None
