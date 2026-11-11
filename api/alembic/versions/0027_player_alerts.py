"""player alerts

Player and score alerts (#391): three push preferences, quiet hours with the member's
time zone, and the log that makes one event one push.

Revision ID: 0027_player_alerts
Revises: 0025_notifications
Create Date: 2026-11-11 14:00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0027_player_alerts"
down_revision: str | Sequence[str] | None = "0025_notifications"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

USER_COLUMNS = (
    ("push_starter_alerts", sa.true()),
    ("push_score_alerts", sa.false()),
    ("push_round_results", sa.false()),
    ("quiet_hours", sa.false()),
)


def upgrade() -> None:
    for name, default in USER_COLUMNS:
        op.add_column(
            "users",
            sa.Column(name, sa.Boolean(), nullable=False, server_default=default),
            schema="fantasy",
        )
    op.add_column(
        "users",
        sa.Column("timezone", sa.String(length=64), nullable=True),
        schema="fantasy",
    )
    op.create_table(
        "alerts_sent",
        sa.Column("team_id", sa.Integer(), nullable=False),
        sa.Column("key", sa.String(length=80), nullable=False),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["team_id"], ["fantasy.teams.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("team_id", "key"),
        schema="fantasy",
    )


def downgrade() -> None:
    op.drop_table("alerts_sent", schema="fantasy")
    op.drop_column("users", "timezone", schema="fantasy")
    for name, _ in USER_COLUMNS:
        op.drop_column("users", name, schema="fantasy")
