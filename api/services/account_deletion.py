"""Delete a member's account (#330): their identity goes, the leagues' history stays.

The Supabase Auth user, push subscriptions, notifications and picture are deleted; the
`users` row is kept as a "Former member" with no email so finished seasons, drafts and
chat still make sense for everyone else. Names copied into chat messages and feed events are
overwritten. Encrypted database backups age out on their own schedule.
"""

import logging
from dataclasses import dataclass
from datetime import UTC, datetime

import httpx
from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from api.core.config import get_settings
from api.db.models.activity import ActivityEvent, LeagueMessage
from api.db.models.league import League, LeagueMember, Season, Team
from api.db.models.push import PushSubscription
from api.db.models.user import User
from api.models.enums import LeagueRole
from api.services import avatars, notifications
from api.services.live_leagues import live_league_ids
from api.services.round_status import season_is_finished

logger = logging.getLogger(__name__)

FORMER_MEMBER = "Former member"
REQUEST_TIMEOUT_SECONDS = 10.0

# Tests install httpx.MockTransport here so Supabase is never called.
_transport: httpx.AsyncBaseTransport | None = None


class AccountDeletionError(Exception):
    """Deleting was refused or could not finish; the message is safe to show."""

    def __init__(self, status_code: int, message: str) -> None:
        super().__init__(message)
        self.status_code = status_code


@dataclass
class DeletionResult:
    leagues_left: int
    teams_freed: int


async def leagues_needing_a_commissioner(db: AsyncSession, user_id: int) -> list[str]:
    """Names of leagues where this member is the only commissioner and others remain."""
    others = (
        select(func.count())
        .select_from(LeagueMember)
        .where(
            LeagueMember.league_id == League.id,
            LeagueMember.left_at.is_(None),
            LeagueMember.user_id != user_id,
        )
        .correlate(League)
        .scalar_subquery()
    )
    other_commissioners = (
        select(func.count())
        .select_from(LeagueMember)
        .where(
            LeagueMember.league_id == League.id,
            LeagueMember.left_at.is_(None),
            LeagueMember.role == LeagueRole.COMMISSIONER.value,
            LeagueMember.user_id != user_id,
        )
        .correlate(League)
        .scalar_subquery()
    )
    rows = await db.scalars(
        select(League.name)
        .join(LeagueMember, LeagueMember.league_id == League.id)
        .where(
            League.id.in_(live_league_ids()),
            LeagueMember.user_id == user_id,
            LeagueMember.left_at.is_(None),
            LeagueMember.role == LeagueRole.COMMISSIONER.value,
            others > 0,
            other_commissioners == 0,
        )
        .order_by(League.name)
    )
    return list(rows)


async def _delete_auth_user(supabase_uid: str) -> None:
    """Remove the sign-in identity; a user that is already gone counts as deleted."""
    settings = get_settings()
    if not settings.supabase_service_role_key:
        raise AccountDeletionError(503, "Account deletion is not set up yet.")
    key = settings.supabase_service_role_key
    url = f"{settings.supabase_url.rstrip('/')}/auth/v1/admin/users/{supabase_uid}"
    try:
        async with httpx.AsyncClient(
            transport=_transport, timeout=REQUEST_TIMEOUT_SECONDS
        ) as client:
            response = await client.delete(
                url, headers={"Authorization": f"Bearer {key}", "apikey": key}
            )
    except httpx.HTTPError as exc:
        logger.error("Auth user not deleted: %s", type(exc).__name__)
        raise AccountDeletionError(
            502, "We couldn't delete your account. Try again."
        ) from exc
    if response.status_code not in (200, 204, 404):
        logger.error("Auth user not deleted: HTTP %d", response.status_code)
        raise AccountDeletionError(502, "We couldn't delete your account. Try again.")


async def delete_account(db: AsyncSession, user: User) -> DeletionResult:
    """Delete the account; the caller commits. The sign-in identity goes first, so a
    failure there leaves everything as it was."""
    blocking = await leagues_needing_a_commissioner(db, user.id)
    if blocking:
        raise AccountDeletionError(
            409,
            "Hand over commissioner to another member first in: " + ", ".join(blocking),
        )
    await _delete_auth_user(user.supabase_uid)

    teams_freed = 0
    memberships = (
        await db.scalars(
            select(LeagueMember).where(
                LeagueMember.user_id == user.id, LeagueMember.left_at.is_(None)
            )
        )
    ).all()
    for membership in memberships:
        membership.left_at = datetime.now(UTC)
    teams = (await db.scalars(select(Team).where(Team.owner_id == user.id))).all()
    for team in teams:
        season = await db.get(Season, team.season_id)
        if season is not None and not await season_is_finished(db, season.year):
            team.owner_id = None
            teams_freed += 1

    await db.execute(
        delete(PushSubscription).where(PushSubscription.user_id == user.id)
    )
    await notifications.delete_for_user(db, user.id)
    await avatars.clear_avatar(user)
    await db.execute(
        update(LeagueMessage)
        .where(LeagueMessage.author_user_id == user.id)
        .values(author_name=FORMER_MEMBER)
    )
    await db.execute(
        update(ActivityEvent)
        .where(ActivityEvent.actor_user_id == user.id)
        .values(actor_name=FORMER_MEMBER)
    )
    user.username = FORMER_MEMBER
    user.email = None
    user.supabase_uid = f"deleted:{user.id}"
    await db.flush()
    logger.info("Account deleted", extra={"user_id": user.id})
    return DeletionResult(leagues_left=len(memberships), teams_freed=teams_freed)
