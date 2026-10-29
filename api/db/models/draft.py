from datetime import datetime, time
from typing import TYPE_CHECKING

from sqlalchemy import (
    ARRAY,
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Time,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from api.db.base import Base

if TYPE_CHECKING:
    from api.db.models.league import League, Team
    from api.db.models.nfl import NFLPlayer


class Draft(Base):
    __tablename__ = "drafts"
    __table_args__ = {"schema": "fantasy"}

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    league_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("fantasy.leagues.id", ondelete="CASCADE"), nullable=False
    )
    status: Mapped[str | None] = mapped_column(String(20), nullable=True)
    start_time: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    draft_type: Mapped[str | None] = mapped_column(String(20), nullable=True)
    time_per_pick_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    slow_draft_auto_pause: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    slow_draft_pause_from: Mapped[time | None] = mapped_column(Time, nullable=True)
    slow_draft_pause_to: Mapped[time | None] = mapped_column(Time, nullable=True)
    slow_draft_pause_timezone: Mapped[str | None] = mapped_column(
        String(20), nullable=True
    )
    cpu_autopick: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    alphabetical_sort: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    draft_order_team_ids: Mapped[list[int] | None] = mapped_column(
        ARRAY(Integer), nullable=True
    )

    league: Mapped["League"] = relationship("League", back_populates="draft")
    draft_picks: Mapped[list["DraftPick"]] = relationship(
        "DraftPick", back_populates="draft", cascade="all, delete-orphan"
    )


class DraftPick(Base):
    __tablename__ = "draft_picks"
    __table_args__ = {"schema": "fantasy"}

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    draft_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("fantasy.drafts.id", ondelete="CASCADE"), nullable=False
    )
    team_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("fantasy.teams.id", ondelete="CASCADE"), nullable=False
    )
    player_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("nfl.nfl_players.id", ondelete="CASCADE"), nullable=False
    )
    number_round: Mapped[int | None] = mapped_column(Integer, nullable=True)
    number_pick_overall: Mapped[int | None] = mapped_column(Integer, nullable=True)
    number_pick_in_round: Mapped[int | None] = mapped_column(Integer, nullable=True)
    autopick: Mapped[bool | None] = mapped_column(Boolean, default=False, nullable=True)

    draft: Mapped["Draft"] = relationship("Draft", back_populates="draft_picks")
    team: Mapped["Team"] = relationship("Team", back_populates="draft_picks")
    player: Mapped["NFLPlayer"] = relationship(
        "NFLPlayer", back_populates="draft_picks"
    )
