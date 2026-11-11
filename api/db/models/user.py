from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Integer,
    String,
    false,
    func,
    true,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from api.db.base import Base

if TYPE_CHECKING:
    from api.db.models.league import Team


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint("hour_cycle IN ('12', '24')", name="ck_users_hour_cycle"),
        {"schema": "fantasy"},
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    supabase_uid: Mapped[str] = mapped_column(String(128), unique=True, nullable=False)
    username: Mapped[str] = mapped_column(String(20), nullable=False)
    email: Mapped[str | None] = mapped_column(String(120), unique=True, nullable=True)
    # Key of the profile picture in the avatar store (services/avatars.py); None = initials.
    avatar_key: Mapped[str | None] = mapped_column(String(32), nullable=True)
    # Signup time for the metrics views (#358); rows from before it carry the migration's.
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    # Which pushes this person wants (the device switch only grants permission). Chat is
    # off by default: a busy league would otherwise push every message to everyone.
    push_draft_alerts: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default=true()
    )
    push_lineup_reminders: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default=true()
    )
    push_chat: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=false()
    )
    # Player and score alerts (#391): a hurt starter is on by default, the rest are
    # opt-in because a live game would otherwise buzz a phone every few minutes.
    push_starter_alerts: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default=true()
    )
    push_score_alerts: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=false()
    )
    push_round_results: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=false()
    )
    # A chat message that @mentions the member: on by default, apart from `push_chat`.
    push_mentions: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default=true()
    )
    # A commissioner's pinned announcement (#403), when they chose to push it.
    push_announcements: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default=true()
    )
    # No player-alert pushes between 11pm and 7am in `timezone` (an IANA name the
    # browser reports when the member turns this on).
    quiet_hours: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=false()
    )
    timezone: Mapped[str | None] = mapped_column(String(64), nullable=True)
    # Account center (#405): the zone and clock times are shown in; null follows the browser.
    display_time_zone: Mapped[str | None] = mapped_column(String(64), nullable=True)
    hour_cycle: Mapped[str | None] = mapped_column(String(2), nullable=True)

    teams_owned: Mapped[list["Team"]] = relationship(
        "Team", back_populates="owner", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<User {self.username}>"
