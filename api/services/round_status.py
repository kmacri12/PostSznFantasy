"""Where each NFL team stands in each postseason round, derived from game results.

Rounds are numbered 1 (Wild Card) to 4 (Super Bowl). Nothing here reads the
`is_active` flag: a team is eliminated for round N once it has lost a completed game
in an earlier round.
"""

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import event, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import ORMExecuteState, Session, aliased

from api.db.models.nfl import NFLGame, NFLTeam
from api.db.session import REQUEST_SCOPED
from api.models.enums import GameState, PlayerRoundStatus
from api.utils.calculations.standings_utils import postseason_round_index

# Only a request's session memoizes the postseason games: a request reads the same year
# several times (guards, summaries, standings), while the scheduler and scripts reuse a
# session across ingests.
_GAMES_MEMO = "postseason_games"
ROUNDS = (1, 2, 3, 4)
SUPER_BOWL = ROUNDS[-1]
GAME_COMPLETED = "Completed"
# Tank01 reports a running game as "Live - In Progress".
GAME_LIVE_PREFIX = "Live"


@dataclass(frozen=True)
class GameFacts:
    round: int
    home_team_id: int | None
    away_team_id: int | None
    kickoff: datetime | None
    completed: bool
    home_points: int | None
    away_points: int | None
    in_progress: bool = False
    clock: str | None = None
    game_id: str | None = None
    home_abv: str | None = None
    away_abv: str | None = None

    @property
    def state(self) -> GameState:
        if self.completed:
            return GameState.FINAL
        return GameState.LIVE if self.in_progress else GameState.SCHEDULED

    @property
    def winner_id(self) -> int | None:
        loser = self.loser_id
        if loser is None:
            return None
        return self.away_team_id if loser == self.home_team_id else self.home_team_id

    @property
    def loser_id(self) -> int | None:
        if not self.completed or self.home_points is None or self.away_points is None:
            return None
        if self.home_points == self.away_points:
            return None
        return (
            self.away_team_id
            if self.home_points > self.away_points
            else self.home_team_id
        )


@dataclass(frozen=True)
class TeamRound:
    status: PlayerRoundStatus
    # Scheduled start of the team's game that round; None on a bye or before it is set.
    kickoff: datetime | None
    game_state: GameState | None = None
    game_clock: str | None = None
    # The round of the game that knocked the team out; set with ELIMINATED.
    eliminated_in: int | None = None
    opponent_abv: str | None = None
    home: bool | None = None
    # The game's score from this team's side; None until the box score has one.
    points: int | None = None
    opponent_points: int | None = None


def round_status(
    games: list[GameFacts], nfl_team_id: int | None, round_: int
) -> TeamRound:
    if nfl_team_id is None:
        return TeamRound(PlayerRoundStatus.ALIVE, None)
    lost = min(
        (g.round for g in games if g.loser_id == nfl_team_id and g.round < round_),
        default=None,
    )
    if lost is not None:
        return TeamRound(PlayerRoundStatus.ELIMINATED, None, eliminated_in=lost)
    this_round = [g for g in games if g.round == round_]
    own = next(
        (g for g in this_round if nfl_team_id in (g.home_team_id, g.away_team_id)),
        None,
    )
    if own is not None:
        home = own.home_team_id == nfl_team_id
        return TeamRound(
            PlayerRoundStatus.ALIVE,
            own.kickoff,
            own.state,
            own.clock or None,
            opponent_abv=own.away_abv if home else own.home_abv,
            home=home,
            points=own.home_points if home else own.away_points,
            opponent_points=own.away_points if home else own.home_points,
        )
    # Only the Wild Card round has byes. Later, an alive team without a game is waiting
    # for its next game to be scheduled, which is not a bye.
    on_bye = round_ == 1 and bool(this_round)
    return TeamRound(PlayerRoundStatus.BYE if on_bye else PlayerRoundStatus.ALIVE, None)


def completed_rounds(games: list[GameFacts]) -> frozenset[int]:
    """Rounds with at least one game, all final; an unscheduled round is not complete."""
    return frozenset(
        r
        for r in ROUNDS
        if (this_round := [g for g in games if g.round == r])
        and all(g.completed for g in this_round)
    )


def current_round(games: list[GameFacts]) -> int:
    """The first round not yet complete, counting from the first round with any game;
    the Super Bowl once everything is final."""
    done = completed_rounds(games)
    first = min((g.round for g in games), default=ROUNDS[0])
    return next((r for r in ROUNDS if r >= first and r not in done), SUPER_BOWL)


_EASTERN = ZoneInfo("America/New_York")
_THURSDAY, _TUESDAY = 3, 1
# Members read last week's recap Tuesday and Wednesday, so the next round takes over Thursday.
ROUND_SWITCH_HOUR = 6


def _next_weekday_start(after: datetime, weekday: int, hour: int) -> datetime:
    """The first `weekday` at `hour` Eastern strictly after `after`."""
    local = after.astimezone(_EASTERN)
    days = (weekday - local.weekday()) % 7
    moment = (local + timedelta(days=days)).replace(
        hour=hour, minute=0, second=0, microsecond=0
    )
    return moment if moment > local else moment + timedelta(days=7)


