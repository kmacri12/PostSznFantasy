from fastapi import APIRouter

router = APIRouter()


@router.get("/")
async def health() -> dict[str, str]:
    return {"status": "healthy"}


# TODO (Phase 2): Implement admin / ingestion endpoints.
# POST /setup/pgdb                    — run DDL setup (dev only)
# POST /update/nfl_players            — trigger NFL roster sync
# POST /update/nfl_players_and_stats  — trigger full stats ingestion
