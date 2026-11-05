from api.ws.draft_manager import DraftConnectionManager

# Sockets of members reading a season's feed, apart from the draft room: the feed is
# open all season, the draft room only while drafting.
feed_manager = DraftConnectionManager()


async def announce_feed_change(
    season_id: int, item_type: str, item_id: int | None = None, *, deleted: bool = False
) -> None:
    """Tell open feed sockets to refetch the newest page. The nudge carries no content
    because `isNew` and `canDelete` differ per viewer."""
    await feed_manager.broadcast(
        season_id,
        {
            "eventType": "FEED_CHANGED",
            "data": {"itemType": item_type, "id": item_id, "deleted": deleted},
        },
    )
