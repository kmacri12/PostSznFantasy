"""feature flags

Owner kill switches (#393): one row per flag that was flipped; a missing row means
the flag's default.

Revision ID: 0030_feature_flags
Revises: 0029_account_center
Create Date: 2026-11-11 18:00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0030_feature_flags"
down_revision: str | Sequence[str] | None = "0029_account_center"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "feature_flags",
        sa.Column("key", sa.String(40), primary_key=True),
        sa.Column("enabled", sa.Boolean(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        schema="fantasy",
    )


def downgrade() -> None:
    op.drop_table("feature_flags", schema="fantasy")