def _recap_round(games: list[GameFacts], now: datetime) -> int | None:
    """The finished round still on display, or None when the current round has taken over:
    the next round takes over at the first Thursday 6 AM Eastern after the finished round's
    last kickoff, or at its own first kickoff if that comes sooner."""
    current = current_round(games)
    previous = current - 1
    if previous not in completed_rounds(games):
        return None
    kickoffs = [g.kickoff for g in games if g.round == previous and g.kickoff]
    next_kickoffs = [g.kickoff for g in games if g.round == current and g.kickoff]
    if not kickoffs or (next_kickoffs and min(next_kickoffs) <= now):
        return None
    switch = _next_weekday_start(max(kickoffs), _THURSDAY, ROUND_SWITCH_HOUR)
    return previous if now < switch else None


def display_round(games: list[GameFacts], now: datetime) -> int:
    """The round the League and Team pages describe (header, "This rd", the status dots)."""
    return _recap_round(games, now) or current_round(games)


def lineup_nudge_round(games: list[GameFacts], now: datetime) -> int | None:
    """The round whose lineup to remind members about: from Tuesday midnight Eastern after
    the round on display finished until the next round's first kickoff, i.e. only while
    the recap is still showing."""
    recap = _recap_round(games, now)
    if recap is None:
        return None
    last = max(g.kickoff for g in games if g.round == recap and g.kickoff)
    if now < _next_weekday_start(last, _TUESDAY, 0):
        return None
    return recap + 1


def super_bowl_winner(games: list[GameFacts]) -> int | None:
    """NFL team id that won the Super Bowl; None until it is final."""
    return next(
        (g.winner_id for g in games if g.round == SUPER_BOWL and g.winner_id), None
    )


def games_in_progress(games: list[GameFacts]) -> int:
    return sum(1 for g in games if g.in_progress)


def games_final(games: list[GameFacts], round_: int) -> int:
    return sum(1 for g in games if g.round == round_ and g.completed)


def games_to_play(games: list[GameFacts], round_: int) -> int:
    """Games of the round not started yet (neither live nor over)."""
    return sum(
        1 for g in games if g.round == round_ and not g.completed and not g.in_progress
    )


def _kickoff(game_time_epoch: str | None) -> datetime | None:
    try:
        return (
            datetime.fromtimestamp(float(game_time_epoch), UTC)
            if game_time_epoch
            else None
        )
    except ValueError:
        return None


def _forget_games(session: Session) -> None:
    session.info.pop(_GAMES_MEMO, None)


@event.listens_for(Session, "after_flush")
def _games_may_have_changed(session: Session, _: object) -> None:
    _forget_games(session)


@event.listens_for(Session, "do_orm_execute")
def _games_may_have_changed_by_statement(state: ORMExecuteState) -> None:
    if state.is_insert or state.is_update or state.is_delete:
        _forget_games(state.session)


async def load_games(db: AsyncSession, season: int) -> list[GameFacts]:
    """The season's postseason games; within a request each year is read once."""
    info = getattr(db, "info", None)  # test doubles of the session have none
    if not isinstance(info, dict) or not info.get(REQUEST_SCOPED):
        return await _read_games(db, season)
    memo: dict[int, list[GameFacts]] = info.setdefault(_GAMES_MEMO, {})
    if season not in memo:
        memo[season] = await _read_games(db, season)
    return memo[season]


async def _read_games(db: AsyncSession, season: int) -> list[GameFacts]:
    home_team, away_team = aliased(NFLTeam), aliased(NFLTeam)
    rows = await db.execute(
        select(NFLGame, home_team.team_abv, away_team.team_abv)
        .outerjoin(home_team, home_team.id == NFLGame.team_id_home)
        .outerjoin(away_team, away_team.id == NFLGame.team_id_away)
        .where(
            NFLGame.season == season,
            NFLGame.season_type == "post",
            NFLGame.game_week.is_not(None),
        )
    )
    facts = []
    for game, home_abv, away_abv in rows.tuples():
        index = postseason_round_index(game.game_week or 0)
        if index is None:
            continue
        facts.append(
            GameFacts(
                round=index + 1,
                home_team_id=game.team_id_home,
                away_team_id=game.team_id_away,
                kickoff=_kickoff(game.game_time_epoch),
                completed=game.game_status == GAME_COMPLETED,
                in_progress=(game.game_status or "").startswith(GAME_LIVE_PREFIX),
                clock=game.game_clock,
                game_id=game.id,
                home_points=game.home_pts,
                away_points=game.away_pts,
                home_abv=home_abv,
                away_abv=away_abv,
            )
        )
    return facts


async def season_is_finished(db: AsyncSession, year: int) -> bool:
    """The Super Bowl of this NFL season is final."""
    return SUPER_BOWL in completed_rounds(await load_games(db, year))
