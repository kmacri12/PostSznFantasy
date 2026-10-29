from datetime import datetime, time
from enum import StrEnum
from typing import TYPE_CHECKING

from sqlalchemy import (
    ARRAY,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Time,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from api.db.base import Base
from api.models.enums import DraftStatus, DraftType

if TYPE_CHECKING:
    from api.db.models.league import League, Team
    from api.db.models.nfl import NFLPlayer


def _sql_list(enum: type[StrEnum]) -> str:
    return ", ".join(f"'{member.value}'" for member in enum)


class Draft(Base):
    __tablename__ = "drafts"
    __table_args__ = (
        CheckConstraint(
            f"status IN ({_sql_list(DraftStatus)})", name="ck_drafts_status"
        ),
        CheckConstraint(
            f"draft_type IN ({_sql_list(DraftType)})", name="ck_drafts_draft_type"
        ),
        {"schema": "fantasy"},
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    league_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("fantasy.leagues.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default=DraftStatus.SCHEDULED.value
    )
    start_time: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    draft_type: Mapped[str] = mapped_column(
        String(20), nullable=False, default=DraftType.SNAKE.value
    )
    time_per_pick_seconds: Mapped[int] = mapped_column(
        Integer, nullable=False, default=60
    )
    slow_draft_auto_pause: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    slow_draft_pause_from: Mapped[time | None] = mapped_column(Time, nullable=True)
    slow_draft_pause_to: Mapped[time | None] = mapped_column(Time, nullable=True)
    slow_draft_pause_timezone: Mapped[str | None] = mapped_column(
        String(20), nullable=True
    )
    cpu_autopick: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    alphabetical_sort: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    draft_order_team_ids: Mapped[list[int]] = mapped_column(
        ARRAY(Integer), nullable=False, default=list
    )

    league: Mapped["League"] = relationship("League", back_populates="draft")
    draft_picks: Mapped[list["DraftPick"]] = relationship(
        "DraftPick", back_populates="draft", cascade="all, delete-orphan"
    )


class DraftPick(Base):
    __tablename__ = "draft_picks"
    __table_args__ = (
        UniqueConstraint("draft_id", "player_id"),
        UniqueConstraint("draft_id", "number_pick_overall"),
        {"schema": "fantasy"},
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    draft_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("fantasy.drafts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    team_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("fantasy.teams.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    player_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("nfl.nfl_players.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    number_round: Mapped[int] = mapped_column(Integer, nullable=False)
    number_pick_overall: Mapped[int] = mapped_column(Integer, nullable=False)
    number_pick_in_round: Mapped[int] = mapped_column(Integer, nullable=False)
    autopick: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    draft: Mapped["Draft"] = relationship("Draft", back_populates="draft_picks")
    team: Mapped["Team"] = relationship("Team", back_populates="draft_picks")
    player: Mapped["NFLPlayer"] = relationship(
        "NFLPlayer", back_populates="draft_picks"
    )
