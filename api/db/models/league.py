from datetime import UTC, datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import (
    DECIMAL,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from api.db.base import Base
from api.models.enums import LeagueRole

if TYPE_CHECKING:
    from api.db.models.draft import Draft, DraftPick
    from api.db.models.user import User


class League(Base):
    __tablename__ = "leagues"
    __table_args__ = {"schema": "fantasy"}

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    season: Mapped[int] = mapped_column(Integer, nullable=False)
    notes: Mapped[str] = mapped_column(Text, nullable=False, server_default="")

    members: Mapped[list["LeagueMember"]] = relationship(
        "LeagueMember", back_populates="league", cascade="all, delete-orphan"
    )
    invites: Mapped[list["LeagueInvite"]] = relationship(
        "LeagueInvite", back_populates="league", cascade="all, delete-orphan"
    )
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


class LeagueMember(Base):
    __tablename__ = "league_members"
    __table_args__ = (
        CheckConstraint(
            f"role IN ({', '.join(repr(r.value) for r in LeagueRole)})",
            name="ck_league_members_role",
        ),
        {"schema": "fantasy"},
    )

    league_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("fantasy.leagues.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("fantasy.users.id", ondelete="CASCADE"),
        primary_key=True,
        index=True,
    )
    role: Mapped[str] = mapped_column(
        String(20), nullable=False, default=LeagueRole.MEMBER.value
    )
    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC)
    )

    league: Mapped["League"] = relationship("League", back_populates="members")
    user: Mapped["User"] = relationship("User")


class LeagueInvite(Base):
    __tablename__ = "league_invites"
    __table_args__ = {"schema": "fantasy"}

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(16), unique=True, nullable=False)
    league_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("fantasy.leagues.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    created_by: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("fantasy.users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC)
    )
    expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    max_uses: Mapped[int | None] = mapped_column(Integer, nullable=True)
    uses: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    revoked: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    league: Mapped["League"] = relationship("League", back_populates="invites")


