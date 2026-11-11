import json

from fastapi import APIRouter, HTTPException, Response, status
from sqlalchemy import select

from api.core.rate_limit import DataExportLimit
from api.db.models.user import User
from api.db.session import DbSession
from api.dependencies.auth import CurrentUser, TokenProviders
from api.models.account_models import (
    AccountOverview,
    AccountPreferences,
    AccountPreferencesUpdate,
)
from api.services import account

router = APIRouter()


async def _user(db: DbSession, supabase_uid: str) -> User:
    user = await db.scalar(select(User).where(User.supabase_uid == supabase_uid))
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    return user


@router.get("", response_model=AccountOverview)
async def get_account(
    supabase_uid: CurrentUser, providers: TokenProviders, db: DbSession
) -> AccountOverview:
    """The account center: sign-in methods, saved display preferences, devices."""
    user = await _user(db, supabase_uid)
    return AccountOverview(
        username=user.username,
        email=user.email,
        sign_in_methods=list(providers),
        display_time_zone=user.display_time_zone,
        hour_cycle=user.hour_cycle,
        devices=await account.list_devices(db, user.id),
    )


@router.patch("/preferences", response_model=AccountPreferences)
async def update_preferences(
    payload: AccountPreferencesUpdate, supabase_uid: CurrentUser, db: DbSession
) -> AccountPreferences:
    """Time zone and 12/24 hour clock; fields left out stay, null follows the browser."""
    user = await _user(db, supabase_uid)
    if "display_time_zone" in payload.model_fields_set:
        user.display_time_zone = payload.display_time_zone
    if "hour_cycle" in payload.model_fields_set:
        user.hour_cycle = payload.hour_cycle
    await db.flush()
    return AccountPreferences(
        display_time_zone=user.display_time_zone,
        hour_cycle=user.hour_cycle,
    )


@router.delete("/devices/{device_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_device(
    device_id: int, supabase_uid: CurrentUser, db: DbSession
) -> Response:
    """Stop notifications on one of the caller's devices; someone else's is a 404."""
    user = await _user(db, supabase_uid)
    if not await account.remove_device(db, user.id, device_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Device not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/devices", status_code=status.HTTP_204_NO_CONTENT)
async def remove_all_devices(supabase_uid: CurrentUser, db: DbSession) -> Response:
    """Stop notifications on every device (the first step of "sign out everywhere")."""
    user = await _user(db, supabase_uid)
    await account.remove_all_devices(db, user.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/export")
async def export_my_data(
    supabase_uid: CurrentUser, db: DbSession, _: DataExportLimit
) -> Response:
    """Download my data (#405): a JSON file with the caller's own profile, memberships,
    teams and chat. Built in one request; the volume is one member's chat."""
    user = await _user(db, supabase_uid)
    body = json.dumps(await account.export_data(db, user), indent=2)
    return Response(
        body,
        media_type="application/json",
        headers={
            "Content-Disposition": 'attachment; filename="postszn-my-data.json"',
            "Cache-Control": "no-store",
        },
    )
