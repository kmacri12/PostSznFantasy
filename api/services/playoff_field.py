"""Which NFL teams are in the playoffs, and when the first Wild Card game kicks off.

The draft pool is the players on those teams. Tank01 has no seeds, so the 14-team field
is complete only once the schedule (12 Wild Card teams) plus the top seeds' byes are in.
"""

from datetime import UTC, datetime

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from api.core.config import get_settings
from api.db.models.nfl import NFLGame, NFLTeam
from api.services.draft_picks import DraftPickError
from api.services.ingestion.schemas import POSTSEASON_WEEKS

PLAYOFF_FIELD_SIZE = 14  # the real field; see Settings.playoff_field_size
WILD_CARD_WEEK = POSTSEASON_WEEKS["Wild Card"]


async def playoff_team_count(db: AsyncSession) -> int:
    return (
        await db.scalar(
            select(func.count()).select_from(NFLTeam).where(NFLTeam.in_playoffs)
        )
        or 0
    )


async def require_field_set(db: AsyncSession) -> None:
    count = await playoff_team_count(db)
    size = get_settings().playoff_field_size
    if count != size:
        raise DraftPickError(
            "The draft can't start until the playoff field is set "
            f"({count} of {size} teams so far)",
            code="field_not_set",
        )


async def set_playoff_field(db: AsyncSession, team_ids: list[int]) -> None:
    """Replace the field; the admin sets this once the seeds are known."""
    await db.execute(update(NFLTeam).values(in_playoffs=NFLTeam.id.in_(team_ids)))


async def mark_teams_in_playoffs(db: AsyncSession, team_ids: set[int]) -> None:
    """Add teams seen in a postseason game; never removes any."""
    if team_ids:
        await db.execute(
            update(NFLTeam).where(NFLTeam.id.in_(team_ids)).values(in_playoffs=True)
        )


async def first_wild_card_kickoff(db: AsyncSession, season: int) -> datetime | None:
    epochs = (
        await db.execute(
            select(NFLGame.game_time_epoch).where(
                NFLGame.season == season,
                NFLGame.game_week == WILD_CARD_WEEK,
                NFLGame.game_time_epoch.is_not(None),
            )
        )
    ).scalars()
    kickoffs = [datetime.fromtimestamp(float(e), UTC) for e in epochs if e]
    return min(kickoffs, default=None)


async def require_draft_window_open(
    db: AsyncSession, season: int, *, scheduled_for: datetime | None = None
) -> None:
    """Refuse scheduling or starting a draft that would begin after the first kickoff.

    Without a known schedule there is nothing to cut off against. A draft already
    running is never passed through here, so it may finish.
    """
    kickoff = await first_wild_card_kickoff(db, season)
    if kickoff is None:
        return
    when = scheduled_for or datetime.now(UTC)
    if datetime.now(UTC) >= kickoff or when > kickoff:
        raise DraftPickError(
            "Drafts must start before the first Wild Card kickoff "
            f"({kickoff:%b %d, %H:%M} UTC)",
            code="draft_window_closed",
        )
