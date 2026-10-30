"""Where a fantasy team's starters stand in a round: finished, live, to play or out."""

from collections.abc import Sequence

from api.models.enums import PlayerRoundStatus
from api.models.league_models import StarterProgress
from api.services.round_status import GameFacts, round_status


def starter_progress(
    games: list[GameFacts],
    round_: int,
    starter_teams: Sequence[int | None],
    slot_count: int,
) -> StarterProgress:
    """`starter_teams` holds the NFL team of each filled starter slot (None: no team).

    Slots beyond the filled ones are empty. Empty slots, eliminated players, byes and
    players without a team all count as not playing.
    """
    finished = live = to_play = 0
    for nfl_team_id in starter_teams:
        if nfl_team_id is None:
            continue
        if (
            round_status(games, nfl_team_id, round_).status
            is not PlayerRoundStatus.ALIVE
        ):
            continue
        own = next(
            (
                g
                for g in games
                if g.round == round_ and nfl_team_id in (g.home_team_id, g.away_team_id)
            ),
            None,
        )
        if own is not None and own.completed:
            finished += 1
        elif own is not None and own.in_progress:
            live += 1
        else:
            to_play += 1
    return StarterProgress(
        finished=finished,
        live=live,
        to_play=to_play,
        not_playing=slot_count - finished - live - to_play,
    )
