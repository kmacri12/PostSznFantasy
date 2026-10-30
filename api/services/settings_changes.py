from sqlalchemy.ext.asyncio import AsyncSession

from api.services.standings import refresh_standings_if_drafted


async def on_editable_settings_changed(db: AsyncSession, league_id: int) -> None:
    """Scoring, multipliers and team QB/K stay editable after the draft starts.

    Everything derived from them is recomputed. Epic 14 records the change in the
    activity feed from here.
    """
    await refresh_standings_if_drafted(db, league_id)
