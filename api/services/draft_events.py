from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models.draft import Draft
from api.models.draft_models import DraftPickResponse
from api.services import draft_flow
from api.services.draft_picks import PickResult


async def state_event(db: AsyncSession, draft: Draft) -> dict[str, Any]:
    state = await draft_flow.build_state(db, draft)
    return {"eventType": "DRAFT_STATE", "data": state.model_dump(mode="json")}


async def pick_events(
    db: AsyncSession, draft: Draft, result: PickResult
) -> list[dict[str, Any]]:
    """The broadcast pair for a recorded pick: the pick itself, then the new clock state."""
    pick = result.pick
    response = DraftPickResponse(
        id=pick.id,
        draft_id=pick.draft_id,
        team_id=pick.team_id,
        player_id=pick.player_id,
        player_name=result.player_name,
        number_round=pick.number_round,
        number_pick_overall=pick.number_pick_overall,
        number_pick_in_round=pick.number_pick_in_round,
        autopick=pick.autopick,
    )
    events: list[dict[str, Any]] = [
        {"eventType": "PICK_MADE", "data": response.model_dump(mode="json")},
        await state_event(db, draft),
    ]
    if result.draft_complete:
        events.append({"eventType": "DRAFT_COMPLETE"})
    return events
