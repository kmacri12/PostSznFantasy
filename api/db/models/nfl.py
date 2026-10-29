from typing import TYPE_CHECKING, Any

from sqlalchemy import (
    ARRAY,
    JSON,
    Boolean,
    ForeignKey,
    Integer,
    SmallInteger,
    String,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from api.db.base import Base

if TYPE_CHECKING:
    from api.db.models.draft import DraftPick


class NFLTeam(Base):
    __tablename__ = "nfl_teams"
    __table_args__ = {"schema": "nfl"}

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    team_abv: Mapped[str | None] = mapped_column(String(255), nullable=True)
    team_city: Mapped[str | None] = mapped_column(String(255), nullable=True)
    team_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    team_logo_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )

    players: Mapped[list["NFLPlayer"]] = relationship(
        "NFLPlayer", back_populates="team"
    )


class NFLPlayer(Base):
    __tablename__ = "nfl_players"
    __table_args__ = {"schema": "nfl"}

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    position: Mapped[str | None] = mapped_column(String(255), nullable=True)
    espn_headshot_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
    jersey_num: Mapped[str | None] = mapped_column(String(255), nullable=True)
    birthday: Mapped[str | None] = mapped_column(String(255), nullable=True)
    height: Mapped[str | None] = mapped_column(String(255), nullable=True)
    weight: Mapped[str | None] = mapped_column(String(255), nullable=True)
    exp: Mapped[str | None] = mapped_column(String(255), nullable=True)
    team_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("nfl.nfl_teams.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    team: Mapped["NFLTeam | None"] = relationship("NFLTeam", back_populates="players")
    draft_picks: Mapped[list["DraftPick"]] = relationship(
        "DraftPick", back_populates="player", cascade="all, delete-orphan"
    )
    season_stats: Mapped[list["NFLPlayerSeasonStats"]] = relationship(
        "NFLPlayerSeasonStats", back_populates="player", cascade="all, delete-orphan"
    )
    game_stats: Mapped[list["NFLPlayerGameStats"]] = relationship(
        "NFLPlayerGameStats", back_populates="player", cascade="all, delete-orphan"
    )


class NFLPlayerSeasonStats(Base):
    __tablename__ = "nfl_player_season_stats"
    __table_args__ = {"schema": "nfl"}

    season: Mapped[str] = mapped_column(String(255), primary_key=True)
    player_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("nfl.nfl_players.id", ondelete="CASCADE"), primary_key=True
    )
    passing_completions: Mapped[int] = mapped_column(SmallInteger, default=0)
    passing_attempts: Mapped[int] = mapped_column(SmallInteger, default=0)
    passing_yards: Mapped[int] = mapped_column(SmallInteger, default=0)
    passing_touchdowns: Mapped[int] = mapped_column(SmallInteger, default=0)
    passing_interceptions: Mapped[int] = mapped_column(SmallInteger, default=0)
    passing_sacked: Mapped[int] = mapped_column(SmallInteger, default=0)
    passing_sacked_yards: Mapped[int] = mapped_column(SmallInteger, default=0)
    passing_two_point_conversions: Mapped[int] = mapped_column(SmallInteger, default=0)
    rushing_carries: Mapped[int] = mapped_column(SmallInteger, default=0)
    rushing_yards: Mapped[int] = mapped_column(SmallInteger, default=0)
    rushing_touchdowns: Mapped[int] = mapped_column(SmallInteger, default=0)
    rushing_long_rush: Mapped[int] = mapped_column(SmallInteger, default=0)
    rushing_two_point_conversions: Mapped[int] = mapped_column(SmallInteger, default=0)
    receiving_receptions: Mapped[int] = mapped_column(SmallInteger, default=0)
    receiving_targets: Mapped[int] = mapped_column(SmallInteger, default=0)
    receiving_yards: Mapped[int] = mapped_column(SmallInteger, default=0)
    receiving_touchdowns: Mapped[int] = mapped_column(SmallInteger, default=0)
    receiving_long_reception: Mapped[int] = mapped_column(SmallInteger, default=0)
    receiving_two_point_conversions: Mapped[int] = mapped_column(
        SmallInteger, default=0
    )
    carrying_fumbles: Mapped[int] = mapped_column(SmallInteger, default=0)
    carrying_fumbles_lost: Mapped[int] = mapped_column(SmallInteger, default=0)
    punt_return_yards: Mapped[int] = mapped_column(SmallInteger, default=0)
    punt_return_td: Mapped[int] = mapped_column(SmallInteger, default=0)
    kick_return_yards: Mapped[int] = mapped_column(SmallInteger, default=0)
    kick_return_td: Mapped[int] = mapped_column(SmallInteger, default=0)
    kicking_xp_made: Mapped[int] = mapped_column(SmallInteger, default=0)
    kicking_xp_missed: Mapped[int] = mapped_column(SmallInteger, default=0)
    kicking_fg_missed: Mapped[int] = mapped_column(SmallInteger, default=0)
    kicking_fg_yards_made: Mapped[list[int]] = mapped_column(
        ARRAY(SmallInteger), default=list
    )
    dst_yards_allowed: Mapped[int] = mapped_column(SmallInteger, default=0)
    dst_points_allowed: Mapped[int] = mapped_column(SmallInteger, default=0)
    dst_sacks: Mapped[int] = mapped_column(SmallInteger, default=0)
    dst_def_td: Mapped[int] = mapped_column(SmallInteger, default=0)
    dst_safeties: Mapped[int] = mapped_column(SmallInteger, default=0)
    dst_fumbles_recovered: Mapped[int] = mapped_column(SmallInteger, default=0)
    dst_interceptions: Mapped[int] = mapped_column(SmallInteger, default=0)

    player: Mapped["NFLPlayer"] = relationship(
        "NFLPlayer", back_populates="season_stats"
    )


