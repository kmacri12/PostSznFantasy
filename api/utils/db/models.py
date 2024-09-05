from werkzeug.security import generate_password_hash, check_password_hash
from sqlalchemy import (
    Column,
    Integer,
    String,
    Boolean,
    Time,
    ARRAY,
    ForeignKey,
    SmallInteger,
    JSON,
    inspect,
)
from sqlalchemy.orm import relationship
from api.app import db


class User(db.Model):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    username = Column(String(20), unique=True, nullable=False)
    password_hash = Column(String(128), nullable=False)
    email = Column(String(64), unique=True, nullable=False)

    teams_owned = relationship("Team", back_populates="owner", lazy=True)

    def __init__(self, username, password, email):
        self.username = username
        self.set_password(password)
        self.email = email

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def __repr__(self):
        return "<User {}>".format(self.username)


class League(db.Model):
    __tablename__ = "leagues"

    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    commissioner_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    teams = relationship("Team", back_populates="league", lazy=True)
    settings = relationship(
        "LeagueSettings", back_populates="league", uselist=False, lazy=True
    )
    draft = relationship("Draft", back_populates="league", uselist=False, lazy=True)

    def __repr__(self):
        return f"<League(id={self.id}, name={self.name})>"


class Team(db.Model):
    __tablename__ = "teams"

    id = Column(Integer, primary_key=True)
    name = Column(String(20))
    owner_id = Column(Integer, ForeignKey("users.id"))
    league_id = Column(Integer, ForeignKey("leagues.id"))
    roster = Column(ARRAY(Integer))

    owner = relationship("User", back_populates="teams_owned")
    league = relationship("League", back_populates="teams")
    draft_picks = relationship("DraftPick", back_populates="team")

    def __repr__(self):
        return f"<Team(id={self.id}, name={self.name}, owner_id={self.owner_id}, league_id={self.league_id}, roster={self.roster})>"


