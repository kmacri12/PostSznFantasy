"""Every route called as every kind of caller against a real database.

The expected answers live in `api/tests/authz_expectations.py`; the sibling
`test_authz_coverage.py` makes a route without an entry fail. The probes send no
body, so a permitted call ends in 422 or a business-rule 409 rather than doing the
work: what is checked is that the guard let the caller in (or kept them out).
"""

import re
from datetime import UTC, datetime

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models import League, LeagueMember, User
from api.db.models.activity import LeagueMessage
from api.dependencies.auth import get_current_user
from api.main import app
from api.tests.authz_expectations import BODIES, EXPECTED, ROLES, Allowed
from api.tests.postgres.conftest import ClientFactory
from api.tests.postgres.factories import make_season

ROUTES = sorted(EXPECTED)
STRANGER_UID = "uid-stranger"
FORMER_UID = "uid-former"
UID_BY_ROLE = {
    "stranger": STRANGER_UID,
    "former": FORMER_UID,
    "member": "uid-2",
    "owner": "uid-1",
    "commissioner": "uid-0",
}


async def seed(db: AsyncSession) -> dict[str, str]:
    """A league of three teams (commissioner, owner, member), plus a former member and
    a stranger; returns the values for the path parameters."""
    season, users, teams, draft = await make_season(
        db, teams=3, draft_status="scheduled"
    )
    stranger = User(supabase_uid=STRANGER_UID, username="stranger", email="s@x.co")
    former = User(supabase_uid=FORMER_UID, username="former", email="f@x.co")
    db.add_all([stranger, former])
    await db.flush()
    db.add(
        LeagueMember(
            league_id=season.league_id,
            user_id=former.id,
            role="member",
            left_at=datetime.now(UTC),
        )
    )
    message = LeagueMessage(
        league_id=season.league_id,
        season_id=season.id,
        author_user_id=users[1].id,
        author_name="user1",
        body="hello",
    )
    db.add(message)
    await db.flush()
    league = await db.get(League, season.league_id)
    assert league is not None
    return {
        "league_id": str(season.league_id),
        "season_id": str(season.id),
        "team_id": str(teams[1].id),
        "draft_id": str(draft.id),
        "user_id": str(users[2].id),
        "message_id": str(message.id),
        "device_id": "1",
        "game_id": "1",
        "pick_number": "1",
        "code": "NOSUCHCODE",
        "action": "pause",
        "key": "probe",
    }


def fill(path: str, values: dict[str, str]) -> str:
    return re.sub(r"\{(\w+)\}", lambda m: values[m.group(1)], path)


@pytest.mark.parametrize("role", ROLES)
@pytest.mark.parametrize("route", ROUTES)
async def test_route_access(
    route: str, role: str, db: AsyncSession, client_as: ClientFactory
) -> None:
    values = await seed(db)
    method, template = route.split(" ", 1)
    expected = EXPECTED[route].for_role(role)

    client = client_as(UID_BY_ROLE.get(role, "unused"))
    if role == "anonymous":
        app.dependency_overrides.pop(get_current_user)
    async with client:
        response = await client.request(
            method, fill(template, values), json=BODIES.get(route)
        )
    status = response.status_code

    # 503 is a feature that is not configured here (support email), not a failure.
    assert status < 500 or status == 503, f"{route} as {role}: server error {status}"
    if isinstance(expected, Allowed):
        assert status not in (401, 403), (
            f"{route} as {role} should reach the handler, got {status}: "
            f"{response.text[:200]}"
        )
    elif isinstance(expected, int):
        assert status == expected, f"{route} as {role}: {status}, want {expected}"
    else:
        assert status in expected, f"{route} as {role}: {status}, want {expected}"
