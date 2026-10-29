from datetime import datetime, time
from typing import Any

from api.models.base import BaseSchema


class DraftPickSubmit(BaseSchema):
    draft_id: int
    team_id: int
    player_id: int
    number_round: int
    number_pick_overall: int
    number_pick_in_round: int
    autopick: bool = False


class DraftPickResponse(BaseSchema):
    id: int
    draft_id: int
    team_id: int
    player_id: int
    player_name: str | None = None
    number_round: int
    number_pick_overall: int
    number_pick_in_round: int
    autopick: bool = False


class DraftInfoResponse(BaseSchema):
    id: int
    league_id: int
    status: str | None = None
    start_time: datetime | None = None
    draft_type: str | None = "snake"
    time_per_pick_seconds: int = 60
    slow_draft_auto_pause: bool | None = False
    slow_draft_pause_from: time | None = None
    slow_draft_pause_to: time | None = None
    slow_draft_pause_timezone: str | None = None
    cpu_autopick: bool | None = False
    alphabetical_sort: bool | None = False
    draft_order_team_ids: list[int] | None = None


class DraftStateEvent(BaseSchema):
    event_type: str  # "PICK_MADE", "TIMER_UPDATE", "DRAFT_COMPLETE", etc.
    data: dict[str, Any]
