import secrets
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models.league import (
    League,
    LeagueInvite,
    LeagueMember,
    Season,
    SeasonSettings,
    Team,
)
from api.db.models.user import User
from api.models.activity_models import MembershipJoinedPayload
from api.models.enums import LeagueRole
from api.services import activity
from api.services.league_admin import draft_has_started
from api.services.league_members import LeagueRuleError
from api.services.live_leagues import live_league_ids
from api.services.round_status import season_is_finished
from api.services.seasons import current_season

# No 0/O/1/I/L so codes survive being read aloud or retyped.
CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
CODE_LENGTH = 8
# A link posted in a group chat should not work forever.
DEFAULT_INVITE_TTL = timedelta(days=7)


def new_code() -> str:
    return "".join(secrets.choice(CODE_ALPHABET) for _ in range(CODE_LENGTH))


def normalize_code(code: str) -> str:
    return code.strip().upper()


def invite_problem(invite: LeagueInvite, now: datetime) -> str | None:
    if invite.revoked:
        return "This invite has been revoked"
    if invite.expires_at is not None and invite.expires_at <= now:
        return "This invite has expired"
    if invite.max_uses is not None and invite.uses >= invite.max_uses:
        return "This invite has reached its usage limit"
    return None


async def active_invite(db: AsyncSession, league_id: int) -> LeagueInvite | None:
    invites = (
        (
            await db.execute(
                select(LeagueInvite)
                .where(
                    LeagueInvite.league_id == league_id,
                    LeagueInvite.revoked.is_(False),
                )
                .order_by(LeagueInvite.id.desc())
            )
        )
        .scalars()
        .all()
    )
    now = datetime.now(UTC)
    return next((i for i in invites if invite_problem(i, now) is None), None)


async def revoke_invites(db: AsyncSession, league_id: int) -> None:
    await db.execute(
        update(LeagueInvite)
        .where(LeagueInvite.league_id == league_id)
        .values(revoked=True)
    )


async def create_invite(
    db: AsyncSession,
    league_id: int,
    created_by: int,
    expires_at: datetime | None,
    max_uses: int | None,
) -> LeagueInvite:
    """Replace any live invite: regenerating is how a leaked code is retired."""
    await revoke_invites(db, league_id)
    invite = LeagueInvite(
        code=new_code(),
        league_id=league_id,
        created_by=created_by,
        expires_at=expires_at or datetime.now(UTC) + DEFAULT_INVITE_TTL,
        max_uses=max_uses,
        uses=0,
        revoked=False,
    )
    db.add(invite)
    await db.flush()
    return invite


async def find_invite(db: AsyncSession, code: str) -> LeagueInvite | None:
    return (
        await db.execute(
            select(LeagueInvite).where(
                LeagueInvite.code == normalize_code(code),
                LeagueInvite.league_id.in_(live_league_ids()),
            )
        )
    ).scalar_one_or_none()


async def open_team_count(db: AsyncSession, league_id: int) -> int:
    """Unclaimed teams in the league's current season."""
    season = await current_season(db, league_id)
    if season is None:
        return 0
    return (
        await db.scalar(
            select(func.count()).where(
                Team.season_id == season.id, Team.owner_id.is_(None)
            )
        )
    ) or 0


async def join_problem(db: AsyncSession, invite: LeagueInvite) -> str | None:
    problem = invite_problem(invite, datetime.now(UTC))
    if problem:
        return problem
    season = await current_season(db, invite.league_id)
    if season is None or await season_is_finished(db, season.year):
        # Between seasons there is no team to claim; the commissioner assigns one
        # once the next season starts.
        return None
    if await open_team_count(db, invite.league_id) == 0:
        return "This league is full"
    settings = (
        await db.execute(
            select(SeasonSettings).where(SeasonSettings.season_id == season.id)
        )
    ).scalar_one()
    if not settings.allow_join_after_draft_start and await draft_has_started(
        db, season.id
    ):
        return "The draft has already started"
    return None


async def join_league(
    db: AsyncSession, invite: LeagueInvite, user: User
) -> tuple[League, Team | None, bool]:
    """Join the league and claim an open team of its current season, if there is one.

    Returns (league, team, already_member). Someone who left may rejoin with any
    live invite.
    """
    league = await db.get(League, invite.league_id)
    assert league is not None
    season = await current_season(db, invite.league_id)
    existing = await db.get(LeagueMember, (invite.league_id, user.id))
    if existing is not None and existing.left_at is None:
        return league, await _owned_team(db, season, user), True

    problem = await join_problem(db, invite)
    if problem:
        raise LeagueRuleError(problem)

    team = None
    if season is not None and not await season_is_finished(db, season.year):
        team = (
            (
                await db.execute(
                    select(Team)
                    .where(Team.season_id == season.id, Team.owner_id.is_(None))
                    .order_by(Team.id)
                    .limit(1)
                    .with_for_update(skip_locked=True)
                )
            )
            .scalars()
            .first()
        )
        if team is None:
            raise LeagueRuleError("This league is full")
        team.owner_id = user.id
    if existing is not None:
        existing.left_at = None
        existing.role = LeagueRole.MEMBER.value
        existing.joined_at = datetime.now(UTC)
    else:
        db.add(
            LeagueMember(
                league_id=invite.league_id,
                user_id=user.id,
                role=LeagueRole.MEMBER.value,
            )
        )
    invite.uses += 1
    await db.flush()
    await activity.append_to_league(
        db,
        invite.league_id,
        MembershipJoinedPayload(
            role=LeagueRole.MEMBER, team_name=team.name if team else None
        ),
        actor=activity.Actor.of(user),
    )
    return league, team, False


async def _owned_team(
    db: AsyncSession, season: Season | None, user: User
) -> Team | None:
    if season is None:
        return None
    return (
        (
            await db.execute(
                select(Team).where(
                    Team.season_id == season.id, Team.owner_id == user.id
                )
            )
        )
        .scalars()
        .first()
    )
