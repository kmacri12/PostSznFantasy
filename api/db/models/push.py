from datetime import UTC, datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from api.db.base import Base


class PushSubscription(Base):
    """One browser or installed-app endpoint a user opted in on; a user has one per device."""

    __tablename__ = "push_subscriptions"
    __table_args__ = {"schema": "fantasy"}

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("fantasy.users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # The push service's URL for this device; unique, so re-subscribing is an upsert.
    endpoint: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    p256dh: Mapped[str] = mapped_column(String(255), nullable=False)
    auth: Mapped[str] = mapped_column(String(64), nullable=False)
    user_agent: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC)
    )
    last_seen: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC)
    )


class LineupReminder(Base):
    """A lock reminder already sent for a team and round, so a restart never repeats it."""

    __tablename__ = "lineup_reminders"
    __table_args__ = {"schema": "fantasy"}

    team_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("fantasy.teams.id", ondelete="CASCADE"), primary_key=True
    )
    round: Mapped[int] = mapped_column(Integer, primary_key=True)
    sent_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC)
    )
