"""avatars

Profile, league and team pictures (#316): each row keeps only the key of its image in
the avatar store.

Revision ID: 0019_avatars
Revises: 0018_push_notifications
Create Date: 2026-11-07 10:00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0019_avatars"
down_revision: str | Sequence[str] | None = "0018_push_notifications"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

TABLES = ("users", "leagues", "teams")


def upgrade() -> None:
    for table in TABLES:
        op.add_column(
            table,
            sa.Column("avatar_key", sa.String(length=32), nullable=True),
            schema="fantasy",
        )


def downgrade() -> None:
    for table in TABLES:
        op.drop_column(table, "avatar_key", schema="fantasy")
