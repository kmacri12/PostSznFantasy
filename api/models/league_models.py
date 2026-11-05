from datetime import datetime
from enum import StrEnum
from typing import Any

from pydantic import Field, StrictBool, create_model

from api.models.activity_models import ScoreChange, SlotMark
from api.models.base import BaseSchema
from api.models.enums import (
    DraftStatus,
    GameState,
    LeagueRole,
    PlayerRoundStatus,
    TieRule,
)


class RosterSettings(BaseSchema):
    number_teams: int = Field(default=6, ge=2, le=14)
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
    """Defaults are docs/product-rules.md section 5; anything unlisted there is 0."""

    scoring_passing_yard: float = 0.04
    scoring_passing_td: float = 4
    scoring_passing_2pt: float = 2
    scoring_passing_interception: float = -2
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
    scoring_special_kick_return_yard: float = 0
    scoring_kicking_fg_made: float = 0
    scoring_kicking_fg_miss: float = -1
    scoring_kicking_fg_yard: float = 0.1
    scoring_kicking_fg_miss_yard: float = 0
    scoring_kicking_xp_made: float = 1
    scoring_kicking_xp_miss: float = -1
    scoring_dst_td: float = 6
    scoring_dst_pts_allowed_0: float = 7
    scoring_dst_pts_allowed_1_13: float = 5
    scoring_dst_pts_allowed_14_21: float = 3
    scoring_dst_pts_allowed_22_28: float = 1
    scoring_dst_pts_allowed_29_plus: float = 0
    scoring_dst_yards_allowed_under_100: float = 6
    scoring_dst_yards_allowed_100_199: float = 4
    scoring_dst_yards_allowed_200_299: float = 2
    scoring_dst_yards_allowed_300_plus: float = 0
    scoring_dst_sack: float = 1
    scoring_dst_safety: float = 2
    scoring_dst_fumble_recover: float = 1
    scoring_dst_interception: float = 1
    scoring_dst_blocked_kick: float = 1
    scoring_dst_two_point_return: float = 2


class PostseasonSettings(BaseSchema):
    """What makes this different from a regular-season league."""

    allow_join_after_draft_start: bool = True
    multiplier_wild_card: float = Field(default=1, ge=0, le=10)
    multiplier_divisional: float = Field(default=1, ge=0, le=10)
    multiplier_conference: float = Field(default=1, ge=0, le=10)
    multiplier_super_bowl: float = Field(default=1, ge=0, le=10)


class TeamUnitSettings(BaseSchema):
    """Whether a drafted QB (or K) scores his whole NFL team's QBs (or Ks).

    No defaults: the commissioner must choose each explicitly.
    """

    team_qb: StrictBool
    team_k: StrictBool


NOTES_MAX_LENGTH = 5000


class LeagueCreate(BaseSchema):
    league_name: str = Field(min_length=1, max_length=100)
    roster_settings: RosterSettings = Field(default_factory=RosterSettings)
    scoring_settings: ScoringSettings = Field(default_factory=ScoringSettings)
    postseason_settings: PostseasonSettings = Field(default_factory=PostseasonSettings)
    team_unit_settings: TeamUnitSettings
    draft_start_time: datetime | None = None
    time_per_pick_seconds: int = Field(default=90, ge=10, le=86400)


class LeagueCreateResponse(BaseSchema):
    message: str
    league_id: int | None = None
    season_id: int | None = None


class SeasonSettingsResponse(
    RosterSettings, ScoringSettings, PostseasonSettings, TeamUnitSettings
):
    id: int
    season_id: int


class SeasonSummary(BaseSchema):
    id: int
    year: int
    # The Super Bowl is final: the season is a read-only archive.
    finished: bool
    # The league's latest season, whether or not the caller may open it: its pages
    # get the clean URLs without the year.
    current: bool
    draft_status: DraftStatus
    # The caller's team that year; None when they had none.
    my_team_id: int | None = None


class PastLeague(BaseSchema):
    """A league the caller left, with the finished seasons they still may read."""

    id: int
    name: str
    seasons: list[SeasonSummary]


