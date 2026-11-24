from dataclasses import replace
from datetime import UTC, datetime
from zoneinfo import ZoneInfo

from api.models.enums import GameState, PlayerRoundStatus
from api.services.round_status import (
    GameFacts,
    completed_rounds,
    current_round,
    display_round,
    games_final,
    games_in_progress,
    games_to_play,
    lineup_nudge_round,
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


def test_each_side_of_a_game_sees_its_opponent_and_whether_it_is_at_home() -> None:
    games = [replace(game(1, KC, BUF), home_abv="KC", away_abv="BUF")]
    home = round_status(games, KC, 1)
    away = round_status(games, BUF, 1)
    assert (home.opponent_abv, home.home) == ("BUF", True)
    assert (away.opponent_abv, away.home) == ("KC", False)
    final = [replace(game(1, KC, BUF, score=(27, 20)), home_abv="KC", away_abv="BUF")]
    assert (
        round_status(final, KC, 1).points,
        round_status(final, KC, 1).opponent_points,
    ) == (27, 20)
    assert (
        round_status(final, BUF, 1).points,
        round_status(final, BUF, 1).opponent_points,
    ) == (20, 27)
    bye = round_status([*games, game(1, DEN, 5)], MIA, 1)
    assert (bye.opponent_abv, bye.home) == (None, None)


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


def test_games_final_counts_completed_games_of_that_round() -> None:
    games = [
        game(2, KC, BUF, score=(27, 24)),
        game(2, DEN, MIA, score=(3, 0)),
        live(2, 5, 6),
        game(1, 7, 8, score=(3, 0)),
    ]
    assert games_final(games, 2) == 2
    assert games_final(games, 3) == 0


def test_games_to_play_counts_unstarted_games_of_that_round() -> None:
    games = [
        game(2, KC, BUF, score=(27, 24)),
        live(2, DEN, MIA),
        game(2, 5, 6),
        game(2, 7, 8),
        game(1, 9, 10),
    ]
    assert games_to_play(games, 2) == 2
    assert games_to_play(games, 3) == 0


def test_current_round_ignores_rounds_before_the_first_one_with_games() -> None:
    # A schedule that only has the Divisional so far: that is the round to show.
    assert current_round([game(2, KC, BUF)]) == 2
    assert current_round([game(3, KC, BUF)]) == 3


def test_the_game_state_and_the_round_a_team_was_knocked_out_in() -> None:
    final = game(1, KC, BUF, score=(27, 20))
    live = replace(game(2, KC, DEN), in_progress=True, clock="8:42")
    games = [final, live]
    assert round_status(games, KC, 1).game_state is GameState.FINAL
    ongoing = round_status(games, KC, 2)
    assert (ongoing.game_state, ongoing.game_clock) == (GameState.LIVE, "8:42")
    assert round_status([game(2, DEN, MIA)], DEN, 2).game_state is GameState.SCHEDULED
    knocked_out = round_status(games, BUF, 2)
    assert knocked_out.status is PlayerRoundStatus.ELIMINATED
    assert knocked_out.eliminated_in == 1


def eastern(day: int, hour: int, minute: int = 0) -> datetime:
    return datetime(2027, 1, day, hour, minute, tzinfo=ZoneInfo("America/New_York"))


def _after_wild_card(divisional_kickoff: datetime | None = None) -> list[GameFacts]:
    """The Wild Card ended Monday night, Jan 11 2027; the Divisional starts Saturday."""
    return [
        replace(game(1, KC, BUF, score=(27, 20)), kickoff=eastern(9, 16)),
        replace(game(1, DEN, MIA, score=(10, 13)), kickoff=eastern(11, 20, 15)),
        replace(game(2, KC, MIA), kickoff=divisional_kickoff or eastern(16, 16, 30)),
    ]


def test_the_next_round_takes_over_thursday_morning_not_when_the_last_game_ends() -> (
    None
):
    games = _after_wild_card()
    assert current_round(games) == 2
    assert display_round(games, eastern(11, 23, 59)) == 1  # Monday night
    assert display_round(games, eastern(12, 12)) == 1  # Tuesday recap
    assert display_round(games, eastern(14, 5, 59)) == 1
    assert display_round(games, eastern(14, 6)) == 2


def test_the_next_round_takes_over_at_its_own_kickoff_when_that_comes_first() -> None:
    games = _after_wild_card(divisional_kickoff=eastern(13, 20))
    assert display_round(games, eastern(13, 21)) == 2


def test_the_round_in_progress_is_always_the_one_shown() -> None:
    games = [game(1, KC, BUF), game(2, KC, MIA)]
    assert display_round(games, eastern(9, 12)) == 1
    assert display_round([], eastern(9, 12)) == 1


def test_the_lineup_nudge_runs_from_tuesday_midnight_until_the_next_round_takes_over() -> (
    None
):
    games = _after_wild_card()
    assert lineup_nudge_round(games, eastern(11, 23, 59)) is None
    assert lineup_nudge_round(games, eastern(12, 0, 1)) == 2
    assert lineup_nudge_round(games, eastern(14, 5, 59)) == 2
    assert lineup_nudge_round(games, eastern(14, 6)) is None


def _rounds_done(*rounds: int) -> list[GameFacts]:
    return [
        replace(game(r, KC, BUF, score=(27, 20)), kickoff=eastern(9 + 7 * (r - 1), 16))
        for r in rounds
    ]


def test_movement_shows_from_divisional_until_the_next_rounds_first_kickoff() -> None:
    from api.services.round_status import movement_round

    wild_card_only = _rounds_done(1)
    assert (
        movement_round(wild_card_only, eastern(12, 12)) is None
    )  # nothing to compare to

    divisional = [
        *_rounds_done(1, 2),
        replace(game(3, KC, BUF), kickoff=eastern(23, 16)),
    ]
    assert movement_round(divisional, eastern(20, 12)) == 2  # through Thursday's switch
    assert movement_round(divisional, eastern(22, 12)) == 2
    assert (
        movement_round(divisional, eastern(23, 17)) is None
    )  # the next round kicked off


def test_movement_after_the_super_bowl_stays() -> None:
    from api.services.round_status import movement_round

    season = _rounds_done(1, 2, 3, 4)
    assert movement_round(season, eastern(28, 12)) == 4
    assert movement_round(season, datetime(2028, 1, 1, tzinfo=UTC)) == 4
