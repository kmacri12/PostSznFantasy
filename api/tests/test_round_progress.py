from dataclasses import replace

from api.models.league_models import StarterProgress
from api.services.round_progress import starter_progress
from api.services.round_status import GameFacts

KC, BUF, DEN, MIA, SEA, GB = 1, 2, 3, 4, 5, 6


def game(
    round_: int,
    home: int,
    away: int,
    score: tuple[int, int] | None = None,
    *,
    live: bool = False,
) -> GameFacts:
    return GameFacts(
        round=round_,
        home_team_id=home,
        away_team_id=away,
        kickoff=None,
        completed=score is not None,
        home_points=score[0] if score else None,
        away_points=score[1] if score else None,
        in_progress=live,
    )


def counts(progress: StarterProgress) -> tuple[int, int, int, int]:
    return (
        progress.finished,
        progress.live,
        progress.to_play,
        progress.not_playing,
    )


def test_an_unset_lineup_is_all_not_playing() -> None:
    games = [game(2, KC, BUF)]
    assert counts(starter_progress(games, 2, [], slot_count=9)) == (0, 0, 0, 9)


def test_starters_split_into_finished_live_and_to_play() -> None:
    games = [
        game(2, KC, BUF, (27, 20)),
        game(2, DEN, MIA, live=True),
        game(2, SEA, GB),
    ]
    progress = starter_progress(games, 2, [KC, BUF, DEN, SEA, GB], slot_count=6)
    # One empty slot is not playing.
    assert counts(progress) == (2, 1, 2, 1)


def test_eliminated_and_bye_players_are_not_playing() -> None:
    games = [
        game(1, KC, BUF, (27, 20)),
        game(1, DEN, MIA, (10, 13)),
        game(2, KC, MIA),
    ]
    # BUF and DEN lost in round 1; SEA had a bye and has no round 2 game yet.
    progress = starter_progress(
        games + [game(1, SEA, GB, (3, 0))], 2, [BUF, DEN, KC, MIA], slot_count=4
    )
    assert counts(progress) == (0, 0, 2, 2)

    bye = starter_progress(games, 1, [SEA], slot_count=1)
    assert counts(bye) == (0, 0, 0, 1)


def test_a_player_with_no_nfl_team_is_not_playing() -> None:
    assert counts(starter_progress([game(1, KC, BUF)], 1, [None], slot_count=1)) == (
        0,
        0,
        0,
        1,
    )


def test_the_loser_of_this_rounds_game_is_finished_not_eliminated() -> None:
    games = [game(2, KC, BUF, (27, 20))]
    assert counts(starter_progress(games, 2, [BUF], slot_count=1)) == (1, 0, 0, 0)


def test_counts_follow_a_game_from_scheduled_to_live_to_final() -> None:
    scheduled = game(2, KC, BUF)
    step = [
        (scheduled, (0, 0, 2, 0)),
        (replace(scheduled, in_progress=True), (0, 2, 0, 0)),
        (
            replace(scheduled, in_progress=False, completed=True, home_points=3),
            (2, 0, 0, 0),
        ),
    ]
    for facts, expected in step:
        assert counts(starter_progress([facts], 2, [KC, BUF], slot_count=2)) == expected


def test_every_slot_is_counted_exactly_once() -> None:
    games = [game(2, KC, BUF, (7, 0)), game(2, DEN, MIA, live=True), game(2, SEA, GB)]
    progress = starter_progress(games, 2, [KC, BUF, DEN, MIA, SEA, None], slot_count=9)
    assert sum(counts(progress)) == 9