class Team(Base):
    __tablename__ = "teams"
    __table_args__ = {"schema": "fantasy"}

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str | None] = mapped_column(String(40))
    owner_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("fantasy.users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    league_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("fantasy.leagues.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    owner: Mapped["User | None"] = relationship("User", back_populates="teams_owned")
    league: Mapped["League"] = relationship("League", back_populates="teams")
    draft_picks: Mapped[list["DraftPick"]] = relationship(
        "DraftPick", back_populates="team", cascade="all, delete-orphan"
    )
    roster: Mapped[list["TeamPlayer"]] = relationship(
        "TeamPlayer", back_populates="team", cascade="all, delete-orphan"
    )
    lineup_slots: Mapped[list["LineupSlot"]] = relationship(
        "LineupSlot", back_populates="team", cascade="all, delete-orphan"
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
        Integer,
        ForeignKey("fantasy.leagues.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
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
    roster_max_qb: Mapped[int] = mapped_column(Integer, nullable=False)
    roster_max_rb: Mapped[int] = mapped_column(Integer, nullable=False)
    roster_max_wr: Mapped[int] = mapped_column(Integer, nullable=False)
    roster_max_te: Mapped[int] = mapped_column(Integer, nullable=False)
    roster_max_k: Mapped[int] = mapped_column(Integer, nullable=False)
    roster_max_dst: Mapped[int] = mapped_column(Integer, nullable=False)
    scoring_passing_yard: Mapped[Decimal] = mapped_column(Numeric(6, 2), nullable=False)
    scoring_passing_td: Mapped[Decimal] = mapped_column(Numeric(6, 2), nullable=False)
    scoring_passing_2pt: Mapped[Decimal] = mapped_column(Numeric(6, 2), nullable=False)
    scoring_passing_interception: Mapped[Decimal] = mapped_column(
        Numeric(6, 2), nullable=False
    )
    scoring_passing_completion: Mapped[Decimal] = mapped_column(
        Numeric(6, 2), nullable=False
    )
    scoring_passing_attempt: Mapped[Decimal] = mapped_column(
        Numeric(6, 2), nullable=False
    )
    scoring_passing_sack: Mapped[Decimal] = mapped_column(Numeric(6, 2), nullable=False)
    scoring_passing_bonus_300_yards: Mapped[Decimal] = mapped_column(
        Numeric(6, 2), nullable=False
    )
    scoring_passing_bonus_400_yards: Mapped[Decimal] = mapped_column(
        Numeric(6, 2), nullable=False
    )
    scoring_rushing_yard: Mapped[Decimal] = mapped_column(Numeric(6, 2), nullable=False)
    scoring_rushing_td: Mapped[Decimal] = mapped_column(Numeric(6, 2), nullable=False)
    scoring_rushing_2pt: Mapped[Decimal] = mapped_column(Numeric(6, 2), nullable=False)
    scoring_rushing_attempt: Mapped[Decimal] = mapped_column(
        Numeric(6, 2), nullable=False
    )
    scoring_rushing_bonus_100_yards: Mapped[Decimal] = mapped_column(
        Numeric(6, 2), nullable=False
    )
    scoring_rushing_bonus_200_yards: Mapped[Decimal] = mapped_column(
        Numeric(6, 2), nullable=False
    )
    scoring_receiving_reception: Mapped[Decimal] = mapped_column(
        Numeric(6, 2), nullable=False
    )
    scoring_receiving_yard: Mapped[Decimal] = mapped_column(
        Numeric(6, 2), nullable=False
    )
    scoring_receiving_td: Mapped[Decimal] = mapped_column(Numeric(6, 2), nullable=False)
    scoring_receiving_2pt: Mapped[Decimal] = mapped_column(
        Numeric(6, 2), nullable=False
    )
    scoring_receiving_target: Mapped[Decimal] = mapped_column(
        Numeric(6, 2), nullable=False
    )
    scoring_receiving_reception_bonus_rb: Mapped[Decimal] = mapped_column(
        Numeric(6, 2), nullable=False
    )
    scoring_receiving_reception_bonus_wr: Mapped[Decimal] = mapped_column(
        Numeric(6, 2), nullable=False
    )
    scoring_receiving_reception_bonus_te: Mapped[Decimal] = mapped_column(
        Numeric(6, 2), nullable=False
    )
    scoring_receiving_bonus_100_yards: Mapped[Decimal] = mapped_column(
        Numeric(6, 2), nullable=False
    )
    scoring_receiving_bonus_200_yards: Mapped[Decimal] = mapped_column(
        Numeric(6, 2), nullable=False
    )
    scoring_carrying_fumble: Mapped[Decimal] = mapped_column(
        Numeric(6, 2), nullable=False
    )
    scoring_carrying_fumble_lost: Mapped[Decimal] = mapped_column(
        Numeric(6, 2), nullable=False
    )
    scoring_special_punt_return_yard: Mapped[Decimal] = mapped_column(
        Numeric(6, 2), nullable=False
    )
    scoring_special_kick_return_yard: Mapped[Decimal] = mapped_column(
        Numeric(6, 2), nullable=False
    )
    scoring_kicking_fg_made: Mapped[Decimal] = mapped_column(
        Numeric(6, 2), nullable=False
    )
    scoring_kicking_fg_miss: Mapped[Decimal] = mapped_column(
        Numeric(6, 2), nullable=False
    )
    scoring_kicking_fg_yard: Mapped[Decimal] = mapped_column(
        Numeric(6, 2), nullable=False
    )
    scoring_kicking_xp_made: Mapped[Decimal] = mapped_column(
        Numeric(6, 2), nullable=False
    )
    scoring_kicking_xp_miss: Mapped[Decimal] = mapped_column(
        Numeric(6, 2), nullable=False
    )
    scoring_dst_td: Mapped[Decimal] = mapped_column(Numeric(6, 2), nullable=False)
    scoring_dst_pts_allowed_0: Mapped[Decimal] = mapped_column(
        Numeric(6, 2), nullable=False
    )
    scoring_dst_pts_allowed_1_13: Mapped[Decimal] = mapped_column(
        Numeric(6, 2), nullable=False
    )
    scoring_dst_pts_allowed_14_21: Mapped[Decimal] = mapped_column(
        Numeric(6, 2), nullable=False
    )
    scoring_dst_pts_allowed_22_28: Mapped[Decimal] = mapped_column(
        Numeric(6, 2), nullable=False
    )
    scoring_dst_pts_allowed_29_plus: Mapped[Decimal] = mapped_column(
        Numeric(6, 2), nullable=False
    )
    scoring_dst_yards_allowed_under_100: Mapped[Decimal] = mapped_column(
        Numeric(6, 2), nullable=False
    )
    scoring_dst_yards_allowed_100_199: Mapped[Decimal] = mapped_column(
        Numeric(6, 2), nullable=False
    )
    scoring_dst_yards_allowed_200_299: Mapped[Decimal] = mapped_column(
        Numeric(6, 2), nullable=False
    )
    scoring_dst_yards_allowed_300_plus: Mapped[Decimal] = mapped_column(
        Numeric(6, 2), nullable=False
    )
    scoring_dst_sack: Mapped[Decimal] = mapped_column(Numeric(6, 2), nullable=False)
    scoring_dst_safety: Mapped[Decimal] = mapped_column(Numeric(6, 2), nullable=False)
    scoring_dst_fumble_recover: Mapped[Decimal] = mapped_column(
        Numeric(6, 2), nullable=False
    )
    scoring_dst_interception: Mapped[Decimal] = mapped_column(
        Numeric(6, 2), nullable=False
    )
    scoring_dst_blocked_kick: Mapped[Decimal] = mapped_column(
        Numeric(6, 2), nullable=False
    )
    scoring_dst_two_point_return: Mapped[Decimal] = mapped_column(
        Numeric(6, 2), nullable=False
    )
    allow_join_after_draft_start: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True
    )
    multiplier_wild_card: Mapped[Decimal] = mapped_column(
        Numeric(6, 2), nullable=False, default=1
    )
    multiplier_divisional: Mapped[Decimal] = mapped_column(
        Numeric(6, 2), nullable=False, default=1
    )
    multiplier_conference: Mapped[Decimal] = mapped_column(
        Numeric(6, 2), nullable=False, default=1
    )
    multiplier_super_bowl: Mapped[Decimal] = mapped_column(
        Numeric(6, 2), nullable=False, default=1
    )
    # No defaults: the commissioner chooses both explicitly (services.team_units).
    team_qb: Mapped[bool] = mapped_column(Boolean, nullable=False)
    team_k: Mapped[bool] = mapped_column(Boolean, nullable=False)

    league: Mapped["League"] = relationship("League", back_populates="settings")


class TeamPlayer(Base):
    """A player on a fantasy team's roster (filled by the draft)."""

    __tablename__ = "team_players"
    __table_args__ = (
        UniqueConstraint("league_id", "player_id"),
        {"schema": "fantasy"},
    )

    # Denormalized from the team so the database can enforce one owner per player per league.
    league_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("fantasy.leagues.id", ondelete="CASCADE"),
        nullable=False,
    )
    team_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("fantasy.teams.id", ondelete="CASCADE"), primary_key=True
    )
    player_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("nfl.nfl_players.id", ondelete="CASCADE"),
        primary_key=True,
        index=True,
    )

    team: Mapped["Team"] = relationship("Team", back_populates="roster")


