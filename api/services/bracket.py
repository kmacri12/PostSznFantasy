"""The NFL playoff bracket of a season: games by round, byes, each team's top players
and the caller's own players in each game. Built from the same game facts as
eliminations and lineups, and readable before anyone has drafted."""

from collections import defaultdict
from collections.abc import Iterable
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models.league import LineupSlot, SeasonSettings, TeamPlayer
from api.db.models.nfl import NFLPlayer, NFLPlayerSeasonStats, NFLTeam
from api.models.bracket_models import (
    Bracket,
    BracketGame,
    BracketMyPlayer,
    BracketPlayer,
    BracketRound,
    BracketTeam,
)
from api.models.enums import DRAFTABLE_POSITION_VALUES
from api.services.lineups import BENCH, slot_layout
from api.services.round_status import ROUNDS, GameFacts, current_round, load_games
from api.utils.calculations.fantasy_points_utils import season_points

TOP_PLAYERS = 3
_UNSET = datetime.max.replace(tzinfo=UTC)
# Team defenses have no season line of their own to rank by.
RANKED_POSITIONS = tuple(
    p for p in DRAFTABLE_POSITION_VALUES if p not in ("DST", "DEF", "D/ST")
)


async def _top_players(
    db: AsyncSession, year: int, settings: SeasonSettings, team_ids: Iterable[int]
) -> dict[int, list[BracketPlayer]]:
    rows = await db.execute(
        select(NFLPlayer, NFLPlayerSeasonStats)
        .join(NFLPlayerSeasonStats, NFLPlayerSeasonStats.player_id == NFLPlayer.id)
        .where(
            NFLPlayerSeasonStats.season == str(year),
            NFLPlayer.team_id.in_(set(team_ids)),
            NFLPlayer.position.in_(RANKED_POSITIONS),
        )
    )
    by_team: dict[int, list[BracketPlayer]] = defaultdict(list)
    for player, stats in rows.all():
        if player.team_id is None:
            continue
        by_team[player.team_id].append(
            BracketPlayer(
                id=player.id,
                name=player.name or "",
                position=player.position or "",
                points=round(float(season_points(stats, settings, player.position)), 1),
            )
        )
    return {
        team_id: sorted(players, key=lambda p: (-p.points, p.name))[:TOP_PLAYERS]
        for team_id, players in by_team.items()
    }


async def _my_players(
    db: AsyncSession, team_id: int | None, settings: SeasonSettings
) -> tuple[list[NFLPlayer], dict[int, set[int]]]:
    """The caller's roster and, per round, the player ids placed in a starter slot."""
    if team_id is None:
        return [], {}
    roster = list(
        (
            await db.execute(
                select(NFLPlayer)
                .join(TeamPlayer, TeamPlayer.player_id == NFLPlayer.id)
                .where(TeamPlayer.team_id == team_id)
            )
        ).scalars()
    )
    specs = slot_layout(settings)
    starters: dict[int, set[int]] = {r: set() for r in ROUNDS}
    slots = await db.execute(
        select(LineupSlot.round, LineupSlot.slot_index, LineupSlot.player_id).where(
            LineupSlot.team_id == team_id
        )
    )
    for round_, slot_index, player_id in slots.all():
        if slot_index < len(specs) and specs[slot_index].slot != BENCH:
            starters[round_].add(player_id)
    return roster, starters


def _game_view(
    game: GameFacts,
    teams: dict[int, BracketTeam],
    roster: list[NFLPlayer],
    starters: dict[int, set[int]],
) -> BracketGame:
    ids = {game.home_team_id, game.away_team_id}
    mine = [
        BracketMyPlayer(
            id=p.id,
            name=p.name or "",
            position=p.position or "",
            team_id=p.team_id,
            role="starter" if p.id in starters.get(game.round, set()) else "bench",
        )
        for p in roster
        if p.team_id in ids and p.team_id is not None
    ]
    mine.sort(key=lambda p: (p.role != "starter", p.position, p.name))
    return BracketGame(
        id=game.game_id,
        kickoff=game.kickoff,
        state=game.state,
        clock=game.clock or None,
        home=teams.get(game.home_team_id) if game.home_team_id else None,
        away=teams.get(game.away_team_id) if game.away_team_id else None,
        home_points=game.home_points if game.completed or game.in_progress else None,
        away_points=game.away_points if game.completed or game.in_progress else None,
        winner_team_id=game.winner_id,
        my_players=mine,
    )


async def build_bracket(
    db: AsyncSession, year: int, settings: SeasonSettings, my_team_id: int | None
) -> Bracket:
    games = await load_games(db, year)
    in_games = {
        t for g in games for t in (g.home_team_id, g.away_team_id) if t is not None
    }
    wild_card = {
        t
        for g in games
        if g.round == 1
        for t in (g.home_team_id, g.away_team_id)
        if t is not None
    }
    team_rows = list(
        (
            await db.execute(
                select(NFLTeam).where(
                    NFLTeam.id.in_(in_games) | NFLTeam.in_playoffs.is_(True)
                )
            )
        ).scalars()
    )
    bye_ids = (
        {t.id for t in team_rows if t.in_playoffs and t.id not in wild_card}
        if wild_card
        else set()
    )
    tops = await _top_players(db, year, settings, {t.id for t in team_rows})
    teams = {
        t.id: BracketTeam(
            id=t.id,
            abbreviation=t.team_abv or "",
            city=t.team_city or "",
            name=t.team_name or "",
            logo_url=t.team_logo_url,
            top_players=tops.get(t.id, []),
        )
        for t in team_rows
    }
    roster, starters = await _my_players(db, my_team_id, settings)
    rounds = [
        BracketRound(
            round=r,
            games=[
                _game_view(g, teams, roster, starters)
                for g in sorted(
                    (g for g in games if g.round == r),
                    key=lambda g: (g.kickoff or _UNSET, g.game_id or ""),
                )
            ],
        )
        for r in ROUNDS
    ]
    return Bracket(
        year=year,
        current_round=current_round(games),
        rounds=rounds,
        byes=sorted((teams[i] for i in bye_ids), key=lambda t: t.abbreviation),
    )
