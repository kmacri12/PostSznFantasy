"""push_notifications

Web push (#266): one subscription per device, and a record of which lineup lock
reminders were already sent so a restart cannot send one twice.

Revision ID: 0017_push_notifications
Revises: 0016_membership_activity
Create Date: 2026-11-04 10:00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0017_push_notifications"
down_revision: str | Sequence[str] | None = "0016_membership_activity"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "push_subscriptions",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("endpoint", sa.Text(), nullable=False),
        sa.Column("p256dh", sa.String(length=255), nullable=False),
        sa.Column("auth", sa.String(length=64), nullable=False),
        sa.Column("user_agent", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_seen", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["fantasy.users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("endpoint"),
        schema="fantasy",
    )
    op.create_index(
        op.f("ix_fantasy_push_subscriptions_user_id"),
        "push_subscriptions",
        ["user_id"],
        schema="fantasy",
    )
    op.create_table(
        "lineup_reminders",
        sa.Column("team_id", sa.Integer(), nullable=False),
        sa.Column("round", sa.Integer(), nullable=False),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["team_id"], ["fantasy.teams.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("team_id", "round"),
        schema="fantasy",
    )


def downgrade() -> None:
    op.drop_table("lineup_reminders", schema="fantasy")
    op.drop_index(
        op.f("ix_fantasy_push_subscriptions_user_id"),
        table_name="push_subscriptions",
        schema="fantasy",
    )
    op.drop_table("push_subscriptions", schema="fantasy")
