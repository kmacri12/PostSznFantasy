"""Which NFL teams are in the playoffs, and when the first Wild Card game kicks off.

The draft pool is the players on those teams. Tank01 has no seeds, so the 14-team field
is complete only once the schedule (12 Wild Card teams) plus the top seeds' byes are in.
"""

from collections.abc import Collection
from datetime import UTC, datetime

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from api.core.config import get_settings
from api.db.models.nfl import NFLGame, NFLTeam
from api.services.draft_picks import DraftPickError
from api.services.ingestion.schemas import POSTSEASON_WEEKS

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


class PlayoffFieldError(ValueError):
    """The requested field was refused; the message says why and is safe to show."""


async def set_playoff_field(db: AsyncSession, team_ids: Collection[int]) -> None:
    """Replace the field; the admin sets this once the seeds are known."""
    ids = set(team_ids)
    size = get_settings().playoff_field_size
    if len(ids) != size:
        raise PlayoffFieldError(
            f"The playoff field has exactly {size} teams, got {len(ids)}"
        )
    known = set(await db.scalars(select(NFLTeam.id).where(NFLTeam.id.in_(ids))))
    if unknown := sorted(ids - known):
        raise PlayoffFieldError(f"Unknown NFL team ids: {', '.join(map(str, unknown))}")
    await db.execute(update(NFLTeam).values(in_playoffs=NFLTeam.id.in_(ids)))


async def set_playoff_field_by_abbreviation(
    db: AsyncSession, abbreviations: Collection[str]
) -> list[NFLTeam]:
    """The owner's way in (api.scripts.set_playoff_field): `BUF KC ...`."""
    wanted = {abv.strip().upper() for abv in abbreviations}
    teams = list(await db.scalars(select(NFLTeam).where(NFLTeam.team_abv.in_(wanted))))
    if unknown := sorted(wanted - {team.team_abv for team in teams}):
        known = list(
            await db.scalars(
                select(NFLTeam.team_abv)
                .where(NFLTeam.team_abv.is_not(None))
                .order_by(NFLTeam.team_abv)
            )
        )
        if not known:
            raise PlayoffFieldError(
                "No NFL teams are loaded; run api.scripts.seed_nfl_data first"
            )
        raise PlayoffFieldError(
            f"Unknown team abbreviations: {', '.join(unknown)}. "
            f"Known: {', '.join(abv or '' for abv in known)}"
        )
    await set_playoff_field(db, [team.id for team in teams])
    return sorted(teams, key=lambda team: team.team_abv or "")


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
    if when.tzinfo is None:
        when = when.replace(tzinfo=UTC)
    if datetime.now(UTC) >= kickoff or when > kickoff:
        raise DraftPickError(
            "Drafts must start before the first Wild Card kickoff "
            f"({kickoff:%b %d, %H:%M} UTC)",
            code="draft_window_closed",
        )