class LeagueSettings(db.Model):
    __tablename__ = "league_settings"

    id = Column(Integer, primary_key=True)
    league_id = Column(Integer, ForeignKey("leagues.id"), nullable=False)
    number_teams = Column(Integer, nullable=False)
    roster_num_qb = Column(Integer, nullable=False)
    roster_num_rb = Column(Integer, nullable=False)
    roster_num_wr = Column(Integer, nullable=False)
    roster_num_te = Column(Integer, nullable=False)
    roster_num_flex_wr_rb_te = Column(Integer, nullable=False)
    roster_num_flex_wr_rb = Column(Integer, nullable=False)
    roster_num_flex_wr_te = Column(Integer, nullable=False)
    roster_num_flex_qb_wr_rb_te = Column(Integer, nullable=False)
    roster_num_k = Column(Integer, nullable=False)
    roster_num_dst = Column(Integer, nullable=False)
    roster_num_total_size = Column(Integer, nullable=False)
    roster_max_qb = Column(Integer)
    roster_max_rb = Column(Integer)
    roster_max_wr = Column(Integer)
    roster_max_te = Column(Integer)
    roster_max_k = Column(Integer)
    roster_max_dst = Column(Integer)
    scoring_passing_yard = Column(Integer)
    scoring_passing_td = Column(Integer)
    scoring_passing_2pt = Column(Integer)
    scoring_passing_interception = Column(Integer)
    scoring_passing_completion = Column(Integer)
    scoring_passing_attempt = Column(Integer)
    scoring_passing_sack = Column(Integer)
    scoring_rushing_yard = Column(Integer)
    scoring_rushing_td = Column(Integer)
    scoring_rushing_2pt = Column(Integer)
    scoring_rushing_attempt = Column(Integer)
    scoring_receiving_reception = Column(Integer)
    scoring_receiving_yard = Column(Integer)
    scoring_receiving_td = Column(Integer)
    scoring_receiving_2pt = Column(Integer)
    scoring_receiving_target = Column(Integer)
    scoring_receiving_reception_bonus_RB = Column(Integer)
    scoring_receiving_reception_bonus_WR = Column(Integer)
    scoring_receiving_reception_bonus_TE = Column(Integer)
    scoring_carrying_fumble = Column(Integer)
    scoring_carrying_fumble_lost = Column(Integer)
    scoring_special_punt_return_yard = Column(Integer)
    scoring_special_punt_return_td = Column(Integer)
    scoring_special_kick_return_yard = Column(Integer)
    scoring_special_kick_return_td = Column(Integer)
    scoring_kicking_fg_made = Column(Integer)
    scoring_kicking_fg_miss = Column(Integer)
    scoring_kicking_fg_made_0_19 = Column(Integer)
    scoring_kicking_fg_made_20_29 = Column(Integer)
    scoring_kicking_fg_made_30_39 = Column(Integer)
    scoring_kicking_fg_made_40_49 = Column(Integer)
    scoring_kicking_fg_made_50_plus = Column(Integer)
    scoring_kicking_fg_yard = Column(Integer)
    scoring_kicking_xp_made = Column(Integer)
    scoring_kicking_xp_miss = Column(Integer)
    scoring_dst_td = Column(Integer)
    scoring_dst_pts_allowed_0 = Column(Integer)
    scoring_dst_pts_allowed_1_6 = Column(Integer)
    scoring_dst_pts_allowed_7_13 = Column(Integer)
    scoring_dst_pts_allowed_14_20 = Column(Integer)
    scoring_dst_pts_allowed_21_27 = Column(Integer)
    scoring_dst_pts_allowed_28_34 = Column(Integer)
    scoring_dst_pts_allowed_35_plus = Column(Integer)
    scoring_dst_yards_allowed_under_100 = Column(Integer)
    scoring_dst_yards_allowed_100_199 = Column(Integer)
    scoring_dst_yards_allowed_200_299 = Column(Integer)
    scoring_dst_yards_allowed_300_399 = Column(Integer)
    scoring_dst_yards_allowed_400_499 = Column(Integer)
    scoring_dst_yards_allowed_500_plus = Column(Integer)
    scoring_dst_sack = Column(Integer)
    scoring_dst_safety = Column(Integer)
    scoring_dst_fumble_recover = Column(Integer)
    scoring_dst_interception = Column(Integer)

    league = relationship("League", back_populates="settings")


class Draft(db.Model):
    __tablename__ = "drafts"

    id = Column(Integer, primary_key=True)
    league_id = Column(Integer, ForeignKey("leagues.id"), nullable=False)
    status = Column(String(20))
    start_time_epoch = Column(String(255))
    draft_type = Column(String(20))
    time_per_pick_seconds = Column(Integer)
    slow_draft_auto_pause = Column(Boolean)
    slow_draft_pause_from = Column(Time)
    slow_draft_pause_to = Column(Time)
    slow_draft_pause_timezone = Column(String(20))
    cpu_autopick = Column(Boolean)
    alphabetical_sort = Column(Boolean)
    draft_order_team_ids = Column(ARRAY(Integer))

    league = relationship("League", back_populates="draft")
    draft_picks = relationship("DraftPick", back_populates="draft")


class DraftPick(db.Model):
    __tablename__ = "draft_picks"

    id = Column(Integer, primary_key=True)
    draft_id = Column(Integer, ForeignKey("drafts.id"), nullable=False)
    team_id = Column(Integer, ForeignKey("teams.id"), nullable=False)
    player_id = Column(Integer, ForeignKey("nfl_players.id"), nullable=False)
    number_round = Column(Integer)
    number_pick_overall = Column(Integer)
    number_pick_in_round = Column(Integer)
    autopick = Column(Boolean)

    draft = relationship("Draft", back_populates="draft_picks")
    team = relationship("Team", back_populates="draft_picks")
    player = relationship("NFLPlayer", back_populates="draft_picks")


