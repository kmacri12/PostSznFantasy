import json
from uuid import uuid4

import httpx
import pytest

from api.scripts.recreate_auth_users import (
    AppUser,
    fake_auth_server,
    plan,
    recreate,
)

UID = str(uuid4())


def test_users_without_an_email_or_a_uuid_id_are_skipped_with_a_reason() -> None:
    users = [
        AppUser(supabase_uid=UID, email="a@example.com"),
        AppUser(supabase_uid=str(uuid4()), email=None),
        AppUser(supabase_uid="not-a-uuid", email="b@example.com"),
    ]

    result = plan(users)

    assert [u.email for u in result.creatable] == ["a@example.com"]
    assert {reason for _, reason in result.skipped} == {"no email", "id is not a uuid"}


async def test_dry_run_sends_nothing() -> None:
    sent: list[httpx.Request] = []

    def record(request: httpx.Request) -> httpx.Response:
        sent.append(request)
        return httpx.Response(200)

    async with httpx.AsyncClient(transport=httpx.MockTransport(record)) as client:
        report = await recreate(client, [AppUser(UID, "a@example.com")], apply=False)

    assert sent == []
    assert report.created == 0 and report.would_create == 1


async def test_apply_creates_each_user_with_the_same_id_and_a_confirmed_email() -> None:
    bodies: list[dict[str, object]] = []

    def record(request: httpx.Request) -> httpx.Response:
        bodies.append(json.loads(request.content))
        return httpx.Response(200, json={"id": UID})

    async with httpx.AsyncClient(
        base_url="https://x.supabase.co", transport=httpx.MockTransport(record)
    ) as client:
        report = await recreate(client, [AppUser(UID, "a@example.com")], apply=True)

    assert bodies == [{"id": UID, "email": "a@example.com", "email_confirm": True}]
    assert report.created == 1


async def test_the_request_never_carries_a_password_or_hash() -> None:
    bodies: list[dict[str, object]] = []

    def record(request: httpx.Request) -> httpx.Response:
        bodies.append(json.loads(request.content))
        return httpx.Response(200)

    async with httpx.AsyncClient(
        base_url="https://x.supabase.co", transport=httpx.MockTransport(record)
    ) as client:
        await recreate(client, [AppUser(UID, "a@example.com")], apply=True)

    assert not {"password", "password_hash"} & set(bodies[0])


async def test_running_it_twice_counts_existing_users_instead_of_failing() -> None:
    async with fake_auth_server() as client:
        users = [AppUser(UID, "a@example.com")]
        first = await recreate(client, users, apply=True)
        second = await recreate(client, users, apply=True)

    assert (first.created, first.already_present) == (1, 0)
    assert (second.created, second.already_present) == (0, 1)


async def test_a_server_error_is_reported_and_does_not_stop_the_rest() -> None:
    other = str(uuid4())

    def fail_first(request: httpx.Request) -> httpx.Response:
        if json.loads(request.content)["id"] == UID:
            return httpx.Response(500, json={"msg": "boom"})
        return httpx.Response(200)

    async with httpx.AsyncClient(
        base_url="https://x.supabase.co", transport=httpx.MockTransport(fail_first)
    ) as client:
        report = await recreate(
            client,
            [AppUser(UID, "a@example.com"), AppUser(other, "b@example.com")],
            apply=True,
        )

    assert report.created == 1
    assert [uid for uid, _ in report.failed] == [UID]


@pytest.mark.parametrize("status", [401, 403])
async def test_a_rejected_key_aborts_instead_of_failing_every_user(
    status: int,
) -> None:
    async with httpx.AsyncClient(
        base_url="https://x.supabase.co",
        transport=httpx.MockTransport(lambda r: httpx.Response(status)),
    ) as client:
        with pytest.raises(SystemExit, match="service-role key"):
            await recreate(client, [AppUser(UID, "a@example.com")], apply=True)
