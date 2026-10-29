from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from api.core.config import get_settings
from api.db.models.league import (
    LeagueSettings,
    Lineup,
    PlayerScore,
    Team,
    TeamPlayer,
)
from api.db.models.nfl import NFLGame, NFLPlayer, NFLPlayerGameStats, NFLTeam
from api.models.enums import PlayerPosition
from api.utils.calculations.fantasy_points_utils import calculate_player_points


async def get_players_left(team_id: int, league_id: int, db: AsyncSession) -> int:
    """Count rostered players whose NFL team is still active (not eliminated)."""
    count = await db.scalar(
        select(func.count())
        .select_from(TeamPlayer)
        .join(Team, Team.id == TeamPlayer.team_id)
        .join(NFLPlayer, NFLPlayer.id == TeamPlayer.player_id)
        .join(NFLTeam, NFLTeam.id == NFLPlayer.team_id)
        .where(
            TeamPlayer.team_id == team_id,
            Team.league_id == league_id,
            NFLTeam.is_active.is_(True),
        )
    )
    return count or 0


async def get_team_fantasy_points_by_week(
    team_id: int,
    league_id: int,
    week: int,
    db: AsyncSession,
) -> Decimal:
    """Sum fantasy points for a team's lineup in a given week.

    Fetches game stats for all lineup players, scores them, upserts PlayerScore rows,
    and returns the total. Caller is responsible for committing the session.
    """
    league_settings = await db.scalar(
        select(LeagueSettings).where(LeagueSettings.league_id == league_id)
    )
    if league_settings is None:
        return Decimal(0)

    lineup_row = await db.scalar(
        select(Lineup).where(Lineup.team_id == team_id, Lineup.week_id == week)
    )
    if lineup_row is None:
        return Decimal(0)

    # lineup JSON is position → player_id; collect unique player IDs
    player_ids = list({int(pid) for pid in lineup_row.lineup.values() if pid})
    if not player_ids:
        return Decimal(0)

    # Fetch all game stat rows for this week/season for the lineup players
    season_year = get_settings().season_year
    game_stats_rows = (
        (
            await db.execute(
                select(NFLPlayerGameStats)
                .join(NFLGame, NFLPlayerGameStats.game_id == NFLGame.id)
                .where(
                    NFLGame.game_week == week,
                    NFLGame.season == season_year,
                    NFLPlayerGameStats.player_id.in_(player_ids),
                )
            )
        )
        .scalars()
        .all()
    )

    total = Decimal(0)

    for game_stat in game_stats_rows:
        player = await db.scalar(
            select(NFLPlayer).where(NFLPlayer.id == game_stat.player_id)
        )
        position = PlayerPosition.from_str(player.position) if player else None
        pts = calculate_player_points(game_stat, league_settings, position)
        total += pts

        # Upsert PlayerScore
        existing = await db.scalar(
            select(PlayerScore).where(
                PlayerScore.lineup_id == lineup_row.id,
                PlayerScore.player_id == game_stat.player_id,
            )
        )
        if existing is not None:
            existing.points = pts
        else:
            db.add(
                PlayerScore(
                    lineup_id=lineup_row.id,
                    player_id=game_stat.player_id,
                    points=pts,
                )
            )

    return total
