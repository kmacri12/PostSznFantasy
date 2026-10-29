import secrets
from datetime import UTC, datetime

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models.league import (
    League,
    LeagueInvite,
    LeagueMember,
    LeagueSettings,
    Team,
)
from api.db.models.user import User
from api.models.enums import LeagueRole
from api.services.league_admin import draft_has_started
from api.services.league_members import LeagueRuleError

# No 0/O/1/I/L so codes survive being read aloud or retyped.
CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
CODE_LENGTH = 8


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
        expires_at=expires_at,
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
            select(LeagueInvite).where(LeagueInvite.code == normalize_code(code))
        )
    ).scalar_one_or_none()


async def open_team_count(db: AsyncSession, league_id: int) -> int:
    teams = (
        (
            await db.execute(
                select(Team.id).where(
                    Team.league_id == league_id, Team.owner_id.is_(None)
                )
            )
        )
        .scalars()
        .all()
    )
    return len(teams)


async def join_problem(db: AsyncSession, invite: LeagueInvite) -> str | None:
    problem = invite_problem(invite, datetime.now(UTC))
    if problem:
        return problem
    if await open_team_count(db, invite.league_id) == 0:
        return "This league is full"
    settings = (
        await db.execute(
            select(LeagueSettings).where(LeagueSettings.league_id == invite.league_id)
        )
    ).scalar_one()
    if not settings.allow_join_after_draft_start and await draft_has_started(
        db, invite.league_id
    ):
        return "The draft has already started"
    return None


async def join_league(
    db: AsyncSession, invite: LeagueInvite, user: User
) -> tuple[League, Team | None, bool]:
    """Claim an open team for the user; returns (league, team, already_member)."""
    league = await db.get(League, invite.league_id)
    assert league is not None
    existing = await db.get(LeagueMember, (invite.league_id, user.id))
    if existing is not None:
        team = (
            (
                await db.execute(
                    select(Team).where(
                        Team.league_id == invite.league_id, Team.owner_id == user.id
                    )
                )
            )
            .scalars()
            .first()
        )
        return league, team, True

    problem = await join_problem(db, invite)
    if problem:
        raise LeagueRuleError(problem)

    team = (
        (
            await db.execute(
                select(Team)
                .where(Team.league_id == invite.league_id, Team.owner_id.is_(None))
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
    db.add(
        LeagueMember(
            league_id=invite.league_id, user_id=user.id, role=LeagueRole.MEMBER.value
        )
    )
    invite.uses += 1
    await db.flush()
    return league, team, False
