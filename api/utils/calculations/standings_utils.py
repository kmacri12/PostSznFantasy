from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models.league import LeagueSettings, Team, TeamPlayer
from api.db.models.nfl import NFLPlayer, NFLTeam


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


# Postseason rounds in order; the schedule feed numbers them 1-4 or continues the
# regular season as 19-22.
ROUND_MULTIPLIER_FIELDS = (
    "multiplier_wild_card",
    "multiplier_divisional",
    "multiplier_conference",
    "multiplier_super_bowl",
)


def postseason_round_index(week: int) -> int | None:
    """0 = wild card .. 3 = super bowl; None for a week outside the postseason."""
    index = week - 19 if week >= 19 else week - 1
    return index if 0 <= index < len(ROUND_MULTIPLIER_FIELDS) else None


def round_multiplier(settings: LeagueSettings, week: int) -> Decimal:
    """Commissioner-configured scoring multiplier for the postseason round of `week`."""
    index = postseason_round_index(week)
    if index is None:
        return Decimal(1)
    return Decimal(str(getattr(settings, ROUND_MULTIPLIER_FIELDS[index])))
