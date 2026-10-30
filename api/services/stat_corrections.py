"""Stat corrections: a finished game's box score changed a rostered player's score.

Ingest takes a `snapshot` of a game's stats before it overwrites them and calls
`record` afterwards. Only games already final count: stats moving during a live game
are normal, not corrections. Scores differ per league, so each league that rosters the
player and sees a different score under its own settings gets its own event.
"""

from collections import defaultdict
from decimal import Decimal
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models.league import League, LeagueSettings, TeamPlayer
from api.db.models.nfl import NFLGame, NFLPlayer, NFLPlayerGameStats
from api.models.activity_models import StatCorrectionPayload
from api.models.enums import PlayerPosition
from api.services import activity
from api.services.round_status import GAME_COMPLETED
from api.utils.calculations.fantasy_points_utils import calculate_player_points
from api.utils.calculations.standings_utils import postseason_round_index

CENTS = Decimal("0.01")
StatKey = tuple[str, int]  # (game id, player id)
_COLUMNS = [column.name for column in NFLPlayerGameStats.__table__.columns]


def _detached(values: dict[str, Any]) -> NFLPlayerGameStats:
    """A stats row used only to be scored; never added to the session."""
    return NFLPlayerGameStats(**{k: v for k, v in values.items() if k in _COLUMNS})


async def snapshot(
    db: AsyncSession, game_ids: list[str]
) -> dict[StatKey, dict[str, Any]]:
    """The stored stats of those games that are already final, before they change."""
    final = (
        await db.scalars(
            select(NFLGame.id).where(
                NFLGame.id.in_(game_ids), NFLGame.game_status == GAME_COMPLETED
            )
        )
    ).all()
    if not final:
        return {}
    rows = await db.scalars(
        select(NFLPlayerGameStats)
        .where(NFLPlayerGameStats.game_id.in_(final))
        .execution_options(populate_existing=True)
    )
    return {
        (row.game_id, row.player_id): {c: getattr(row, c) for c in _COLUMNS}
        for row in rows
    }


async def record(
    db: AsyncSession,
    before: dict[StatKey, dict[str, Any]],
    new_rows: list[dict[str, Any]],
) -> None:
    """Post an event for each rostered player whose stored game score now differs.

    A player with no stored row before had no score to correct, so only rows that
    existed in the snapshot can be corrections.
    """
    arrived: dict[StatKey, dict[str, Any]] = {
        (row["game_id"], row["player_id"]): row
        for row in new_rows
        if (row["game_id"], row["player_id"]) in before
    }
    if not arrived:
        return
    player_ids = {player_id for _, player_id in arrived}
    rostered = (
        await db.execute(
            select(TeamPlayer.league_id, TeamPlayer.team_id, TeamPlayer.player_id)
            .join(League, League.id == TeamPlayer.league_id)
            .where(TeamPlayer.player_id.in_(player_ids))
        )
    ).all()
    if not rostered:
        return
    games = {
        g.id: g
        for g in await db.scalars(
            select(NFLGame).where(NFLGame.id.in_({game_id for game_id, _ in arrived}))
        )
    }
    players = {
        p.id: p
        for p in await db.scalars(select(NFLPlayer).where(NFLPlayer.id.in_(player_ids)))
    }
    settings = {
        s.league_id: s
        for s in await db.scalars(
            select(LeagueSettings).where(
                LeagueSettings.league_id.in_({league for league, _, _ in rostered})
            )
        )
    }
    seasons = {
        league.id: league.season
        for league in await db.scalars(
            select(League).where(League.id.in_(set(settings)))
        )
    }
    holders: dict[int, list[tuple[int, int]]] = defaultdict(list)
    for league_id, team_id, player_id in rostered:
        holders[player_id].append((league_id, team_id))

    for (game_id, player_id), values in arrived.items():
        game = games.get(game_id)
        player = players.get(player_id)
        if game is None or player is None or game.game_week is None:
            continue
        round_index = postseason_round_index(game.game_week)
        if round_index is None:
            continue
        position = PlayerPosition.from_str(player.position)
        was = _detached(before[(game_id, player_id)])
        now = _detached(values)
        for league_id, team_id in holders[player_id]:
            if seasons.get(league_id) != game.season:
                continue
            old_points = calculate_player_points(was, settings[league_id], position)
            new_points = calculate_player_points(now, settings[league_id], position)
            if old_points.quantize(CENTS) == new_points.quantize(CENTS):
                continue
            await activity.append(
                db,
                league_id,
                StatCorrectionPayload(
                    round=round_index + 1,
                    game_id=game_id,
                    player_id=player_id,
                    player_name=player.name or "",
                    previous_points=float(old_points.quantize(CENTS)),
                    new_points=float(new_points.quantize(CENTS)),
                ),
                team_id=team_id,
            )
