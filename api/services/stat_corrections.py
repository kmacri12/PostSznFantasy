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
from api.services.team_units import scoring_members
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
    existed in the snapshot can be corrections. A team QB / team K slot scores every
    player of the unit, so a unit member's correction changes the drafted player's
    score and is posted against him.
    """
    arrived: dict[StatKey, dict[str, Any]] = {
        (row["game_id"], row["player_id"]): row
        for row in new_rows
        if (row["game_id"], row["player_id"]) in before
    }
    if not arrived:
        return
    games = {
        g.id: g
        for g in await db.scalars(
            select(NFLGame).where(NFLGame.id.in_({game_id for game_id, _ in arrived}))
        )
    }
    seasons = {g.season for g in games.values()}
    leagues = {
        league.id: league
        for league in await db.scalars(select(League).where(League.season.in_(seasons)))
    }
    if not leagues:
        return
    settings = {
        s.league_id: s
        for s in await db.scalars(
            select(LeagueSettings).where(LeagueSettings.league_id.in_(leagues))
        )
    }
    rostered = (
        await db.execute(
            select(TeamPlayer.league_id, TeamPlayer.team_id, NFLPlayer)
            .join(NFLPlayer, NFLPlayer.id == TeamPlayer.player_id)
            .where(TeamPlayer.league_id.in_(leagues))
        )
    ).all()
    by_league: dict[int, list[tuple[int, NFLPlayer]]] = defaultdict(list)
    for league_id, team_id, player in rostered:
        by_league[league_id].append((team_id, player))
    latest = {(row["game_id"], row["player_id"]): row for row in new_rows} | {
        key: before[key] for key in before if key not in arrived
    }

    for league_id, holders in by_league.items():
        members = await scoring_members(
            db, settings[league_id], [player for _, player in holders]
        )
        for team_id, player in holders:
            scorers = members.get(player.id, [player.id])
            position = PlayerPosition.from_str(player.position)
            for game_id in {g for g, p in arrived if p in scorers}:
                game = games[game_id]
                if game.game_week is None or game.season != leagues[league_id].season:
                    continue
                round_index = postseason_round_index(game.game_week)
                if round_index is None:
                    continue
                old_points = _points_of(
                    [before.get((game_id, p)) for p in scorers],
                    settings[league_id],
                    position,
                )
                new_points = _points_of(
                    [latest.get((game_id, p)) for p in scorers],
                    settings[league_id],
                    position,
                )
                if old_points == new_points:
                    continue
                await activity.append(
                    db,
                    league_id,
                    StatCorrectionPayload(
                        round=round_index + 1,
                        game_id=game_id,
                        player_id=player.id,
                        player_name=player.name or "",
                        previous_points=float(old_points),
                        new_points=float(new_points),
                    ),
                    team_id=team_id,
                )


def _points_of(
    rows: list[dict[str, Any] | None],
    settings: LeagueSettings,
    position: PlayerPosition | None,
) -> Decimal:
    total = sum(
        (
            calculate_player_points(_detached(row), settings, position)
            for row in rows
            if row is not None
        ),
        Decimal(0),
    )
    return total.quantize(CENTS)
