from datetime import datetime
from typing import Any

from pydantic import Field, create_model

from api.models.base import BaseSchema
from api.models.enums import (
    ByeWeekHandling,
    DraftStatus,
    FreeAgencyClaimOrder,
    FreeAgencyWindow,
    LeagueRole,
    RosterLock,
    Tiebreaker,
)


class RosterSettings(BaseSchema):
    number_teams: int = Field(default=12, ge=2, le=32)
    roster_total: int = 18
    roster_num_qb: int = 1
    roster_num_rb: int = 2
    roster_num_wr: int = 2
    roster_num_te: int = 1
    roster_num_flex_wr_rb_te: int = 1
    roster_num_flex_wr_rb: int = 0
    roster_num_flex_wr_te: int = 0
    roster_num_flex_qb_wr_rb_te: int = 0
    roster_num_k: int = 1
    roster_num_dst: int = 1
    roster_num_bench: int = 9
    roster_max_qb: int = 2
    roster_max_rb: int = 99
    roster_max_wr: int = 99
    roster_max_te: int = 99
    roster_max_k: int = 2
    roster_max_dst: int = 2


class ScoringSettings(BaseSchema):
    """Defaults mirror Sleeper's standard PPR scoring template."""

    scoring_passing_yard: float = 0.04
    scoring_passing_td: float = 4
    scoring_passing_2pt: float = 2
    scoring_passing_interception: float = -1
    scoring_passing_completion: float = 0
    scoring_passing_attempt: float = 0
    scoring_passing_sack: float = 0
    scoring_passing_bonus_300_yards: float = 0
    scoring_passing_bonus_400_yards: float = 0
    scoring_rushing_yard: float = 0.1
    scoring_rushing_td: float = 6
    scoring_rushing_2pt: float = 2
    scoring_rushing_attempt: float = 0
    scoring_rushing_bonus_100_yards: float = 0
    scoring_rushing_bonus_200_yards: float = 0
    scoring_receiving_reception: float = 1
    scoring_receiving_yard: float = 0.1
    scoring_receiving_td: float = 6
    scoring_receiving_2pt: float = 2
    scoring_receiving_target: float = 0
    scoring_receiving_reception_bonus_rb: float = 0
    scoring_receiving_reception_bonus_wr: float = 0
    scoring_receiving_reception_bonus_te: float = 0
    scoring_receiving_bonus_100_yards: float = 0
    scoring_receiving_bonus_200_yards: float = 0
    scoring_carrying_fumble: float = 0
    scoring_carrying_fumble_lost: float = -2
    scoring_special_punt_return_yard: float = 0
    scoring_special_punt_return_td: float = 6
    scoring_special_kick_return_yard: float = 0
    scoring_special_kick_return_td: float = 6
    scoring_kicking_fg_made: float = 0
    scoring_kicking_fg_miss: float = 0
    scoring_kicking_fg_miss_0_19: float = 0
    scoring_kicking_fg_miss_20_29: float = 0
    scoring_kicking_fg_miss_30_39: float = 0
    scoring_kicking_fg_miss_40_49: float = 0
    scoring_kicking_fg_miss_50_plus: float = 0
    scoring_kicking_fg_made_0_19: float = 3
    scoring_kicking_fg_made_20_29: float = 3
    scoring_kicking_fg_made_30_39: float = 3
    scoring_kicking_fg_made_40_49: float = 4
    scoring_kicking_fg_made_50_plus: float = 5
    scoring_kicking_fg_yard: float = 0
    scoring_kicking_xp_made: float = 1
    scoring_kicking_xp_miss: float = 0
    scoring_dst_td: float = 6
    scoring_dst_pts_allowed_0: float = 10
    scoring_dst_pts_allowed_1_6: float = 7
    scoring_dst_pts_allowed_7_13: float = 4
    scoring_dst_pts_allowed_14_20: float = 1
    scoring_dst_pts_allowed_21_27: float = 0
    scoring_dst_pts_allowed_28_34: float = -1
    scoring_dst_pts_allowed_35_plus: float = -4
    scoring_dst_yards_allowed_under_100: float = 0
    scoring_dst_yards_allowed_100_199: float = 0
    scoring_dst_yards_allowed_200_299: float = 0
    scoring_dst_yards_allowed_300_399: float = 0
    scoring_dst_yards_allowed_400_499: float = 0
    scoring_dst_yards_allowed_500_plus: float = 0
    scoring_dst_sack: float = 1
    scoring_dst_safety: float = 2
    scoring_dst_fumble_recover: float = 2
    scoring_dst_interception: float = 2
    scoring_dst_blocked_kick: float = 0
    scoring_dst_two_point_return: float = 0


