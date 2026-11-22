"""One NFL game as a stat page for a league: every player of either team who has a
fantasy line in the game, plus anyone the league drafted from those teams, each with
this game's fantasy points and the fantasy team that owns him."""

from collections.abc import Iterable
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models.league import SeasonSettings, Team, TeamPlayer
from api.db.models.nfl import NFLGame, NFLPlayer, NFLPlayerGameStats, NFLTeam
from api.models.bracket_models import (
    BracketTeam,
    BreakdownLine,
    GamePlayer,
    GamePlayers,
    GameSide,
    PlayerPostseason,
    PlayerRoundLine,
)
from api.models.enums import DRAFTABLE_POSITION_VALUES, PlayerPosition
from api.services.round_status import GameFacts, load_games
from api.services.stat_lines import stat_line
from api.services.team_units import scoring_members
from api.utils.calculations.fantasy_points_utils import calculate_player_points
from api.utils.calculations.points_breakdown import points_breakdown
from api.utils.calculations.standings_utils import (
    ROUND_MULTIPLIER_FIELDS,
    postseason_round_index,
)


class GameNotFoundError(LookupError):
    pass


async def _owners(
    db: AsyncSession, season_id: int, settings: SeasonSettings
) -> tuple[dict[int, Team], set[int]]:
    """NFL player id -> the fantasy team his points count for (a team QB / K unit's
    other members count for the unit's owner), and the ids actually drafted."""
    rows = (
        await db.execute(
            select(NFLPlayer, Team)
            .join(TeamPlayer, TeamPlayer.player_id == NFLPlayer.id)
            .join(Team, Team.id == TeamPlayer.team_id)
            .where(TeamPlayer.season_id == season_id)
        )
    ).all()
    owners = {player.id: team for player, team in rows}
    units = await scoring_members(db, settings, (player for player, _ in rows))
    for unit_id, members in units.items():
        for member_id in members:
            owners.setdefault(member_id, owners[unit_id])
    return owners, {player.id for player, _ in rows}


def _team(team: NFLTeam) -> BracketTeam:
    return BracketTeam(
        id=team.id,
        abbreviation=team.team_abv or "",
        city=team.team_city or "",
        name=team.team_name or "",
        logo_url=team.team_logo_url,
        top_players=[],
    )


def _side(
    team: NFLTeam,
    points: int | None,
    players: Iterable[GamePlayer],
) -> GameSide:
    ordered = sorted(
        players,
        key=lambda p: (-(p.points or 0), p.fantasy_team is None, p.name),
    )
    return GameSide(team=_team(team), points=points, players=ordered)


