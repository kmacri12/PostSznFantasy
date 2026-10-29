"""ingestion_status

Last successful run per ingestion type, shown to users as data freshness.

Revision ID: 0003
Revises: 0002
Create Date: 2026-10-29 15:00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0003"
down_revision: str | Sequence[str] | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "ingestion_status",
        sa.Column("kind", sa.String(length=32), nullable=False),
        sa.Column("last_synced_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("kind"),
        schema="nfl",
    )


def downgrade() -> None:
    op.drop_table("ingestion_status", schema="nfl")
