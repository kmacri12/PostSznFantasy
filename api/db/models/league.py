from decimal import Decimal
from typing import TYPE_CHECKING, Any

from sqlalchemy import (
    ARRAY,
    DECIMAL,
    JSON,
    Boolean,
    ForeignKey,
    Integer,
    String,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from api.db.base import Base

if TYPE_CHECKING:
    from api.db.models.draft import Draft, DraftPick
    from api.db.models.user import User


class League(Base):
    __tablename__ = "leagues"
    __table_args__ = {"schema": "fantasy"}

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    commissioner_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("fantasy.users.id", ondelete="CASCADE"), nullable=False
    )

    commissioner: Mapped["User"] = relationship("User")
    teams: Mapped[list["Team"]] = relationship(
        "Team", back_populates="league", cascade="all, delete-orphan"
    )
    settings: Mapped["LeagueSettings | None"] = relationship(
        "LeagueSettings",
        back_populates="league",
        uselist=False,
        cascade="all, delete-orphan",
    )
    draft: Mapped["Draft | None"] = relationship(
        "Draft",
        back_populates="league",
        uselist=False,
        cascade="all, delete-orphan",
    )
    standings: Mapped[list["LeagueStanding"]] = relationship(
        "LeagueStanding", back_populates="league", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<League(id={self.id}, name={self.name})>"


class Team(Base):
    __tablename__ = "teams"
    __table_args__ = {"schema": "fantasy"}

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str | None] = mapped_column(String(20))
    owner_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("fantasy.users.id", ondelete="SET NULL"), nullable=True
    )
    league_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("fantasy.leagues.id", ondelete="CASCADE"), nullable=False
    )
    roster: Mapped[list[int] | None] = mapped_column(ARRAY(Integer), nullable=True)

    owner: Mapped["User | None"] = relationship("User", back_populates="teams_owned")
    league: Mapped["League"] = relationship("League", back_populates="teams")
    draft_picks: Mapped[list["DraftPick"]] = relationship(
        "DraftPick", back_populates="team", cascade="all, delete-orphan"
    )
    lineups: Mapped[list["Lineup"]] = relationship(
        "Lineup", back_populates="team", cascade="all, delete-orphan"
    )
    standings: Mapped[list["LeagueStanding"]] = relationship(
        "LeagueStanding", back_populates="team", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Team(id={self.id}, name={self.name})>"


class LeagueSettings(Base):
    __tablename__ = "league_settings"
    __table_args__ = {"schema": "fantasy"}

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    league_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("fantasy.leagues.id", ondelete="CASCADE"), nullable=False
    )
    number_teams: Mapped[int] = mapped_column(Integer, nullable=False)
    roster_total: Mapped[int] = mapped_column(Integer, nullable=False)
    roster_num_qb: Mapped[int] = mapped_column(Integer, nullable=False)
    roster_num_rb: Mapped[int] = mapped_column(Integer, nullable=False)
    roster_num_wr: Mapped[int] = mapped_column(Integer, nullable=False)
    roster_num_te: Mapped[int] = mapped_column(Integer, nullable=False)
    roster_num_flex_wr_rb_te: Mapped[int] = mapped_column(Integer, nullable=False)
    roster_num_flex_wr_rb: Mapped[int] = mapped_column(Integer, nullable=False)
    roster_num_flex_wr_te: Mapped[int] = mapped_column(Integer, nullable=False)
    roster_num_flex_qb_wr_rb_te: Mapped[int] = mapped_column(Integer, nullable=False)
    roster_num_k: Mapped[int] = mapped_column(Integer, nullable=False)
    roster_num_dst: Mapped[int] = mapped_column(Integer, nullable=False)
    roster_num_bench: Mapped[int] = mapped_column(Integer, nullable=False)
    roster_max_qb: Mapped[int | None] = mapped_column(Integer, nullable=True)
    roster_max_rb: Mapped[int | None] = mapped_column(Integer, nullable=True)
    roster_max_wr: Mapped[int | None] = mapped_column(Integer, nullable=True)
    roster_max_te: Mapped[int | None] = mapped_column(Integer, nullable=True)
    roster_max_k: Mapped[int | None] = mapped_column(Integer, nullable=True)
    roster_max_dst: Mapped[int | None] = mapped_column(Integer, nullable=True)
    scoring_passing_yard: Mapped[int | None] = mapped_column(Integer, nullable=True)
    scoring_passing_td: Mapped[int | None] = mapped_column(Integer, nullable=True)
    scoring_passing_2pt: Mapped[int | None] = mapped_column(Integer, nullable=True)
    scoring_passing_interception: Mapped[int | None] = mapped_column(
        Integer, nullable=True
    )
    scoring_passing_completion: Mapped[int | None] = mapped_column(
        Integer, nullable=True
    )
    scoring_passing_attempt: Mapped[int | None] = mapped_column(Integer, nullable=True)
    scoring_passing_sack: Mapped[int | None] = mapped_column(Integer, nullable=True)
    scoring_rushing_yard: Mapped[int | None] = mapped_column(Integer, nullable=True)
    scoring_rushing_td: Mapped[int | None] = mapped_column(Integer, nullable=True)
    scoring_rushing_2pt: Mapped[int | None] = mapped_column(Integer, nullable=True)
    scoring_rushing_attempt: Mapped[int | None] = mapped_column(Integer, nullable=True)
    scoring_receiving_reception: Mapped[int | None] = mapped_column(
        Integer, nullable=True
    )
    scoring_receiving_yard: Mapped[int | None] = mapped_column(Integer, nullable=True)
    scoring_receiving_td: Mapped[int | None] = mapped_column(Integer, nullable=True)
    scoring_receiving_2pt: Mapped[int | None] = mapped_column(Integer, nullable=True)
    scoring_receiving_target: Mapped[int | None] = mapped_column(Integer, nullable=True)
    scoring_receiving_reception_bonus_rb: Mapped[int | None] = mapped_column(
        Integer, nullable=True
    )
    scoring_receiving_reception_bonus_wr: Mapped[int | None] = mapped_column(
        Integer, nullable=True
    )
    scoring_receiving_reception_bonus_te: Mapped[int | None] = mapped_column(
        Integer, nullable=True
    )
    scoring_carrying_fumble: Mapped[int | None] = mapped_column(Integer, nullable=True)
    scoring_carrying_fumble_lost: Mapped[int | None] = mapped_column(
        Integer, nullable=True
    )
    scoring_special_punt_return_yard: Mapped[int | None] = mapped_column(
        Integer, nullable=True
    )
    scoring_special_punt_return_td: Mapped[int | None] = mapped_column(
        Integer, nullable=True
    )
    scoring_special_kick_return_yard: Mapped[int | None] = mapped_column(
        Integer, nullable=True
    )
    scoring_special_kick_return_td: Mapped[int | None] = mapped_column(
        Integer, nullable=True
    )
    scoring_kicking_fg_made: Mapped[int | None] = mapped_column(Integer, nullable=True)
    scoring_kicking_fg_miss: Mapped[int | None] = mapped_column(Integer, nullable=True)
    scoring_kicking_fg_made_0_19: Mapped[int | None] = mapped_column(
        Integer, nullable=True
    )
    scoring_kicking_fg_made_20_29: Mapped[int | None] = mapped_column(
        Integer, nullable=True
    )
    scoring_kicking_fg_made_30_39: Mapped[int | None] = mapped_column(
        Integer, nullable=True
    )
    scoring_kicking_fg_made_40_49: Mapped[int | None] = mapped_column(
        Integer, nullable=True
    )
    scoring_kicking_fg_made_50_plus: Mapped[int | None] = mapped_column(
        Integer, nullable=True
    )
    scoring_kicking_fg_yard: Mapped[int | None] = mapped_column(Integer, nullable=True)
    scoring_kicking_xp_made: Mapped[int | None] = mapped_column(Integer, nullable=True)
    scoring_kicking_xp_miss: Mapped[int | None] = mapped_column(Integer, nullable=True)
    scoring_dst_td: Mapped[int | None] = mapped_column(Integer, nullable=True)
    scoring_dst_pts_allowed_0: Mapped[int | None] = mapped_column(
        Integer, nullable=True
    )
    scoring_dst_pts_allowed_1_6: Mapped[int | None] = mapped_column(
        Integer, nullable=True
    )
    scoring_dst_pts_allowed_7_13: Mapped[int | None] = mapped_column(
        Integer, nullable=True
    )
    scoring_dst_pts_allowed_14_20: Mapped[int | None] = mapped_column(
        Integer, nullable=True
    )
    scoring_dst_pts_allowed_21_27: Mapped[int | None] = mapped_column(
        Integer, nullable=True
    )
    scoring_dst_pts_allowed_28_34: Mapped[int | None] = mapped_column(
        Integer, nullable=True
    )
    scoring_dst_pts_allowed_35_plus: Mapped[int | None] = mapped_column(
        Integer, nullable=True
    )
    scoring_dst_yards_allowed_under_100: Mapped[int | None] = mapped_column(
        Integer, nullable=True
    )
    scoring_dst_yards_allowed_100_199: Mapped[int | None] = mapped_column(
        Integer, nullable=True
    )
    scoring_dst_yards_allowed_200_299: Mapped[int | None] = mapped_column(
        Integer, nullable=True
    )
    scoring_dst_yards_allowed_300_399: Mapped[int | None] = mapped_column(
        Integer, nullable=True
    )
    scoring_dst_yards_allowed_400_499: Mapped[int | None] = mapped_column(
        Integer, nullable=True
    )
    scoring_dst_yards_allowed_500_plus: Mapped[int | None] = mapped_column(
        Integer, nullable=True
    )
    scoring_dst_sack: Mapped[int | None] = mapped_column(Integer, nullable=True)
    scoring_dst_safety: Mapped[int | None] = mapped_column(Integer, nullable=True)
    scoring_dst_fumble_recover: Mapped[int | None] = mapped_column(
        Integer, nullable=True
    )
    scoring_dst_interception: Mapped[int | None] = mapped_column(Integer, nullable=True)

    league: Mapped["League"] = relationship("League", back_populates="settings")


