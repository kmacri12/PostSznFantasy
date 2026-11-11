"""Account center (#405): devices with ownership checks, display preferences, data export."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models import LeagueMessage, PushSubscription, User
from api.services.account import device_label
from api.tests.postgres.conftest import ClientFactory
from api.tests.postgres.factories import make_season

CHROME_ANDROID = (
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36"
)


async def _device(
    db: AsyncSession, user: User, name: str, agent: str | None = None
) -> PushSubscription:
    row = PushSubscription(
        user_id=user.id,
        endpoint=f"https://fcm.googleapis.com/fcm/send/{name}",
        p256dh="secret-key",
        auth="secret-auth",
        user_agent=agent,
    )
    db.add(row)
    await db.flush()
    return row


def test_device_labels_name_the_browser_and_system_only() -> None:
    assert device_label(CHROME_ANDROID) == "Chrome on Android"
    assert device_label(None) == "Unknown device"


async def test_overview_lists_methods_and_devices_without_secrets(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    _, users, _, _ = await make_season(db, teams=2)
    await _device(db, users[0], "mine", CHROME_ANDROID)
    await _device(db, users[1], "theirs")
    async with client_as("uid-0", "u0@x.co", ("google", "email")) as client:
        body = (await client.get("/api/account")).json()
    assert body["email"] == "u0@x.co"
    assert body["signInMethods"] == ["google", "email"]
    assert [d["label"] for d in body["devices"]] == ["Chrome on Android"]
    assert "secret" not in str(body)
    assert "endpoint" not in str(body)


async def test_a_member_removes_only_their_own_device(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    _, users, _, _ = await make_season(db, teams=2)
    mine = await _device(db, users[0], "mine")
    theirs = await _device(db, users[1], "theirs")
    async with client_as("uid-0") as client:
        refused = await client.delete(f"/api/account/devices/{theirs.id}")
        removed = await client.delete(f"/api/account/devices/{mine.id}")
    assert refused.status_code == 404
    assert removed.status_code == 204
    remaining = (await db.scalars(select(PushSubscription.id))).all()
    assert remaining == [theirs.id]


async def test_remove_all_touches_only_the_callers_devices(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    _, users, _, _ = await make_season(db, teams=2)
    await _device(db, users[0], "a")
    await _device(db, users[0], "b")
    other = await _device(db, users[1], "c")
    async with client_as("uid-0") as client:
        assert (await client.delete("/api/account/devices")).status_code == 204
    assert (await db.scalars(select(PushSubscription.id))).all() == [other.id]


async def test_preferences_save_clear_and_validate(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    await make_season(db, teams=1)
    async with client_as("uid-0") as client:
        saved = await client.patch(
            "/api/account/preferences",
            json={"displayTimeZone": "America/Chicago", "hourCycle": "24"},
        )
        only_clock = await client.patch(
            "/api/account/preferences", json={"hourCycle": "12"}
        )
        login = await client.post("/api/auth/login", json={})
        bad_zone = await client.patch(
            "/api/account/preferences", json={"displayTimeZone": "Mars/Base"}
        )
        bad_clock = await client.patch(
            "/api/account/preferences", json={"hourCycle": "13"}
        )
        cleared = await client.patch(
            "/api/account/preferences",
            json={"displayTimeZone": None, "hourCycle": None},
        )
    assert saved.json() == {"displayTimeZone": "America/Chicago", "hourCycle": "24"}
    assert only_clock.json() == {
        "displayTimeZone": "America/Chicago",
        "hourCycle": "12",
    }
    assert login.json()["displayTimeZone"] == "America/Chicago"
    assert login.json()["hourCycle"] == "12"
    assert bad_zone.status_code == 422
    assert bad_clock.status_code == 422
    assert cleared.json() == {"displayTimeZone": None, "hourCycle": None}


async def test_the_export_holds_only_the_callers_own_data(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, users, teams, _ = await make_season(db, teams=2)
    for author, text in ((users[0], "mine"), (users[1], "theirs")):
        db.add(
            LeagueMessage(
                league_id=season.league_id,
                season_id=season.id,
                author_user_id=author.id,
                author_name=author.username,
                body=text,
            )
        )
    await _device(db, users[0], "mine", CHROME_ANDROID)
    await db.flush()
    async with client_as("uid-0") as client:
        response = await client.get("/api/account/export")
    assert response.status_code == 200
    assert "attachment" in response.headers["content-disposition"]
    data = response.json()
    assert data["profile"]["email"] == "u0@x.co"
    assert [m["role"] for m in data["memberships"]] == ["commissioner"]
    assert [t["seasonYear"] for t in data["teams"]] == [2025]
    assert [m["body"] for m in data["chatMessages"]] == ["mine"]
    assert data["devices"][0]["label"] == "Chrome on Android"
    assert "theirs" not in response.text
    assert "u1@x.co" not in response.text
    assert "secret-key" not in response.text
    assert "fcm.googleapis.com" not in response.text


async def test_the_export_is_rate_limited(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    await make_season(db, teams=1)
    async with client_as("uid-0") as client:
        statuses = [
            (await client.get("/api/account/export")).status_code for _ in range(4)
        ]
    assert statuses == [200, 200, 200, 429]
