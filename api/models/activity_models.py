from datetime import datetime
from typing import Any, ClassVar, Literal

from api.models.base import BaseSchema
from api.models.enums import ActivityKind, LeagueRole


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


class LeagueCreatedPayload(BaseSchema):
    kind: ClassVar[ActivityKind] = ActivityKind.LEAGUE_CREATED

    league_name: str


class MembershipJoinedPayload(BaseSchema):
    """The actor joined the league (or created it) and took a team, if one was open."""

    kind: ClassVar[ActivityKind] = ActivityKind.MEMBERSHIP_JOINED

    role: LeagueRole
    team_name: str | None


class MembershipLeftPayload(BaseSchema):
    """`user_name` left; the actor is that member or the commissioner who removed them."""

    kind: ClassVar[ActivityKind] = ActivityKind.MEMBERSHIP_LEFT

    user_id: int
    user_name: str


class RoleChangedPayload(BaseSchema):
    """`user_name` now has `role`, set by the actor."""

    kind: ClassVar[ActivityKind] = ActivityKind.ROLE_CHANGED

    user_id: int
    user_name: str
    role: LeagueRole


class DraftOrderSlot(BaseSchema):
    position: int
    team_id: int
    team_name: str


class DraftOrderRandomizedPayload(BaseSchema):
    """The commissioner shuffled the draft order; `order` is the result, first pick first."""

    kind: ClassVar[ActivityKind] = ActivityKind.DRAFT_ORDER_RANDOMIZED

    order: list[DraftOrderSlot]


class DraftOrderMove(BaseSchema):
    """One team's slot before and after a manual change; None is no slot."""

    team_id: int
    team_name: str
    from_position: int | None
    to_position: int | None


class DraftOrderChangedPayload(BaseSchema):
    """The commissioner changed the order by hand; `moves` lists every team whose slot
    differs, positions counted from 1."""

    kind: ClassVar[ActivityKind] = ActivityKind.DRAFT_ORDER_CHANGED

    moves: list[DraftOrderMove]


class DraftStartedPayload(BaseSchema):
    kind: ClassVar[ActivityKind] = ActivityKind.DRAFT_STARTED

    team_count: int
    rounds: int


class DraftCompletedPayload(BaseSchema):
    """The last pick was made; the system's doing, so the event has no actor."""

    kind: ClassVar[ActivityKind] = ActivityKind.DRAFT_COMPLETED

    picks: int


class DraftPickAssignedPayload(BaseSchema):
    """A commissioner placed a player at a pick by hand: on the clock now, reserved for a
    later slot, or replacing a pick already made (`replaced_player_name`)."""

    kind: ClassVar[ActivityKind] = ActivityKind.DRAFT_PICK_ASSIGNED

    pick_number: int
    team_name: str
    player_id: int
    player_name: str
    scheduled: bool = False
    replaced_player_name: str | None = None


class DraftTimeSetPayload(BaseSchema):
    """The commissioner scheduled, moved or cleared the draft time (`start_time` None)."""

    kind: ClassVar[ActivityKind] = ActivityKind.DRAFT_TIME_SET

    start_time: datetime | None
    previous_start_time: datetime | None


class AnnouncementPayload(BaseSchema):
    """The commissioner pinned an announcement on the league home."""

    kind: ClassVar[ActivityKind] = ActivityKind.ANNOUNCEMENT

    body: str


ActivityPayload = (
    LineupMovePayload
    | CommissionerOverridePayload
    | StatCorrectionPayload
    | SettingsChangePayload
    | LeagueCreatedPayload
    | MembershipJoinedPayload
    | MembershipLeftPayload
    | RoleChangedPayload
    | DraftOrderRandomizedPayload
    | DraftOrderChangedPayload
    | DraftStartedPayload
    | DraftCompletedPayload
    | DraftPickAssignedPayload
    | DraftTimeSetPayload
    | AnnouncementPayload
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
