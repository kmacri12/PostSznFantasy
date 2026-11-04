"""Recreate Supabase Auth users after the project was lost, from `fantasy.users`.

Run it AFTER restoring the backup into the database the API will use (PG_URI), against
the NEW Supabase project (SUPABASE_URL). Each user is created with the same id as
`fantasy.users.supabase_uid`, so leagues and teams still point at them. No passwords
or hashes are involved: sign-in is Google or an emailed code only.

    python -m api.scripts.recreate_auth_users             # dry run: print the plan
    SUPABASE_SERVICE_ROLE_KEY=... python -m api.scripts.recreate_auth_users --apply
    python -m api.scripts.recreate_auth_users --rehearse  # --apply against a fake server

The service-role key is read from the environment only; keep it out of Fly secrets and CI.
Emails are created as confirmed (you vouch for addresses the app already stored), which
lets Google sign-in link to the user and an emailed code work at once.
"""

import argparse
import asyncio
import contextlib
import json
import os
from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from uuid import UUID

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine

from api.core.config import get_settings
from api.core.logging import setup_logging
from api.db.models.user import User

ALREADY_EXISTS_CODES = {"email_exists", "user_already_exists"}


@dataclass(frozen=True)
class AppUser:
    supabase_uid: str
    email: str | None


@dataclass
class Plan:
    creatable: list[AppUser] = field(default_factory=list)
    skipped: list[tuple[AppUser, str]] = field(default_factory=list)


@dataclass
class Report:
    would_create: int = 0
    created: int = 0
    already_present: int = 0
    failed: list[tuple[str, int]] = field(default_factory=list)


def plan(users: list[AppUser]) -> Plan:
    result = Plan()
    for user in users:
        if not user.email:
            result.skipped.append((user, "no email"))
            continue
        try:
            UUID(user.supabase_uid)
        except ValueError:
            result.skipped.append((user, "id is not a uuid"))
            continue
        result.creatable.append(user)
    return result


async def recreate(
    client: httpx.AsyncClient, users: list[AppUser], *, apply: bool
) -> Report:
    report = Report()
    for user in plan(users).creatable:
        if not apply:
            report.would_create += 1
            continue
        response = await client.post(
            "/auth/v1/admin/users",
            json={
                "id": user.supabase_uid,
                "email": user.email,
                "email_confirm": True,
            },
        )
        if response.status_code in (401, 403):
            raise SystemExit("Supabase rejected the service-role key; stopping.")
        if response.is_success:
            report.created += 1
        elif response.status_code == 422 and _error_code(response) in (
            ALREADY_EXISTS_CODES
        ):
            report.already_present += 1
        else:
            report.failed.append((user.supabase_uid, response.status_code))
    return report


def _error_code(response: httpx.Response) -> str | None:
    try:
        return str(response.json().get("error_code"))
    except ValueError:
        return None


@contextlib.asynccontextmanager
async def fake_auth_server() -> AsyncIterator[httpx.AsyncClient]:
    """Stands in for Supabase's admin API: rejects a repeated id or email like it does."""
    ids: set[str] = set()
    emails: set[str] = set()

    def handle(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        if body["id"] in ids or body["email"] in emails:
            return httpx.Response(422, json={"error_code": "email_exists"})
        ids.add(body["id"])
        emails.add(body["email"])
        return httpx.Response(200, json={"id": body["id"]})

    async with httpx.AsyncClient(
        base_url="https://rehearsal.invalid", transport=httpx.MockTransport(handle)
    ) as client:
        yield client


async def _load_users() -> list[AppUser]:
    engine = create_async_engine(get_settings().async_database_url)
    try:
        async with engine.connect() as conn:
            rows = await conn.execute(
                select(User.supabase_uid, User.email).order_by(User.id)
            )
            return [AppUser(uid, email) for uid, email in rows]
    finally:
        await engine.dispose()


def _print(users: list[AppUser], report: Report, applied: bool) -> None:
    for user, reason in plan(users).skipped:
        print(f"SKIP {user.supabase_uid}: {reason} (must sign up again)")
    for uid, status in report.failed:
        print(f"FAIL {uid}: HTTP {status}")
    if applied:
        print(
            f"created {report.created}, already present {report.already_present}, "
            f"failed {len(report.failed)}"
        )
    else:
        print(f"dry run: would create {report.would_create} (pass --apply to do it)")


async def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--apply", action="store_true", help="create the users")
    mode.add_argument(
        "--rehearse", action="store_true", help="apply against a fake Auth server"
    )
    args = parser.parse_args()
    setup_logging()

    users = await _load_users()
    if args.rehearse:
        async with fake_auth_server() as client:
            first = await recreate(client, users, apply=True)
            again = await recreate(client, users, apply=True)
        _print(users, first, applied=True)
        print(f"second run: already present {again.already_present} (expected all)")
        return

    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if args.apply and not key:
        raise SystemExit(
            "Set SUPABASE_SERVICE_ROLE_KEY (never pass it as an argument)."
        )
    async with httpx.AsyncClient(
        base_url=get_settings().supabase_url.rstrip("/"),
        headers={"apikey": key, "Authorization": f"Bearer {key}"},
        timeout=30,
    ) as client:
        report = await recreate(client, users, apply=args.apply)
    _print(users, report, applied=args.apply)
    if report.failed:
        raise SystemExit(1)


if __name__ == "__main__":
    asyncio.run(main())
