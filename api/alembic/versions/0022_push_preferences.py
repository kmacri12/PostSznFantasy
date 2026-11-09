"""push preferences

Per-user switches for draft alerts, lineup reminders and chat pushes, plus a per-league
chat mute (#339).

Revision ID: 0022_push_preferences
Revises: 0021_merge_0020_heads
Create Date: 2026-11-09 18:00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0022_push_preferences"
down_revision: str | Sequence[str] | None = "0021_merge_0020_heads"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

USER_COLUMNS = (
    ("push_draft_alerts", sa.true()),
    ("push_lineup_reminders", sa.true()),
    ("push_chat", sa.false()),
)


def upgrade() -> None:
    for name, default in USER_COLUMNS:
        op.add_column(
            "users",
            sa.Column(name, sa.Boolean(), nullable=False, server_default=default),
            schema="fantasy",
        )
    op.add_column(
        "league_members",
        sa.Column(
            "chat_muted", sa.Boolean(), nullable=False, server_default=sa.false()
        ),
        schema="fantasy",
    )


def downgrade() -> None:
    op.drop_column("league_members", "chat_muted", schema="fantasy")
    for name, _ in USER_COLUMNS:
        op.drop_column("users", name, schema="fantasy")
