from fastapi import APIRouter

router = APIRouter()


@router.get("/")
async def health() -> dict[str, str]:
    return {"status": "healthy"}


# TODO (Phase 2): Implement Firebase token exchange & user upsert endpoint.
# POST /login — verify Firebase ID token via Depends(get_current_user), upsert User row, return internal user_id.
