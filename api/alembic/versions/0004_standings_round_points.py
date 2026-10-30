"""standings_round_points

Round points are fractional (0.04 per passing yard), so they cannot be integers.

Revision ID: 0004
Revises: 0003
Create Date: 2026-10-30 12:00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0004"
down_revision: str | Sequence[str] | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

ROUND_COLUMNS = ("wild_card", "divisional", "conf_champ", "super_bowl")


def upgrade() -> None:
    for column in ROUND_COLUMNS:
        op.alter_column(
            "standings",
            column,
            existing_type=sa.Integer(),
            type_=sa.DECIMAL(10, 2),
            schema="fantasy",
        )


def downgrade() -> None:
    for column in ROUND_COLUMNS:
        op.alter_column(
            "standings",
            column,
            existing_type=sa.DECIMAL(10, 2),
            type_=sa.Integer(),
            schema="fantasy",
        )
