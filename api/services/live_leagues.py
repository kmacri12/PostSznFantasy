"""Soft-deleted leagues (#231): the one filter every league query goes through.

Deleting sets `deleted_at` on the permanent league and covers all its seasons; rows
are never removed. Queries that start from a league, a season or a league's members
use `live_league_ids` / `live_season_ids`; guards use `LeagueDeletedError`.
"""

from datetime import UTC, datetime
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import Select, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models.draft import Draft
from api.db.models.league import League, LeagueInvite, Season
from api.models.enums import DraftStatus
from api.services.league_members import LeagueRuleError


def live_league_ids() -> Select[Any]:
    return select(League.id).where(League.deleted_at.is_(None))


def live_season_ids() -> Select[Any]:
    return select(Season.id).where(Season.league_id.in_(live_league_ids()))


class LeagueDeletedError(HTTPException):
    """404 a former or current member gets for a deleted league; the SPA renders a
    plain "deleted by a commissioner" page from the body (see main.py)."""

    def __init__(self, league: League) -> None:
        super().__init__(status.HTTP_404_NOT_FOUND, "This league was deleted")
        self.league_name = league.name
        self.deleted_at = league.deleted_at


async def delete_league(
    db: AsyncSession, league: League, *, deleted_by: int | None
) -> None:
    running = await db.scalar(
        select(Draft.id)
        .join(Season, Season.id == Draft.season_id)
        .where(
            Season.league_id == league.id,
            Draft.status.in_([DraftStatus.IN_PROGRESS.value, DraftStatus.PAUSED.value]),
        )
        .limit(1)
    )
    if running is not None:
        raise LeagueRuleError("End the draft in progress before deleting the league")
    league.deleted_at = datetime.now(UTC)
    league.deleted_by = deleted_by
    await db.execute(
        update(LeagueInvite)
        .where(LeagueInvite.league_id == league.id)
        .values(revoked=True)
    )
    await db.flush()


async def restore_league(db: AsyncSession, league_id: int) -> bool:
    """Owner-only (`api.scripts.restore_league`). The invite stays revoked."""
    league = await db.get(League, league_id)
    if league is None or league.deleted_at is None:
        return False
    league.deleted_at = None
    league.deleted_by = None
    await db.flush()
    return True