async def game_players(
    db: AsyncSession,
    year: int,
    season_id: int,
    settings: SeasonSettings,
    game_id: str,
    my_team_id: int | None,
) -> GamePlayers:
    games = await load_games(db, year)
    game: GameFacts | None = next((g for g in games if g.game_id == game_id), None)
    if game is None or game.home_team_id is None or game.away_team_id is None:
        raise GameNotFoundError(game_id)
    sides = {game.away_team_id, game.home_team_id}
    nfl_teams = {
        t.id: t
        for t in (
            await db.execute(select(NFLTeam).where(NFLTeam.id.in_(sides)))
        ).scalars()
    }
    multiplier = Decimal(
        str(getattr(settings, ROUND_MULTIPLIER_FIELDS[game.round - 1]))
    )

    stat_rows = (
        await db.execute(
            select(NFLPlayer, NFLPlayerGameStats)
            .join(NFLPlayerGameStats, NFLPlayerGameStats.player_id == NFLPlayer.id)
            .where(NFLPlayerGameStats.game_id == game_id)
        )
    ).all()
    owners, drafted = await _owners(db, season_id, settings)
    # Drafted players show before they have a line; a unit's backups only once they do.
    drafted_here = (
        await db.execute(
            select(NFLPlayer).where(
                NFLPlayer.id.in_(drafted), NFLPlayer.team_id.in_(sides)
            )
        )
    ).scalars()

    def line(player: NFLPlayer, points: Decimal | None) -> GamePlayer:
        owner = owners.get(player.id)
        return GamePlayer(
            id=player.id,
            name=player.name or "",
            position=player.position or "",
            points=None if points is None else float(points.quantize(Decimal("0.01"))),
            fantasy_team=owner.name if owner else None,
            mine=owner is not None and owner.id == my_team_id,
        )

    by_side: dict[int, dict[int, GamePlayer]] = {t: {} for t in sides}
    for player, stats in stat_rows:
        if (
            player.team_id not in sides
            or player.position not in DRAFTABLE_POSITION_VALUES
        ):
            continue
        points = calculate_player_points(stats, settings, player.position) * multiplier
        # A line that scored nothing for a player nobody drafted is noise.
        if points == 0 and player.id not in owners:
            continue
        by_side[player.team_id][player.id] = line(player, points)
    for player in drafted_here:
        if player.team_id in by_side:
            by_side[player.team_id].setdefault(player.id, line(player, None))

    live_or_final = game.completed or game.in_progress
    return GamePlayers(
        id=game_id,
        round=game.round,
        state=game.state,
        clock=game.clock or None,
        away=_side(
            nfl_teams[game.away_team_id],
            game.away_points if live_or_final else None,
            by_side[game.away_team_id].values(),
        ),
        home=_side(
            nfl_teams[game.home_team_id],
            game.home_points if live_or_final else None,
            by_side[game.home_team_id].values(),
        ),
    )


class PlayerNotFoundError(LookupError):
    pass


async def player_postseason(
    db: AsyncSession,
    year: int,
    season_id: int,
    settings: SeasonSettings,
    player_id: int,
    my_team_id: int | None,
) -> PlayerPostseason:
    """One player's own postseason games (never a team unit's other members), each with
    the stat line, the points under the season's scoring and how they were made."""
    player = await db.get(NFLPlayer, player_id)
    if player is None:
        raise PlayerNotFoundError(player_id)
    team = await db.get(NFLTeam, player.team_id) if player.team_id else None
    owners, _ = await _owners(db, season_id, settings)
    owner = owners.get(player.id)
    facts = {g.game_id: g for g in await load_games(db, year)}
    rows = (
        await db.execute(
            select(NFLPlayerGameStats, NFLGame.game_week)
            .join(NFLGame, NFLPlayerGameStats.game_id == NFLGame.id)
            .where(
                NFLPlayerGameStats.player_id == player_id,
                NFLGame.season == year,
                NFLGame.season_type == "post",
                NFLGame.game_week.is_not(None),
            )
        )
    ).all()
    position = PlayerPosition.from_str(player.position)
    rounds: list[PlayerRoundLine] = []
    for stats, week in rows:
        index = postseason_round_index(week or 0)
        game = facts.get(stats.game_id)
        if index is None or game is None:
            continue
        multiplier = Decimal(str(getattr(settings, ROUND_MULTIPLIER_FIELDS[index])))
        raw = calculate_player_points(stats, settings, position)
        rounds.append(
            PlayerRoundLine(
                round=index + 1,
                state=game.state,
                clock=game.clock or None,
                stat_line=stat_line([stats], position),
                points=float((raw * multiplier).quantize(Decimal("0.01"))),
                points_breakdown=[
                    BreakdownLine(label=line.label, points=float(line.points))
                    for line in points_breakdown([stats], settings, position)
                ],
                multiplier=float(multiplier),
            )
        )
    return PlayerPostseason(
        id=player.id,
        name=player.name or "",
        position=player.position or "",
        team_abv=team.team_abv if team else None,
        injury_status=player.injury_status,
        fantasy_team=owner.name if owner else None,
        mine=owner is not None and owner.id == my_team_id,
        rounds=sorted(rounds, key=lambda line: line.round),
    )
