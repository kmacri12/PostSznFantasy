from datetime import datetime

from pydantic import Field

from api.models.base import BaseSchema
from api.models.enums import DraftStatus, DraftType, PickTimeoutAction


class DraftPickResponse(BaseSchema):
    id: int
    draft_id: int
    team_id: int
    player_id: int
    player_name: str | None = None
    position: str | None = None
    team_abv: str | None = None
    # Team QB / team K: this pick's slot scores every QB (K) on his NFL team.
    scores_whole_team: bool = False
    number_round: int
    number_pick_overall: int
    number_pick_in_round: int
    autopick: bool = False


class DraftSlot(BaseSchema):
    slot: int
    team_id: int
    team_name: str
    owner_name: str | None = None


class DraftStateResponse(BaseSchema):
    """Everything a client needs to render the room; the clock fields are authoritative."""

    draft_id: int
    season_id: int
    status: DraftStatus
    start_time: datetime | None = None
    draft_type: DraftType
    rounds: int
    time_per_pick_seconds: int
    pick_timeout_action: PickTimeoutAction
    pick_started_at: datetime | None = None
    current_pick_deadline: datetime | None = None
    paused_remaining_seconds: int | None = None
    server_time: datetime
    order_locked: bool
    order: list[DraftSlot]
    unassigned_team_ids: list[int]
    picks: list[DraftPickResponse]
    total_picks: int
    current_pick_overall: int | None = None
    on_the_clock_team_id: int | None = None
    on_deck_team_id: int | None = None
    # Only the positions a team may not exceed; the room greys those players out.
    position_caps: dict[str, int] = Field(default_factory=dict)
    # First Wild Card kickoff: no draft can be scheduled or started after it.
    draft_cutoff: datetime | None = None
    playoff_field_set: bool = False


class DraftSetup(BaseSchema):
    start_time: datetime | None = None
    clear_start_time: bool = False
    time_per_pick_seconds: int | None = Field(default=None, ge=10, le=86400)
    draft_type: DraftType | None = None
    pick_timeout_action: PickTimeoutAction | None = None


class DraftOrderUpdate(BaseSchema):
    team_ids: list[int | None]


class PickRequest(BaseSchema):
    player_id: int


class QueueUpdate(BaseSchema):
    player_ids: list[int]


class QueueResponse(BaseSchema):
    player_ids: list[int]
