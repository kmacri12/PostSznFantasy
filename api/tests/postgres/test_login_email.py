from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models.user import User
from api.tests.postgres.conftest import ClientFactory


async def _email_of(db: AsyncSession, uid: str) -> str | None:
    return await db.scalar(select(User.email).where(User.supabase_uid == uid))


async def test_login_stores_the_token_email_lowercased(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    async with client_as("uid-a", "Mixed@Example.com") as client:
        assert (await client.post("/api/auth/login", json={})).status_code == 200
    assert await _email_of(db, "uid-a") == "mixed@example.com"


async def test_a_body_email_is_ignored(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    async with client_as("uid-a", "real@example.com") as client:
        response = await client.post(
            "/api/auth/login", json={"email": "victim@example.com"}
        )
    assert response.status_code == 200
    assert await _email_of(db, "uid-a") == "real@example.com"


async def test_an_email_held_by_another_identity_blocks_nobody(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    async with client_as("uid-google", "pat@example.com") as client:
        assert (await client.post("/api/auth/login", json={})).status_code == 200
    async with client_as("uid-otp", "pat@example.com") as client:
        second = await client.post("/api/auth/login", json={"username": "pat"})
        again = await client.post("/api/auth/login", json={})
    assert second.status_code == 200
    assert again.status_code == 200
    assert await _email_of(db, "uid-google") == "pat@example.com"
    assert await _email_of(db, "uid-otp") is None


async def test_the_real_owner_signs_in_after_an_attacker_used_other_identity(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    async with client_as("uid-attacker", "attacker@example.com") as client:
        await client.post("/api/auth/login", json={"email": "victim@example.com"})
    async with client_as("uid-victim", "victim@example.com") as client:
        response = await client.post("/api/auth/login", json={})
    assert response.status_code == 200
    assert await _email_of(db, "uid-victim") == "victim@example.com"


async def test_a_later_sign_in_never_overwrites_the_chosen_name(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    async with client_as("uid-name", "n@example.com") as client:
        first = await client.post("/api/auth/login", json={"username": "  Pat  "})
        assert first.json()["username"] == "Pat"
        assert first.json()["namePrompt"] is True
        assert (
            await client.patch("/api/auth/me", json={"username": "Coach"})
        ).status_code == 200
        later = await client.post("/api/auth/login", json={"username": "Pat"})
    assert later.json()["username"] == "Coach"
    assert later.json()["namePrompt"] is False


async def test_an_email_sign_in_without_a_name_gets_a_placeholder_and_a_prompt(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    async with client_as("uid-nameless", "secret.person@example.com") as client:
        first = await client.post("/api/auth/login", json={})
        again = await client.post("/api/auth/login", json={})
    assert first.json()["username"] == "user_uid-name"
    assert "secret" not in first.json()["username"]
    assert again.json()["namePrompt"] is True