class PostseasonSettings(BaseSchema):
    """What makes this different from a regular-season league."""

    allow_join_after_draft_start: bool = False
    free_agency_enabled: bool = False
    free_agency_window: FreeAgencyWindow = FreeAgencyWindow.BETWEEN_ROUNDS
    free_agency_claim_order: FreeAgencyClaimOrder = FreeAgencyClaimOrder.FIRST_COME
    multiplier_wild_card: float = Field(default=1, ge=0, le=10)
    multiplier_divisional: float = Field(default=1, ge=0, le=10)
    multiplier_conference: float = Field(default=1, ge=0, le=10)
    multiplier_super_bowl: float = Field(default=1, ge=0, le=10)
    roster_lock: RosterLock = RosterLock.ROUND_START
    allow_swap_eliminated: bool = True
    tiebreaker: Tiebreaker = Tiebreaker.MOST_PLAYERS_ALIVE
    bye_week_handling: ByeWeekHandling = ByeWeekHandling.ALIVE_NO_SCORE


class LeagueCreate(BaseSchema):
    league_name: str = Field(min_length=1, max_length=100)
    roster_settings: RosterSettings = Field(default_factory=RosterSettings)
    scoring_settings: ScoringSettings = Field(default_factory=ScoringSettings)
    postseason_settings: PostseasonSettings = Field(default_factory=PostseasonSettings)
    draft_start_time: datetime | None = None
    time_per_pick_seconds: int = Field(default=60, ge=10, le=86400)


class LeagueCreateResponse(BaseSchema):
    message: str
    league_id: int | None = None


class LeagueSettingsResponse(RosterSettings, ScoringSettings, PostseasonSettings):
    id: int
    league_id: int


class LeaguesByUser(BaseSchema):
    id: int
    name: str
    season: int
    is_commissioner: bool
    user_team_id: int | None = None


def _all_optional(name: str, *models: type[BaseSchema]) -> type[BaseSchema]:
    fields: dict[str, Any] = {}
    for model in models:
        for field, info in model.model_fields.items():
            annotation: Any = info.annotation
            fields[field] = (annotation | None, None)
    return create_model(name, __base__=BaseSchema, **fields)


# Partial update body: any subset of the roster, scoring and postseason fields.
LeagueSettingsPatch = _all_optional(
    "LeagueSettingsPatch", RosterSettings, ScoringSettings, PostseasonSettings
)


class LeagueUpdate(BaseSchema):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    number_teams: int | None = Field(default=None, ge=2, le=32)


class MemberSummary(BaseSchema):
    user_id: int
    username: str
    role: LeagueRole
    team_id: int | None = None
    team_name: str | None = None


class MemberRoleUpdate(BaseSchema):
    role: LeagueRole


class LeagueOverview(BaseSchema):
    id: int
    name: str
    season: int
    number_teams: int
    open_spots: int
    my_role: LeagueRole
    my_team_id: int | None = None
    draft_status: DraftStatus
    draft_start_time: datetime | None = None
    members: list[MemberSummary]


class Standings(BaseSchema):
    team_id: int
    rank: int
    team_name: str
    owner: str
    players_left: int
    wild_card: float
    divisional: float
    conf_champ: float
    super_bowl: float
    total: float


class TeamSimple(BaseSchema):
    id: int
    name: str
    owner_id: int | None = None
    owner_name: str | None = None
    picks_made: int = 0


class NextGame(BaseSchema):
    opponent_abv: str | None = None
    game_time_epoch: str | None = None
    status: str | None = None


class RosterPlayer(BaseSchema):
    id: int
    name: str
    position: str
    team_abv: str | None = None
    slot: str
    is_active: bool
    next_game: NextGame | None = None


class RosterSlot(BaseSchema):
    slot: str
    player: RosterPlayer | None = None


class TeamDetails(BaseSchema):
    id: int
    name: str
    league_id: int
    owner_name: str | None = None
    can_edit: bool
    can_manage_roster: bool
    roster: list[RosterPlayer]
    slots: list[RosterSlot]


class TeamRename(BaseSchema):
    name: str = Field(min_length=1, max_length=40)


class AddDropRequest(BaseSchema):
    add_player_id: int | None = None
    drop_player_id: int | None = None


class InviteCreate(BaseSchema):
    expires_at: datetime | None = None
    max_uses: int | None = Field(default=None, ge=1)


class InviteResponse(BaseSchema):
    code: str
    league_id: int
    expires_at: datetime | None = None
    max_uses: int | None = None
    uses: int
    revoked: bool


class InvitePreview(BaseSchema):
    code: str
    league_name: str
    season: int
    open_spots: int
    joinable: bool
    reason: str | None = None


class JoinResponse(BaseSchema):
    league_id: int
    team_id: int | None = None
    already_member: bool = False
