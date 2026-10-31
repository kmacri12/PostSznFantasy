from datetime import datetime

from api.models.base import BaseSchema
from api.models.enums import PlayerPosition


class NFLTeamSimple(BaseSchema):
    id: int
    team_abv: str | None = None
    team_city: str | None = None
    team_name: str | None = None
    team_logo_url: str | None = None


class Player(BaseSchema):
    id: int
    name: str
    position: PlayerPosition | str
    team_abv: str | None = None
    espn_headshot_url: str | None = None
    jersey_num: str | None = None
    birthday: str | None = None
    height: str | None = None
    weight: str | None = None
    exp: str | None = None
    team_id: int | None = None
    team: NFLTeamSimple | None = None
    eliminated: bool = False
    injury_status: str | None = None
    # Team QB / team K: his slot scores every QB (K) on his NFL team.
    scores_whole_team: bool = False


class PlayerSeasonStatsResponse(BaseSchema):
    season: str
    player_id: int
    player: Player | None = None
    fantasy_points: float | None = None
    kicking_fg_made: int = 0
    passing_completions: int = 0
    passing_attempts: int = 0
    passing_yards: int = 0
    passing_touchdowns: int = 0
    passing_interceptions: int = 0
    passing_sacked: int = 0
    passing_sacked_yards: int = 0
    passing_two_point_conversions: int = 0
    rushing_carries: int = 0
    rushing_yards: int = 0
    rushing_touchdowns: int = 0
    rushing_long_rush: int = 0
    rushing_two_point_conversions: int = 0
    receiving_receptions: int = 0
    receiving_targets: int = 0
    receiving_yards: int = 0
    receiving_touchdowns: int = 0
    receiving_long_reception: int = 0
    receiving_two_point_conversions: int = 0
    carrying_fumbles: int = 0
    carrying_fumbles_lost: int = 0
    punt_return_yards: int = 0
    punt_return_td: int = 0
    kick_return_yards: int = 0
    kick_return_td: int = 0
    kicking_xp_made: int = 0
    kicking_xp_missed: int = 0
    kicking_fg_missed: int = 0
    kicking_fg_yards_made: list[int] = []
    kicking_fg_yards_missed: list[int] = []
    dst_blocked_punts: int = 0
    dst_blocked_field_goals: int = 0
    dst_blocked_extra_points: int = 0
    dst_two_point_returns: int = 0
    dst_yards_allowed: int = 0
    dst_points_allowed: int = 0
    dst_sacks: int = 0
    dst_def_td: int = 0
    dst_safeties: int = 0
    dst_fumbles_recovered: int = 0
    dst_interceptions: int = 0


class IngestionStatusResponse(BaseSchema):
    kind: str
    last_synced_at: datetime
    budget_exhausted: bool = False
