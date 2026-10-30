from dataclasses import replace
from datetime import UTC, datetime

from api.models.enums import PlayerRoundStatus
from api.services.round_status import (
    GameFacts,
    completed_rounds,
    current_round,
    games_in_progress,
    round_status,
    super_bowl_winner,
)

KC, BUF, DEN, MIA = 1, 2, 3, 4


def kickoff(hour: int) -> datetime:
    return datetime(2026, 1, 10, hour, tzinfo=UTC)


def game(
    round_: int,
    home: int,
    away: int,
    hour: int = 18,
    score: tuple[int, int] | None = None,
) -> GameFacts:
    return GameFacts(
        round=round_,
        home_team_id=home,
        away_team_id=away,
        kickoff=kickoff(hour),
        completed=score is not None,
        home_points=score[0] if score else None,
        away_points=score[1] if score else None,
    )


def test_team_with_a_game_this_round_is_alive_with_its_kickoff() -> None:
    games = [game(1, KC, BUF, hour=20)]
    status = round_status(games, KC, 1)
    assert status.status is PlayerRoundStatus.ALIVE
    assert status.kickoff == kickoff(20)


def test_loser_is_valid_for_their_round_and_eliminated_from_the_next() -> None:
    games = [game(1, KC, BUF, score=(27, 20)), game(2, KC, DEN)]
    assert round_status(games, BUF, 1).status is PlayerRoundStatus.ALIVE
    assert round_status(games, BUF, 2).status is PlayerRoundStatus.ELIMINATED
    assert round_status(games, BUF, 3).status is PlayerRoundStatus.ELIMINATED
    assert round_status(games, KC, 2).status is PlayerRoundStatus.ALIVE


def test_an_unfinished_game_eliminates_nobody() -> None:
    games = [game(1, KC, BUF), game(2, DEN, MIA)]
    assert round_status(games, BUF, 2).status is PlayerRoundStatus.ALIVE


def test_alive_team_without_a_game_in_a_scheduled_round_is_on_a_bye() -> None:
    games = [game(1, BUF, DEN), game(1, MIA, KC)]
    other = round_status([*games, game(1, 5, 6)], 7, 1)
    assert other.status is PlayerRoundStatus.BYE
    assert other.kickoff is None


def test_a_round_with_no_schedule_yet_is_not_a_bye() -> None:
    assert round_status([game(1, KC, BUF)], KC, 2).status is PlayerRoundStatus.ALIVE


def test_bye_team_keeps_playing_after_its_bye() -> None:
    games = [game(1, BUF, DEN, score=(10, 3)), game(2, KC, BUF)]
    assert round_status(games, KC, 1).status is PlayerRoundStatus.BYE
    assert round_status(games, KC, 2).status is PlayerRoundStatus.ALIVE


def test_a_winner_awaiting_its_next_game_is_alive_not_on_a_bye() -> None:
    games = [game(1, BUF, DEN, score=(10, 3)), game(2, KC, MIA)]
    assert round_status(games, BUF, 2).status is PlayerRoundStatus.ALIVE


def test_player_without_an_nfl_team_is_alive_without_a_kickoff() -> None:
    assert round_status([game(1, KC, BUF)], None, 1).kickoff is None


def live(round_: int, home: int, away: int) -> GameFacts:
    return replace(game(round_, home, away), in_progress=True)


def test_a_round_is_completed_once_every_game_in_it_is_final() -> None:
    games = [
        game(1, KC, BUF, score=(27, 20)),
        game(1, DEN, MIA, score=(10, 13)),
        game(2, KC, MIA, score=(30, 3)),
        game(2, DEN, BUF),
    ]
    assert completed_rounds(games) == {1}


def test_a_round_with_no_games_scheduled_is_not_completed() -> None:
    assert completed_rounds([]) == frozenset()
    assert completed_rounds([game(2, KC, BUF, score=(1, 0))]) == {2}


def test_current_round_is_the_first_one_not_completed() -> None:
    assert current_round([]) == 1
    wild_card = [game(1, KC, BUF, score=(27, 20))]
    assert current_round(wild_card) == 2  # Divisional not scheduled yet
    assert current_round([*wild_card, game(2, KC, DEN)]) == 2
    assert current_round([*wild_card, live(2, KC, DEN)]) == 2


def test_current_round_stays_on_the_super_bowl_once_it_is_final() -> None:
    finals = [game(r, KC, BUF, score=(24, 20)) for r in (1, 2, 3, 4)]
    assert current_round(finals) == 4


def test_super_bowl_winner_needs_a_final_score() -> None:
    assert super_bowl_winner([game(4, KC, BUF)]) is None
    assert super_bowl_winner([game(4, KC, BUF, score=(20, 24))]) == BUF
    assert super_bowl_winner([game(4, KC, BUF, score=(27, 24))]) == KC
    assert super_bowl_winner([game(3, KC, BUF, score=(27, 24))]) is None


def test_games_in_progress_counts_live_games_only() -> None:
    games = [
        live(2, KC, BUF),
        live(2, DEN, MIA),
        game(2, 5, 6),
        game(1, 7, 8, score=(3, 0)),
    ]
    assert games_in_progress(games) == 2
    assert games_in_progress([]) == 0