class NFLPlayerSeasonStats(db.Model):
    __tablename__ = "nfl_player_season_stats"

    season = Column(String(255), primary_key=True)
    player_id = Column(Integer, ForeignKey("nfl_players.id"), primary_key=True)
    passing_completions = Column(SmallInteger, default=0)
    passing_attempts = Column(SmallInteger, default=0)
    passing_yards = Column(SmallInteger, default=0)
    passing_touchdowns = Column(SmallInteger, default=0)
    passing_interceptions = Column(SmallInteger, default=0)
    passing_sacked = Column(SmallInteger, default=0)
    passing_sacked_yards = Column(SmallInteger, default=0)
    passing_two_point_conversions = Column(SmallInteger, default=0)
    rushing_carries = Column(SmallInteger, default=0)
    rushing_yards = Column(SmallInteger, default=0)
    rushing_touchdowns = Column(SmallInteger, default=0)
    rushing_long_rush = Column(SmallInteger, default=0)
    rushing_two_point_conversions = Column(SmallInteger, default=0)
    receiving_receptions = Column(SmallInteger, default=0)
    receiving_targets = Column(SmallInteger, default=0)
    receiving_yards = Column(SmallInteger, default=0)
    receiving_touchdowns = Column(SmallInteger, default=0)
    receiving_long_reception = Column(SmallInteger, default=0)
    receiving_two_point_conversions = Column(SmallInteger, default=0)
    carrying_fumbles = Column(SmallInteger, default=0)
    carrying_fumbles_lost = Column(SmallInteger, default=0)
    punt_return_yards = Column(SmallInteger, default=0)
    punt_return_td = Column(SmallInteger, default=0)
    kick_return_yards = Column(SmallInteger, default=0)
    kick_return_td = Column(SmallInteger, default=0)
    kicking_xp_made = Column(SmallInteger, default=0)
    kicking_xp_missed = Column(SmallInteger, default=0)
    kicking_fg_missed = Column(SmallInteger, default=0)
    kicking_fg_yards_made = Column(ARRAY(SmallInteger), default=[])
    dst_yards_allowed = Column(SmallInteger, default=0)
    dst_points_allowed = Column(SmallInteger, default=0)
    dst_sacks = Column(SmallInteger, default=0)
    dst_def_td = Column(SmallInteger, default=0)
    dst_safeties = Column(SmallInteger, default=0)
    dst_fumbles_recovered = Column(SmallInteger, default=0)
    dst_interceptions = Column(SmallInteger, default=0)

    player = relationship("NFLPlayer", back_populates="season_stats")

    @classmethod
    def get_stats_by_positions(cls, session, positions):
        """
        Retrieve all stats for players with positions in the provided list.

        Args:
            session: SQLAlchemy session object.
            positions: List of player positions.

        Returns:
            List of NFLPlayerSeasonStats objects.
        """
        return (
            session.query(cls)
            .join(NFLPlayer)
            .filter(NFLPlayer.position.in_(positions))
            .all()
        )

    def to_dict(self):
        """
        Automatically convert SQLAlchemy object to dictionary by inspecting its columns.
        """
        return {c.key: getattr(self, c.key) for c in inspect(self).mapper.column_attrs}


