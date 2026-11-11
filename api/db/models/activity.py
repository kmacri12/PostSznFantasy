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
    Text,
    text,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from api.db.base import Base
from api.models.enums import ActivityKind

# `activity_views.team_id` for the league feed, which belongs to no single team.
LEAGUE_FEED = 0


class ActivityEvent(Base):
    """One entry in the activity feed. Rows are only ever inserted.

    The league feed is every event of a season; a team's feed is the events carrying
    its `team_id` (settings changes belong to no team). Names are snapshotted so an
    old entry still reads the same after a rename or an account change.
    """

    __tablename__ = "activity_events"
    __table_args__ = (
        CheckConstraint(
            f"kind IN ({', '.join(repr(k.value) for k in ActivityKind)})",
            name="ck_activity_events_kind",
        ),
        Index("ix_activity_events_season_id_id", "season_id", "id"),
        Index("ix_activity_events_team_id_id", "team_id", "id"),
        {"schema": "fantasy"},
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    season_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("fantasy.seasons.id", ondelete="CASCADE"), nullable=False
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
    season_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("fantasy.seasons.id", ondelete="CASCADE"), primary_key=True
    )
    team_id: Mapped[int] = mapped_column(Integer, primary_key=True, default=LEAGUE_FEED)
    last_event_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    # Chat messages share the feed's one dot, so the newest one seen is kept alongside.
    last_message_id: Mapped[int] = mapped_column(
        BigInteger, nullable=False, default=0, server_default="0"
    )


class LeagueMessage(Base):
    """One chat message in a season's feed. Deleting is soft: the row stays, hidden.

    `author_name` is snapshotted like an event's actor name. `gif_url` is stored as
    given once its host passed the `GIF_ALLOWED_HOSTS` allowlist.
    """

    __tablename__ = "league_messages"
    __table_args__ = (
        CheckConstraint("char_length(body) <= 2000", name="ck_league_messages_body"),
        CheckConstraint(
            "body <> '' OR gif_url IS NOT NULL", name="ck_league_messages_not_empty"
        ),
        Index("ix_league_messages_season_id_id", "season_id", "id"),
        {"schema": "fantasy"},
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    league_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("fantasy.leagues.id", ondelete="CASCADE"), nullable=False
    )
    season_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("fantasy.seasons.id", ondelete="CASCADE"), nullable=False
    )
    author_user_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("fantasy.users.id", ondelete="SET NULL"), nullable=True
    )
    author_name: Mapped[str | None] = mapped_column(String(20), nullable=True)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    gif_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC)
    )
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    deleted_by: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("fantasy.users.id", ondelete="SET NULL"), nullable=True
    )
    # The quoted message; its row outlives a deletion, so the quote can say so.
    reply_to_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("fantasy.league_messages.id", ondelete="SET NULL"),
        nullable=True,
    )
    edited_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # League members the author tagged with @; the text carries the visible `@name`.
    mentioned_user_ids: Mapped[list[int]] = mapped_column(
        ARRAY(Integer), nullable=False, default=list, server_default=text("'{}'")
    )


class MessageReaction(Base):
    """One member's one emoji on a message; adding twice is a no-op."""

    __tablename__ = "message_reactions"
    __table_args__ = {"schema": "fantasy"}

    message_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("fantasy.league_messages.id", ondelete="CASCADE"),
        primary_key=True,
    )
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("fantasy.users.id", ondelete="CASCADE"), primary_key=True
    )
    emoji: Mapped[str] = mapped_column(String(32), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC)
    )
