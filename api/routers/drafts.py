from fastapi import APIRouter

router = APIRouter()


@router.get("/")
async def health() -> dict[str, str]:
    return {"status": "healthy"}


# TODO (Phase 2): Implement draft endpoints + native WebSocket draft room.
# GET  /draft-info/{league_id}   — draft metadata for a league
# GET  /draft-picks/{draft_id}   — all picks for a draft
# WS   /ws/{league_id}           — live draft room (DraftConnectionManager)