class LineupSlot(Base):
    """One player placed in a slot of a team's lineup for one round.

    Absence of rows is the empty lineup. Unplaced roster players have no row.
    """

    __tablename__ = "lineup_slots"
    __table_args__ = (
        UniqueConstraint("team_id", "round", "slot_index"),
        CheckConstraint("round BETWEEN 1 AND 4", name="ck_lineup_slots_round"),
        {"schema": "fantasy"},
    )

    team_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("fantasy.teams.id", ondelete="CASCADE"), primary_key=True
    )
    round: Mapped[int] = mapped_column(Integer, primary_key=True)
    player_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("nfl.nfl_players.id", ondelete="CASCADE"),
        primary_key=True,
    )
    # Index into the league's slot layout (see services.lineups.slot_layout).
    slot_index: Mapped[int] = mapped_column(Integer, nullable=False)

    team: Mapped["Team"] = relationship("Team", back_populates="lineup_slots")


class LeagueStanding(Base):
    __tablename__ = "standings"
    __table_args__ = (
        UniqueConstraint("league_id", "team_id"),
        {"schema": "fantasy"},
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    league_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("fantasy.leagues.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    team_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("fantasy.teams.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    rank: Mapped[int] = mapped_column(Integer, nullable=False)
    players_left: Mapped[int | None] = mapped_column(Integer, nullable=True)
    wild_card: Mapped[Decimal | None] = mapped_column(DECIMAL(10, 2), nullable=True)
    divisional: Mapped[Decimal | None] = mapped_column(DECIMAL(10, 2), nullable=True)
    conf_champ: Mapped[Decimal | None] = mapped_column(DECIMAL(10, 2), nullable=True)
    super_bowl: Mapped[Decimal | None] = mapped_column(DECIMAL(10, 2), nullable=True)
    total: Mapped[Decimal | None] = mapped_column(DECIMAL(10, 2), nullable=True)

    league: Mapped["League"] = relationship("League", back_populates="standings")
    team: Mapped["Team"] = relationship("Team", back_populates="standings")
