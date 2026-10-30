from datetime import UTC, datetime
from typing import Any

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from api.db.base import Base
from api.models.enums import ActivityKind

# `activity_views.team_id` for the league feed, which belongs to no single team.
LEAGUE_FEED = 0


class ActivityEvent(Base):
    """One entry in the activity feed. Rows are only ever inserted.

    The league feed is every event of a league; a team's feed is the events carrying
    its `team_id` (settings changes belong to no team). Names are snapshotted so an
    old entry still reads the same after a rename or an account change.
    """

    __tablename__ = "activity_events"
    __table_args__ = (
        CheckConstraint(
            f"kind IN ({', '.join(repr(k.value) for k in ActivityKind)})",
            name="ck_activity_events_kind",
        ),
        Index("ix_activity_events_league_id_id", "league_id", "id"),
        Index("ix_activity_events_team_id_id", "team_id", "id"),
        {"schema": "fantasy"},
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    league_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("fantasy.leagues.id", ondelete="CASCADE"), nullable=False
    )
    team_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("fantasy.teams.id", ondelete="CASCADE"), nullable=True
    )
    kind: Mapped[str] = mapped_column(String(32), nullable=False)
    actor_user_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("fantasy.users.id", ondelete="SET NULL"), nullable=True
    )
    actor_name: Mapped[str | None] = mapped_column(String(20), nullable=True)
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC)
    )


class ActivityView(Base):
    """The newest event a member had seen when they last expanded a feed."""

    __tablename__ = "activity_views"
    __table_args__ = {"schema": "fantasy"}

    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("fantasy.users.id", ondelete="CASCADE"), primary_key=True
    )
    league_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("fantasy.leagues.id", ondelete="CASCADE"), primary_key=True
    )
    team_id: Mapped[int] = mapped_column(Integer, primary_key=True, default=LEAGUE_FEED)
    last_event_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