class LeaguesByUser(BaseSchema):
    id: int
    name: str
    # The league's latest season: its id and year.
    season_id: int
    season: int
    is_commissioner: bool
    user_team_id: int | None = None
    # Events in the season feed this member hasn't seen, for the nav dot.
    has_new_activity: bool = False
    # The latest season's Super Bowl is final: it is a read-only archive.
    finished: bool = False
    draft_status: DraftStatus = DraftStatus.UNSCHEDULED
    # Every season of the league, oldest first.
    seasons: list[SeasonSummary] = []


def _all_optional(name: str, *models: type[BaseSchema]) -> type[BaseSchema]:
    fields: dict[str, Any] = {}
    for model in models:
        for field, info in model.model_fields.items():
            annotation: Any = info.annotation
            fields[field] = (annotation | None, None)
    return create_model(name, __base__=BaseSchema, **fields)


# Partial update body: any subset of the roster, scoring, postseason and team unit fields.
SeasonSettingsPatch = _all_optional(
    "SeasonSettingsPatch",
    RosterSettings,
    ScoringSettings,
    PostseasonSettings,
    TeamUnitSettings,
)


class LeagueDelete(BaseSchema):
    """The typed confirmation: the API enforces it, not only the UI."""

    league_name: str


class LeagueUpdate(BaseSchema):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    notes: str | None = Field(default=None, max_length=NOTES_MAX_LENGTH)


class SeasonUpdate(BaseSchema):
    number_teams: int | None = Field(default=None, ge=2, le=14)


class MemberSummary(BaseSchema):
    user_id: int
    username: str
    role: LeagueRole
    team_id: int | None = None
    team_name: str | None = None


class MemberRoleUpdate(BaseSchema):
    role: LeagueRole


class TeamBrief(BaseSchema):
    id: int
    name: str
    owner_user_id: int | None = None
    owner_name: str | None = None


class TeamOwnerUpdate(BaseSchema):
    user_id: int | None = None


class LineupMove(BaseSchema):
    round: int = Field(ge=1, le=4)
    player_id: int
    # None takes the player out of the lineup.
    slot_index: int | None = Field(default=None, ge=0)
    # A commissioner's agreement to change a locked slot or a past round.
    confirm_override: bool = False


class LeagueOverview(BaseSchema):
    """The permanent league: members, notes and its seasons, oldest first."""

    id: int
    name: str
    notes: str
    my_role: LeagueRole
    current_season_id: int
    # The latest season is over, so the commissioner may start the next one.
    can_start_season: bool
    next_year: int
    seasons: list[SeasonSummary]
    members: list[MemberSummary]


class SeasonOverview(BaseSchema):
    """Everything a season's home page needs: teams, draft status and who may edit."""

    id: int
    league_id: int
    league_name: str
    year: int
    finished: bool
    # The season is open and the caller is an active member / a commissioner.
    can_edit: bool
    can_commission: bool
    # The caller left the league and reads this finished season as history.
    is_former_member: bool = False
    number_teams: int
    open_spots: int
    my_role: LeagueRole
    my_team_id: int | None = None
    draft_status: DraftStatus
    draft_start_time: datetime | None = None
    members: list[MemberSummary]
    teams: list[TeamBrief]


class StarterProgress(BaseSchema):
    """A team's starter slots in the current round; the four counts cover every slot."""

    finished: int
    live: int
    to_play: int
    not_playing: int


class StandingTieReason(BaseSchema):
    """Why a fantasy team ranks above the next one although their totals are equal."""

    rule: TieRule
    # 1-based round whose score separated them; None for the Super Bowl winner step.
    round: int | None = None
    over_team_id: int
    over_team_name: str
    ahead_value: float
    behind_value: float
    # The deciding step in words, e.g. "higher Divisional score (20 to 10)".
    detail: str
    # `detail` worded for the team ranked above.
    message: str


class StandingsPhase(StrEnum):
    # No standings snapshot yet: rows are the season's team slots, points are zero.
    PRE_DRAFT = "pre_draft"
    LIVE = "live"