class NFLPlayerGameStats(db.Model):
    __tablename__ = "nfl_player_game_stats"

    game_id = Column(String(255), primary_key=True)
    player_id = Column(Integer, ForeignKey("nfl_players.id"), primary_key=True)
    passing_completions = Column(SmallInteger, default=0)
    passing_attempts = Column(SmallInteger, default=0)
    passing_yards = Column(SmallInteger, default=0)
    passing_touchdowns = Column(SmallInteger, default=0)
    passing_interceptions = Column(SmallInteger, default=0)
    passing_sacked = Column(SmallInteger, default=0)
    passing_sacked_yards = Column(SmallInteger, default=0)
    passing_two_point_conversions = Column(SmallInteger, default=0)
    rushing_carries = Column(SmallInteger, default=0)
    rushing_yards = Column(SmallInteger, default=0)
    rushing_touchdowns = Column(SmallInteger, default=0)
    rushing_long_rush = Column(SmallInteger, default=0)
    rushing_two_point_conversions = Column(SmallInteger, default=0)
    receiving_receptions = Column(SmallInteger, default=0)
    receiving_targets = Column(SmallInteger, default=0)
    receiving_yards = Column(SmallInteger, default=0)
    receiving_touchdowns = Column(SmallInteger, default=0)
    receiving_long_reception = Column(SmallInteger, default=0)
    receiving_two_point_conversions = Column(SmallInteger, default=0)
    carrying_fumbles = Column(SmallInteger, default=0)
    carrying_fumbles_lost = Column(SmallInteger, default=0)
    punt_return_yards = Column(SmallInteger, default=0)
    punt_return_td = Column(SmallInteger, default=0)
    kick_return_yards = Column(SmallInteger, default=0)
    kick_return_td = Column(SmallInteger, default=0)
    kicking_xp_made = Column(SmallInteger, default=0)
    kicking_xp_missed = Column(SmallInteger, default=0)
    kicking_fg_missed = Column(SmallInteger, default=0)
    kicking_fg_yards_made = Column(ARRAY(SmallInteger), default=[])
    dst_yards_allowed = Column(SmallInteger, default=0)
    dst_points_allowed = Column(SmallInteger, default=0)
    dst_sacks = Column(SmallInteger, default=0)
    dst_def_td = Column(SmallInteger, default=0)
    dst_safeties = Column(SmallInteger, default=0)
    dst_fumbles_recovered = Column(SmallInteger, default=0)
    dst_interceptions = Column(SmallInteger, default=0)

    player = relationship("NFLPlayer", back_populates="game_stats")


class NFLPlayer(db.Model):
    __tablename__ = "nfl_players"

    id = Column(Integer, primary_key=True)
    name = Column(String(255))
    position = Column(String(255))
    espn_headshot_url = Column(String(255))
    jersey_num = Column(String(255))
    birthday = Column(String(255))
    height = Column(String(255))
    weight = Column(String(255))
    exp = Column(String(255))
    team_id = Column(Integer, ForeignKey("nfl_teams.id"))

    team = relationship("NFLTeam", back_populates="player")
    draft_picks = relationship("DraftPick", back_populates="player")
    season_stats = relationship("NFLPlayerSeasonStats", back_populates="player")
    game_stats = relationship("NFLPlayerGameStats", back_populates="player")

    def to_dict(self):
        """
        Automatically convert SQLAlchemy object to dictionary by inspecting its columns.
        """
        return {c.key: getattr(self, c.key) for c in inspect(self).mapper.column_attrs}


class NFLTeam(db.Model):
    __tablename__ = "nfl_teams"

    id = Column(Integer, primary_key=True)
    team_abv = Column(String(255))
    team_city = Column(String(255))
    team_name = Column(String(255))
    team_logo_url = Column(String(255))

    player = relationship("NFLPlayer", back_populates="team")


class NFLGame(db.Model):
    __tablename__ = "nfl_games"

    id = Column(String(255), primary_key=True)
    game_status = Column(String(255))
    game_date = Column(String(255))
    game_time_epoch = Column(String(255))
    game_week = Column(SmallInteger)
    season = Column(SmallInteger)
    espn_link = Column(String(255))
    team_id_home = Column(SmallInteger, ForeignKey("nfl_teams.id"))
    team_id_away = Column(SmallInteger, ForeignKey("nfl_teams.id"))
    home_pts = Column(SmallInteger)
    away_pts = Column(SmallInteger)
    season_type = Column(String(255))
    team_stats = Column(JSON)
    scoring_plays = Column(JSON)
    line_score = Column(JSON)
    player_stats = Column(JSON)
    dst = Column(JSON)
    game_clock = Column(String(255))

    home_team = relationship("NFLTeam", foreign_keys=[team_id_home])
    away_team = relationship("NFLTeam", foreign_keys=[team_id_away])
