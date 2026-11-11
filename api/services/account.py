"""Account center (#405): devices, display preferences and "download my data"."""

import re
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models.activity import LeagueMessage
from api.db.models.league import League, LeagueMember, Season, Team
from api.db.models.push import PushSubscription
from api.db.models.user import User
from api.models.account_models import Device
from api.services.avatars import avatar_url

_BROWSERS = (
    ("Edg/", "Edge"),
    ("OPR/", "Opera"),
    ("Firefox/", "Firefox"),
    ("Chrome/", "Chrome"),
    ("Safari/", "Safari"),
)
_SYSTEMS = (
    ("iPhone", "iPhone"),
    ("iPad", "iPad"),
    ("Android", "Android"),
    ("Windows", "Windows"),
    ("Mac OS X", "Mac"),
    ("CrOS", "Chromebook"),
    ("Linux", "Linux"),
)


def device_label(user_agent: str | None) -> str:
    """ "Chrome on Android" from a stored user agent; never the raw string."""
    agent = user_agent or ""
    browser = next((name for token, name in _BROWSERS if token in agent), None)
    system = next((name for token, name in _SYSTEMS if re.search(token, agent)), None)
    if browser and system:
        return f"{browser} on {system}"
    return browser or system or "Unknown device"


async def list_devices(db: AsyncSession, user_id: int) -> list[Device]:
    rows = await db.scalars(
        select(PushSubscription)
        .where(PushSubscription.user_id == user_id)
        .order_by(PushSubscription.last_seen.desc(), PushSubscription.id)
    )
    return [
        Device(
            id=row.id,
            label=device_label(row.user_agent),
            created_at=row.created_at,
            last_seen=row.last_seen,
        )
        for row in rows
    ]


async def remove_device(db: AsyncSession, user_id: int, device_id: int) -> bool:
    """Forget one of the member's own devices; False for an id that is not theirs."""
    deleted = await db.scalar(
        delete(PushSubscription)
        .where(PushSubscription.id == device_id, PushSubscription.user_id == user_id)
        .returning(PushSubscription.id)
    )
    return deleted is not None


async def remove_all_devices(db: AsyncSession, user_id: int) -> None:
    await db.execute(
        delete(PushSubscription).where(PushSubscription.user_id == user_id)
    )


def _iso(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


async def export_data(db: AsyncSession, user: User) -> dict[str, Any]:
    """Everything the app holds about one member, as JSON for a privacy request: the
    profile and preferences, league memberships, teams, and the chat they wrote. Other
    members' data and the push keys are left out."""
    memberships = (
        await db.execute(
            select(LeagueMember, League.name)
            .join(League, League.id == LeagueMember.league_id)
            .where(LeagueMember.user_id == user.id)
            .order_by(LeagueMember.joined_at)
        )
    ).all()
    teams = (
        await db.execute(
            select(Team.id, Team.name, Season.year, League.id, League.name)
            .join(Season, Season.id == Team.season_id)
            .join(League, League.id == Season.league_id)
            .where(Team.owner_id == user.id)
            .order_by(Season.year, Team.id)
        )
    ).all()
    messages = (
        await db.execute(
            select(LeagueMessage, League.name, Season.year)
            .join(Season, Season.id == LeagueMessage.season_id)
            .join(League, League.id == LeagueMessage.league_id)
            .where(LeagueMessage.author_user_id == user.id)
            .order_by(LeagueMessage.id)
        )
    ).all()
    return {
        "exportedAt": datetime.now(UTC).isoformat(),
        "profile": {
            "displayName": user.username,
            "email": user.email,
            "joinedAt": _iso(user.created_at),
            "avatarUrl": avatar_url(user.avatar_key),
            "displayTimeZone": user.display_time_zone,
            "hourCycle": user.hour_cycle,
            "notifications": {
                "draftAlerts": user.push_draft_alerts,
                "lineupReminders": user.push_lineup_reminders,
                "chat": user.push_chat,
                "mentions": user.push_mentions,
                "starterAlerts": user.push_starter_alerts,
                "scoreAlerts": user.push_score_alerts,
                "roundResults": user.push_round_results,
                "quietHours": user.quiet_hours,
                "quietHoursTimeZone": user.timezone,
            },
        },
        "memberships": [
            {
                "leagueId": member.league_id,
                "leagueName": league_name,
                "role": member.role,
                "joinedAt": _iso(member.joined_at),
                "leftAt": _iso(member.left_at),
            }
            for member, league_name in memberships
        ],
        "teams": [
            {
                "teamId": team_id,
                "teamName": team_name,
                "seasonYear": year,
                "leagueId": league_id,
                "leagueName": league_name,
            }
            for team_id, team_name, year, league_id, league_name in teams
        ],
        "chatMessages": [
            {
                "id": message.id,
                "leagueName": league_name,
                "seasonYear": year,
                "body": message.body,
                "gifUrl": message.gif_url,
                "createdAt": _iso(message.created_at),
                "editedAt": _iso(message.edited_at),
                "deletedAt": _iso(message.deleted_at),
            }
            for message, league_name, year in messages
        ],
        "devices": [
            {
                "label": device.label,
                "addedAt": _iso(device.created_at),
                "lastSeen": _iso(device.last_seen),
            }
            for device in await list_devices(db, user.id)
        ],
    }
