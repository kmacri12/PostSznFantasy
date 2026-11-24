"""The dots: every rostered player is advanced, live, to play or eliminated in the round shown."""

from datetime import UTC, datetime

from api.services.roster_status import roster_status
from api.services.round_status import GameFacts

KC, BUF, DEN, MIA, SEA, GB = 1, 2, 3, 4, 5, 6


def at(day: int, hour: int = 18) -> datetime:
    return datetime(2027, 1, day, hour, tzinfo=UTC)


def game(
    round_: int,
    home: int,
    away: int,
    day: int,
    score: tuple[int, int] | None = None,
    live: bool = False,
) -> GameFacts:
    return GameFacts(
        round=round_,
        home_team_id=home,
        away_team_id=away,
        kickoff=at(day),
        completed=score is not None,
        home_points=score[0] if score else None,
        away_points=score[1] if score else None,
        in_progress=live,
    )


def test_a_round_counts_wins_live_waiting_and_losses_across_the_roster() -> None:
    games = [
        game(1, KC, BUF, 9, score=(27, 20)),
        game(1, DEN, MIA, 9, live=True),
        game(1, SEA, GB, 10),
    ]
    status = roster_status(games, [KC, BUF, DEN, MIA, SEA, GB, None], 1)
    assert status is not None
    assert (status.advanced, status.live, status.to_play, status.eliminated) == (
        1,
        2,
        3,
        1,
    )


def test_a_bye_advances_and_an_earlier_exit_stays_out() -> None:
    games = [
        game(1, KC, BUF, 9, score=(27, 20)),
        game(1, DEN, MIA, 9, score=(10, 13)),
        game(2, KC, MIA, 16),
    ]
    first = roster_status(games, [SEA], 1)  # no game in a round that has games: a bye
    assert first is not None and first.advanced == 1
    second = roster_status(games, [KC, MIA, BUF, DEN], 2)
    assert second is not None
    assert (second.to_play, second.eliminated) == (2, 2)


def test_an_empty_roster_has_no_status() -> None:
    assert roster_status([game(1, KC, BUF, 9)], [], 1) is None


def test_nobody_is_eliminated_from_the_super_bowl() -> None:
    games = [
        game(3, KC, BUF, 24, score=(30, 20)),
        game(3, DEN, MIA, 24, score=(10, 13)),
        game(4, KC, MIA, 8, score=(17, 24)),
    ]
    final = roster_status(games, [KC, MIA, BUF], 4)
    assert final is not None
    # Both finalists still count as advanced, whoever won; only the earlier exit is out.
    assert (final.advanced, final.eliminated) == (2, 1)
