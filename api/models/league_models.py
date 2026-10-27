from pydantic import Field

from api.models.base import BaseSchema


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
    scoring_passing_yard: int = 0
    scoring_passing_td: int = 0
    scoring_passing_2pt: int = 0
    scoring_passing_interception: int = 0
    scoring_passing_completion: int = 0
    scoring_passing_attempt: int = 0
    scoring_passing_sack: int = 0
    scoring_rushing_yard: int = 0
    scoring_rushing_td: int = 0
    scoring_rushing_2pt: int = 0
    scoring_rushing_attempt: int = 0
    scoring_receiving_reception: int = 0
    scoring_receiving_yard: int = 0
    scoring_receiving_td: int = 0
    scoring_receiving_2pt: int = 0
    scoring_receiving_target: int = 0
    scoring_receiving_reception_bonus_rb: int = 0
    scoring_receiving_reception_bonus_wr: int = 0
    scoring_receiving_reception_bonus_te: int = 0
    scoring_carrying_fumble: int = 0
    scoring_carrying_fumble_lost: int = 0
    scoring_special_punt_return_yard: int = 0
    scoring_special_punt_return_td: int = 0
    scoring_special_kick_return_yard: int = 0
    scoring_special_kick_return_td: int = 0
    scoring_kicking_fg_made: int = 0
    scoring_kicking_fg_miss: int = 0
    scoring_kicking_fg_made_0_19: int = 0
    scoring_kicking_fg_made_20_29: int = 0
    scoring_kicking_fg_made_30_39: int = 0
    scoring_kicking_fg_made_40_49: int = 0
    scoring_kicking_fg_made_50_plus: int = 0
    scoring_kicking_fg_yard: int = 0
    scoring_kicking_xp_made: int = 0
    scoring_kicking_xp_miss: int = 0
    scoring_dst_td: int = 0
    scoring_dst_pts_allowed_0: int = 0
    scoring_dst_pts_allowed_1_6: int = 0
    scoring_dst_pts_allowed_7_13: int = 0
    scoring_dst_pts_allowed_14_20: int = 0
    scoring_dst_pts_allowed_21_27: int = 0
    scoring_dst_pts_allowed_28_34: int = 0
    scoring_dst_pts_allowed_35_plus: int = 0
    scoring_dst_yards_allowed_under_100: int = 0
    scoring_dst_yards_allowed_100_199: int = 0
    scoring_dst_yards_allowed_200_299: int = 0
    scoring_dst_yards_allowed_300_399: int = 0
    scoring_dst_yards_allowed_400_499: int = 0
    scoring_dst_yards_allowed_500_plus: int = 0
    scoring_dst_sack: int = 0
    scoring_dst_safety: int = 0
    scoring_dst_fumble_recover: int = 0
    scoring_dst_interception: int = 0


class LeagueCreate(BaseSchema):
    league_name: str = Field(min_length=1, max_length=100)
    roster_settings: RosterSettings = Field(default_factory=RosterSettings)
    scoring_settings: ScoringSettings = Field(default_factory=ScoringSettings)


class LeagueCreateResponse(BaseSchema):
    message: str
    league_id: int | None = None


class LeagueSettingsResponse(BaseSchema):
    id: int
    league_id: int
    number_teams: int
    roster_total: int
    roster_num_qb: int
    roster_num_rb: int
    roster_num_wr: int
    roster_num_te: int
    roster_num_flex_wr_rb_te: int
    roster_num_flex_wr_rb: int
    roster_num_flex_wr_te: int
    roster_num_flex_qb_wr_rb_te: int
    roster_num_k: int
    roster_num_dst: int
    roster_num_bench: int
    roster_max_qb: int | None = None
    roster_max_rb: int | None = None
    roster_max_wr: int | None = None
    roster_max_te: int | None = None
    roster_max_k: int | None = None
    roster_max_dst: int | None = None
    scoring_passing_yard: int | None = None
    scoring_passing_td: int | None = None
    scoring_passing_2pt: int | None = None
    scoring_passing_interception: int | None = None
    scoring_passing_completion: int | None = None
    scoring_passing_attempt: int | None = None
    scoring_passing_sack: int | None = None
    scoring_rushing_yard: int | None = None
    scoring_rushing_td: int | None = None
    scoring_rushing_2pt: int | None = None
    scoring_rushing_attempt: int | None = None
    scoring_receiving_reception: int | None = None
    scoring_receiving_yard: int | None = None
    scoring_receiving_td: int | None = None
    scoring_receiving_2pt: int | None = None
    scoring_receiving_target: int | None = None
    scoring_receiving_reception_bonus_rb: int | None = None
    scoring_receiving_reception_bonus_wr: int | None = None
    scoring_receiving_reception_bonus_te: int | None = None
    scoring_carrying_fumble: int | None = None
    scoring_carrying_fumble_lost: int | None = None
    scoring_special_punt_return_yard: int | None = None
    scoring_special_punt_return_td: int | None = None
    scoring_special_kick_return_yard: int | None = None
    scoring_special_kick_return_td: int | None = None
    scoring_kicking_fg_made: int | None = None
    scoring_kicking_fg_miss: int | None = None
    scoring_kicking_fg_made_0_19: int | None = None
    scoring_kicking_fg_made_20_29: int | None = None
    scoring_kicking_fg_made_30_39: int | None = None
    scoring_kicking_fg_made_40_49: int | None = None
    scoring_kicking_fg_made_50_plus: int | None = None
    scoring_kicking_fg_yard: int | None = None
    scoring_kicking_xp_made: int | None = None
    scoring_kicking_xp_miss: int | None = None
    scoring_dst_td: int | None = None
    scoring_dst_pts_allowed_0: int | None = None
    scoring_dst_pts_allowed_1_6: int | None = None
    scoring_dst_pts_allowed_7_13: int | None = None
    scoring_dst_pts_allowed_14_20: int | None = None
    scoring_dst_pts_allowed_21_27: int | None = None
    scoring_dst_pts_allowed_28_34: int | None = None
    scoring_dst_pts_allowed_35_plus: int | None = None
    scoring_dst_yards_allowed_under_100: int | None = None
    scoring_dst_yards_allowed_100_199: int | None = None
    scoring_dst_yards_allowed_200_299: int | None = None
    scoring_dst_yards_allowed_300_399: int | None = None
    scoring_dst_yards_allowed_400_499: int | None = None
    scoring_dst_yards_allowed_500_plus: int | None = None
    scoring_dst_sack: int | None = None
    scoring_dst_safety: int | None = None
    scoring_dst_fumble_recover: int | None = None
    scoring_dst_interception: int | None = None


class LeaguesByUser(BaseSchema):
    id: int
    name: str
    commissioner_id: int
    user_team_id: int


class Standings(BaseSchema):
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
    owner_id: int
    owner_name: str