class Week(Base):
    __tablename__ = "weeks"
    __table_args__ = {"schema": "fantasy"}

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    week_name: Mapped[str] = mapped_column(String(50), nullable=False)

    lineups: Mapped[list["Lineup"]] = relationship("Lineup", back_populates="week")


class Lineup(Base):
    __tablename__ = "lineups"
    __table_args__ = {"schema": "fantasy"}

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    team_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("fantasy.teams.id", ondelete="CASCADE"), nullable=False
    )
    week_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("fantasy.weeks.id", ondelete="CASCADE"), nullable=False
    )
    lineup: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    locked: Mapped[bool] = mapped_column(Boolean, default=False)

    team: Mapped["Team"] = relationship("Team", back_populates="lineups")
    week: Mapped["Week"] = relationship("Week", back_populates="lineups")
    player_scores: Mapped[list["PlayerScore"]] = relationship(
        "PlayerScore", back_populates="lineup", cascade="all, delete-orphan"
    )


class PlayerScore(Base):
    __tablename__ = "player_scores"
    __table_args__ = {"schema": "fantasy"}

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    lineup_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("fantasy.lineups.id", ondelete="CASCADE"), nullable=False
    )
    player_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    points: Mapped[Decimal] = mapped_column(DECIMAL(10, 2), nullable=False)

    lineup: Mapped["Lineup"] = relationship("Lineup", back_populates="player_scores")


class LeagueStanding(Base):
    __tablename__ = "standings"
    __table_args__ = {"schema": "fantasy"}

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    league_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("fantasy.leagues.id", ondelete="CASCADE"), nullable=False
    )
    team_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("fantasy.teams.id", ondelete="CASCADE"), nullable=False
    )
    rank: Mapped[int] = mapped_column(Integer, nullable=False)
    players_left: Mapped[int | None] = mapped_column(Integer, nullable=True)
    wild_card: Mapped[int | None] = mapped_column(Integer, nullable=True)
    divisional: Mapped[int | None] = mapped_column(Integer, nullable=True)
    conf_champ: Mapped[int | None] = mapped_column(Integer, nullable=True)
    super_bowl: Mapped[int | None] = mapped_column(Integer, nullable=True)
    total: Mapped[Decimal | None] = mapped_column(DECIMAL(10, 2), nullable=True)

    league: Mapped["League"] = relationship("League", back_populates="standings")
    team: Mapped["Team"] = relationship("Team", back_populates="standings")


# Compatibility alias
Standings = LeagueStanding
