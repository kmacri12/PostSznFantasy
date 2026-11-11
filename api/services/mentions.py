"""@mentions (#396): tell the members a chat message tagged.

A mention goes through `notifications.notify`, so it lands in the inbox and pushes on the
member's own `push_mentions` choice, whatever they set for chat or the league's mute.
Like every chat push the text never leaves the Feed: the notification names the author
and the league only.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models.activity import LeagueMessage
from api.db.models.league import League
from api.services import notifications, push
from api.services.live_leagues import live_season_ids


async def notify_mentioned(
    db: AsyncSession, message_id: int, user_ids: list[int]
) -> None:
    if not user_ids:
        return
    row = (
        await db.execute(
            select(
                LeagueMessage.league_id,
                LeagueMessage.season_id,
                LeagueMessage.author_name,
                League.name,
            )
            .join(League, League.id == LeagueMessage.league_id)
            .where(
                LeagueMessage.id == message_id,
                LeagueMessage.deleted_at.is_(None),
                LeagueMessage.season_id.in_(live_season_ids()),
            )
        )
    ).one_or_none()
    if row is None:
        return
    await notifications.notify(
        db,
        user_ids,
        notifications.Notice(
            kind="mention",
            league_id=row.league_id,
            payload={"seasonId": row.season_id, "messageId": message_id},
            push=push.PushMessage(
                title=row.name,
                body=f"{row.author_name or 'Someone'} mentioned you in the chat.",
                url=f"/leagues/{row.league_id}/feed",
                tag=f"mention-{message_id}",
            ),
        ),
    )
