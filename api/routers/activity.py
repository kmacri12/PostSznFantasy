from typing import Annotated

from fastapi import APIRouter, Query, Response, status

from api.db.session import DbSession
from api.dependencies.league import SeasonMember, TeamMember
from api.models.activity_models import ActivityFeed, ActivityViewed
from api.services import activity

router = APIRouter()

PageSize = Annotated[int, Query(ge=1, le=activity.MAX_PAGE_SIZE)]
Before = Annotated[int | None, Query(description="Return events older than this id")]


@router.get("/seasons/{season_id}/activity", response_model=ActivityFeed)
async def league_feed(
    season_id: int,
    membership: SeasonMember,
    db: DbSession,
    limit: PageSize = activity.DEFAULT_PAGE_SIZE,
    before: Before = None,
) -> ActivityFeed:
    """Everything that happened in the season, newest first; members only."""
    return await activity.feed(
        db, membership.user.id, season_id, limit=limit, before=before
    )


@router.get("/teams/{team_id}/activity", response_model=ActivityFeed)
async def team_feed(
    team_id: int,
    membership: TeamMember,
    db: DbSession,
    limit: PageSize = activity.DEFAULT_PAGE_SIZE,
    before: Before = None,
) -> ActivityFeed:
    """What happened to one fantasy team, newest first; league members only."""
    return await activity.feed(
        db,
        membership.user.id,
        membership.season.id,
        team_id=team_id,
        limit=limit,
        before=before,
    )


@router.post(
    "/seasons/{season_id}/activity/viewed", status_code=status.HTTP_204_NO_CONTENT
)
async def league_feed_viewed(
    season_id: int,
    membership: SeasonMember,
    db: DbSession,
    body: ActivityViewed | None = None,
) -> Response:
    """The member expanded the season feed: clear its new-activity dot."""
    await activity.mark_viewed(
        db,
        membership.user.id,
        season_id,
        up_to=body.up_to_event_id if body else None,
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/teams/{team_id}/activity/viewed", status_code=status.HTTP_204_NO_CONTENT)
async def team_feed_viewed(
    team_id: int,
    membership: TeamMember,
    db: DbSession,
    body: ActivityViewed | None = None,
) -> Response:
    """The member expanded a team's feed: clear its new-activity dot."""
    await activity.mark_viewed(
        db,
        membership.user.id,
        membership.season.id,
        team_id=team_id,
        up_to=body.up_to_event_id if body else None,
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
