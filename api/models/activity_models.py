from datetime import datetime
from typing import Any, ClassVar, Literal

from api.models.base import BaseSchema
from api.models.enums import ActivityKind


class DisplacedPlayer(BaseSchema):
    player_id: int
    player_name: str
    to_slot: str | None


class LineupMovePayload(BaseSchema):
    """One player placed, moved or taken out of a round's lineup."""

    kind: ClassVar[ActivityKind] = ActivityKind.LINEUP_MOVE

    round: int
    player_id: int
    player_name: str
    # Slot labels from the league's layout (QB, FLEX, BENCH...); None is outside it.
    from_slot: str | None
    to_slot: str | None
    displaced: DisplacedPlayer | None = None
    # Every slot index whose occupant changed; slot markers derive from these.
    changed_slots: list[int]
    # A commissioner editing a team they don't own.
    by_commissioner: bool = False


class CommissionerOverridePayload(LineupMovePayload):
    """A lineup move an owner could not make, so the league is told prominently."""

    kind: ClassVar[ActivityKind] = ActivityKind.COMMISSIONER_OVERRIDE

    by_commissioner: bool = True


class StatCorrectionPayload(BaseSchema):
    """A finished game's stats changed this player's score under the league's rules."""

    kind: ClassVar[ActivityKind] = ActivityKind.STAT_CORRECTION

    round: int
    game_id: str
    player_id: int
    player_name: str
    previous_points: float
    new_points: float


class SettingChange(BaseSchema):
    field: str
    before: Any
    after: Any


class SettingsChangePayload(BaseSchema):
    kind: ClassVar[ActivityKind] = ActivityKind.SETTINGS_CHANGE

    changes: list[SettingChange]


ActivityPayload = (
    LineupMovePayload
    | CommissionerOverridePayload
    | StatCorrectionPayload
    | SettingsChangePayload
)


class ActivityEventOut(BaseSchema):
    id: int
    kind: ActivityKind
    created_at: datetime
    team_id: int | None
    team_name: str | None
    actor_user_id: int | None
    actor_name: str | None
    payload: dict[str, Any]
    # Newer than the viewer last looked, and not their own doing.
    is_new: bool


class ActivityFeed(BaseSchema):
    events: list[ActivityEventOut]
    # Pass as `before` for the next older page; None on the last page.
    next_before: int | None
    # Any new activity in the whole feed, not just this page.
    has_new: bool


class ActivityViewed(BaseSchema):
    # The newest event the viewer was shown; omitted means everything so far.
    up_to_event_id: int | None = None


class SlotMark(BaseSchema):
    """What a commissioner did to a slot, shown on the lineup next to it."""

    kind: Literal["override", "commissioner_set"]
    actor_name: str | None
    at: datetime


class ScoreChange(BaseSchema):
    """The latest stat correction to a player's score in a round."""

    previous_points: float
    new_points: float
    changed_at: datetime