class NFLPlayerGameStats(Base):
    __tablename__ = "nfl_player_game_stats"
    __table_args__ = {"schema": "nfl"}

    game_id: Mapped[str] = mapped_column(String(255), primary_key=True)
    player_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("nfl.nfl_players.id", ondelete="CASCADE"), primary_key=True
    )
    passing_completions: Mapped[int] = mapped_column(SmallInteger, default=0)
    passing_attempts: Mapped[int] = mapped_column(SmallInteger, default=0)
    passing_yards: Mapped[int] = mapped_column(SmallInteger, default=0)
    passing_touchdowns: Mapped[int] = mapped_column(SmallInteger, default=0)
    passing_interceptions: Mapped[int] = mapped_column(SmallInteger, default=0)
    passing_sacked: Mapped[int] = mapped_column(SmallInteger, default=0)
    passing_sacked_yards: Mapped[int] = mapped_column(SmallInteger, default=0)
    passing_two_point_conversions: Mapped[int] = mapped_column(SmallInteger, default=0)
    rushing_carries: Mapped[int] = mapped_column(SmallInteger, default=0)
    rushing_yards: Mapped[int] = mapped_column(SmallInteger, default=0)
    rushing_touchdowns: Mapped[int] = mapped_column(SmallInteger, default=0)
    rushing_long_rush: Mapped[int] = mapped_column(SmallInteger, default=0)
    rushing_two_point_conversions: Mapped[int] = mapped_column(SmallInteger, default=0)
    receiving_receptions: Mapped[int] = mapped_column(SmallInteger, default=0)
    receiving_targets: Mapped[int] = mapped_column(SmallInteger, default=0)
    receiving_yards: Mapped[int] = mapped_column(SmallInteger, default=0)
    receiving_touchdowns: Mapped[int] = mapped_column(SmallInteger, default=0)
    receiving_long_reception: Mapped[int] = mapped_column(SmallInteger, default=0)
    receiving_two_point_conversions: Mapped[int] = mapped_column(
        SmallInteger, default=0
    )
    carrying_fumbles: Mapped[int] = mapped_column(SmallInteger, default=0)
    carrying_fumbles_lost: Mapped[int] = mapped_column(SmallInteger, default=0)
    punt_return_yards: Mapped[int] = mapped_column(SmallInteger, default=0)
    punt_return_td: Mapped[int] = mapped_column(SmallInteger, default=0)
    kick_return_yards: Mapped[int] = mapped_column(SmallInteger, default=0)
    kick_return_td: Mapped[int] = mapped_column(SmallInteger, default=0)
    kicking_xp_made: Mapped[int] = mapped_column(SmallInteger, default=0)
    kicking_xp_missed: Mapped[int] = mapped_column(SmallInteger, default=0)
    kicking_fg_missed: Mapped[int] = mapped_column(SmallInteger, default=0)
    kicking_fg_yards_made: Mapped[list[int]] = mapped_column(
        ARRAY(SmallInteger), default=list
    )
    kicking_fg_yards_missed: Mapped[list[int]] = mapped_column(
        ARRAY(SmallInteger), default=list
    )
    dst_yards_allowed: Mapped[int] = mapped_column(SmallInteger, default=0)
    dst_points_allowed: Mapped[int] = mapped_column(SmallInteger, default=0)
    dst_sacks: Mapped[int] = mapped_column(SmallInteger, default=0)
    dst_def_td: Mapped[int] = mapped_column(SmallInteger, default=0)
    dst_safeties: Mapped[int] = mapped_column(SmallInteger, default=0)
    dst_fumbles_recovered: Mapped[int] = mapped_column(SmallInteger, default=0)
    dst_interceptions: Mapped[int] = mapped_column(SmallInteger, default=0)
    dst_blocked_kicks: Mapped[int] = mapped_column(SmallInteger, default=0)
    dst_two_point_returns: Mapped[int] = mapped_column(SmallInteger, default=0)

    player: Mapped["NFLPlayer"] = relationship("NFLPlayer", back_populates="game_stats")


class NFLGame(Base):
    __tablename__ = "nfl_games"
    __table_args__ = {"schema": "nfl"}

    id: Mapped[str] = mapped_column(String(255), primary_key=True)
    game_status: Mapped[str | None] = mapped_column(String(255), nullable=True)
    game_date: Mapped[str | None] = mapped_column(String(255), nullable=True)
    game_time_epoch: Mapped[str | None] = mapped_column(String(255), nullable=True)
    game_week: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    season: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    espn_link: Mapped[str | None] = mapped_column(String(255), nullable=True)
    team_id_home: Mapped[int | None] = mapped_column(
        SmallInteger, ForeignKey("nfl.nfl_teams.id", ondelete="SET NULL"), nullable=True
    )
    team_id_away: Mapped[int | None] = mapped_column(
        SmallInteger, ForeignKey("nfl.nfl_teams.id", ondelete="SET NULL"), nullable=True
    )
    home_pts: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    away_pts: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    season_type: Mapped[str | None] = mapped_column(String(255), nullable=True)
    team_stats: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    scoring_plays: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    line_score: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    player_stats: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    dst: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    game_clock: Mapped[str | None] = mapped_column(String(255), nullable=True)

    home_team: Mapped["NFLTeam | None"] = relationship(
        "NFLTeam", foreign_keys=[team_id_home]
    )
    away_team: Mapped["NFLTeam | None"] = relationship(
        "NFLTeam", foreign_keys=[team_id_away]
    )
