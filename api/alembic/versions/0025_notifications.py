"""notifications

The notification inbox (#397): one row per member and thing addressed to them, ids only.

Revision ID: 0025_notifications
Revises: 0024_metrics_views
Create Date: 2026-11-11 12:00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0025_notifications"
down_revision: str | Sequence[str] | None = "0024_metrics_views"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "notifications",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("kind", sa.String(length=40), nullable=False),
        sa.Column("league_id", sa.Integer(), nullable=False),
        sa.Column("payload", postgresql.JSONB(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["fantasy.users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["league_id"], ["fantasy.leagues.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        schema="fantasy",
    )
    op.create_index(
        "ix_notifications_user_id_created_at",
        "notifications",
        ["user_id", "created_at"],
        schema="fantasy",
    )


def downgrade() -> None:
    op.drop_index(
        "ix_notifications_user_id_created_at",
        table_name="notifications",
        schema="fantasy",
    )
    op.drop_table("notifications", schema="fantasy")