class TeamStanding(BaseSchema):
    team_id: int
    # None before the draft.
    rank: int | None
    team_name: str
    # None for an open slot.
    owner: str | None
    is_commissioner: bool = False
    players_left: int
    wild_card: float
    divisional: float
    conf_champ: float
    super_bowl: float
    total: float
    tie_reason: StandingTieReason | None = None
    progress: StarterProgress


class Standings(BaseSchema):
    phase: StandingsPhase
    # The round the live counts describe (1-4).
    round: int
    # NFL games being played right now.
    games_in_progress: int
    # Games of that round that are over.
    games_final: int = 0
    # Players left summed over every fantasy team in the league.
    players_left: int
    teams: list[TeamStanding]


class BreakdownPlayer(BaseSchema):
    """What a rostered player earned in one round; counted if a starter, else bench."""

    player_id: int
    name: str
    position: str
    team_abv: str | None = None
    # Lineup slot name (QB, FLEX, BENCH ...); None when never placed in a slot.
    slot: str | None = None
    points: float
    # The latest stat correction, in the same (post-multiplier) points as `points`.
    score_change: ScoreChange | None = None


class BreakdownSlot(BaseSchema):
    index: int
    slot: str
    player: BreakdownPlayer | None = None
    # Counted points; 0 for an empty slot.
    points: float
    mark: SlotMark | None = None


class BreakdownRound(BaseSchema):
    round: int
    multiplier: float
    # The round score: equals the sum of the starters' points and the standings value.
    counted: float
    starters: list[BreakdownSlot]
    # Rostered non-starters who played that round, best first. Points shown dimmed.
    bench: list[BreakdownPlayer]
    bench_points: float


class TeamBreakdown(BaseSchema):
    team_id: int
    season_id: int
    team_name: str
    total: float
    points_left_on_bench: float
    rounds: list[BreakdownRound]


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
    is_active: bool
    injury_status: str | None = None
    next_game: NextGame | None = None
    # Team QB / team K: his slot scores every QB (K) on his NFL team.
    scores_whole_team: bool = False


class LineupPlayer(RosterPlayer):
    """A roster player as seen in one round's lineup."""

    status: PlayerRoundStatus
    # Scheduled kickoff of their game that round (None on a bye); the lock time.
    kickoff: datetime | None = None
    locked: bool
    # That round's game: scheduled, live or final; None on a bye or before it is set.
    game_state: GameState | None = None
    # The live game's clock as the upstream reports it; empty between plays.
    game_clock: str | None = None
    # Counted points in that round (league scoring, round multiplier); None before any stats.
    points: float | None = None
    # The round's stats on one line ("14/21, 168 yds, 2 TD, 0 INT"); None before any stats.
    stat_line: str | None = None
    # For an eliminated player: the round his team lost in.
    eliminated_round: int | None = None
    score_change: ScoreChange | None = None


class LineupSlotView(BaseSchema):
    index: int
    slot: str
    player: LineupPlayer | None = None
    mark: SlotMark | None = None


class RoundLineup(BaseSchema):
    round: int
    slots: list[LineupSlotView]
    # Roster players alive or on a bye but not placed in any slot.
    unassigned: list[LineupPlayer]
    # Players whose NFL team lost in an earlier round; never movable.
    eliminated: list[LineupPlayer]
    empty_starter_slots: int
    # Earliest kickoff of any game that round: when owners are warned about gaps.
    first_kickoff: datetime | None = None


class TeamDetails(BaseSchema):
    id: int
    name: str
    season_id: int
    owner_name: str | None = None
    can_edit: bool
    can_set_lineup: bool
    # A commissioner may also move locked players and edit past rounds, after confirming.
    can_override: bool = False
    roster: list[RosterPlayer]
    lineups: list[RoundLineup]


class TeamRename(BaseSchema):
    name: str = Field(min_length=1, max_length=40)


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


class InviteMember(BaseSchema):
    display_name: str
    is_commissioner: bool


class InvitePreview(BaseSchema):
    code: str
    league_name: str
    season: int
    open_spots: int
    full: bool
    members: list[InviteMember]
    joinable: bool
    reason: str | None = None


class JoinResponse(BaseSchema):
    league_id: int
    season_id: int | None = None
    team_id: int | None = None
    already_member: bool = False
