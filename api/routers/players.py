from fastapi import APIRouter

router = APIRouter()


@router.get("/")
async def health() -> dict[str, str]:
    return {"status": "healthy"}


# TODO (Phase 2): Implement player endpoints.
# GET /player-list         — position-filtered NFL player directory
# GET /player-season-stats — players joined with season stats
