from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models import ActivityEvent, NFLGame, NFLTeam
from api.db.models.notification import Notification
from api.services.round_recap import post_round_recaps
from api.tests.postgres.factories import make_season


async def _games(db: AsyncSession) -> None:
    """The Wild Card ended Monday Dec 29 2025; the Divisional is Jan 5."""
    db.add_all(
        NFLTeam(id=i, team_abv=abv, team_city=abv, team_name=abv, in_playoffs=True)
        for i, abv in [(1, "KC"), (2, "BUF"), (3, "HOU")]
    )
    await db.flush()
    db.add_all(
        [
            NFLGame(
                id="wc",
                season=2025,
                season_type="post",
                game_week=19,
                game_status="Completed",
                game_time_epoch="1767000000",
                team_id_home=1,
                team_id_away=2,
                home_pts=27,
                away_pts=24,
            ),
            NFLGame(
                id="div",
                season=2025,
                season_type="post",
                game_week=20,
                game_status="Scheduled",
                game_time_epoch="1767600000",
                team_id_home=3,
                team_id_away=1,
            ),
        ]
    )
    await db.flush()


async def test_the_recap_is_posted_once_on_tuesday_morning_with_a_notification(
    db: AsyncSession,
) -> None:
    season, users, _, _ = await make_season(db, draft_status="completed")
    await _games(db)
    monday_night = datetime(2025, 12, 30, 3, tzinfo=UTC)
    tuesday_morning = datetime(2025, 12, 30, 15, tzinfo=UTC)

    assert await post_round_recaps(db, 2025, monday_night) == 0
    assert await post_round_recaps(db, 2025, tuesday_morning) == 1
    assert await post_round_recaps(db, 2025, tuesday_morning) == 0

    events = (
        (
            await db.execute(
                select(ActivityEvent).where(
                    ActivityEvent.season_id == season.id,
                    ActivityEvent.kind == "round_recap",
                )
            )
        )
        .scalars()
        .all()
    )
    assert len(events) == 1 and events[0].payload["round"] == 1
    assert events[0].actor_user_id is None
    inbox = (
        (
            await db.execute(
                select(Notification).where(Notification.kind == "round_recap")
            )
        )
        .scalars()
        .all()
    )
    assert {n.user_id for n in inbox} == {u.id for u in users}
    assert inbox[0].payload == {"seasonId": season.id, "round": 1}
