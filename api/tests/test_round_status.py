from datetime import UTC, datetime

from api.models.enums import PlayerRoundStatus
from api.services.round_status import GameFacts, round_status

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
