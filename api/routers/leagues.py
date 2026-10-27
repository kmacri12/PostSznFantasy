from fastapi import APIRouter

router = APIRouter()


@router.get("/")
async def health() -> dict[str, str]:
    return {"status": "healthy"}


# TODO (Phase 2): Implement league CRUD endpoints.
# POST   /           — create league (LeagueCreate schema, auth required)
# GET    /           — list leagues for authenticated user
# GET    /{league_id}/standings — playoff standings per team
# GET    /{league_id}/teams     — teams in league
# GET    /{league_id}/settings  — league scoring & roster settings
