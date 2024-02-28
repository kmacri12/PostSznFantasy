from werkzeug.security import generate_password_hash, check_password_hash
from sqlalchemy import Column, Integer, String, Boolean, Time, ARRAY, ForeignKey
from sqlalchemy.orm import relationship
from api.app import db

class User(db.Model):
    __tablename__ = 'users'

    id = Column(Integer, primary_key=True)
    username = Column(String(20), unique=True, nullable=False)
    password_hash = Column(String(128), nullable=False)
    email = Column(String(64), unique=True, nullable=False)

    def __init__(self, username, password, email):
        self.username = username
        self.set_password(password)
        self.email = email

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def __repr__(self):
        return '<User {}>'.format(self.username)

class League(db.Model):
    __tablename__ = 'leagues'

    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    commissioner_id = Column(Integer, ForeignKey('users.id'), nullable=False)

    
    teams = relationship('Team', backref='league', lazy=True)
    settings = relationship('LeagueSettings', backref='league', uselist=False, lazy=True)
    draft = relationship('Draft', backref='league', uselist=False, lazy=True)

    def __repr__(self):
        return f"<League(id={self.id}, name={self.name})>"
    
class Team(db.Model):
    __tablename__ = 'teams'

    id = Column(Integer, primary_key=True)
    name = Column(String(20))
    owner_id = Column(Integer, ForeignKey('users.id'))
    league_id = Column(Integer, ForeignKey('leagues.id'))
    roster = Column(ARRAY(Integer))

    owner = relationship("User", back_populates="teams")
    league = relationship("League", back_populates="teams")

    def __repr__(self):
        return f"<Team(id={self.id}, name={self.name}, owner_id={self.owner_id}, league_id={self.league_id}, roster={self.roster})>"

class LeagueSettings(db.Model):
    __tablename__ = 'league_settings'

    id = Column(Integer, primary_key=True)
    league_id = Column(Integer, ForeignKey('leagues.id'), nullable=False)
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

    league = relationship('League', backref='settings')

class Draft(db.Model):
    __tablename__ = 'drafts'

    id = Column(Integer, primary_key=True)
    league_id = Column(Integer, ForeignKey('leagues.id'), nullable=False)
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

    league = relationship('League', backref='drafts')

class DraftPick(db.Model):
    __tablename__ = 'draft_picks'

    id = Column(Integer, primary_key=True)
    draft_id = Column(Integer, ForeignKey('drafts.id'), nullable=False)
    team_id = Column(Integer, ForeignKey('teams.id'), nullable=False)
    player_id = Column(Integer, ForeignKey('nfl_players.id'), nullable=False)
    number_round = Column(Integer)
    number_pick_overall = Column(Integer)
    number_pick_in_round = Column(Integer)
    autopick = Column(Boolean)

    draft = relationship('Draft', backref='draft_picks')
    team = relationship('Team', backref='draft_picks')
    player = relationship('NFLPlayer', backref='draft_picks')