"""playoff_field

Marks the 14 playoff teams (the draft pool) and folds fullbacks into running backs.

Revision ID: 0005
Revises: 0004
Create Date: 2026-10-30 13:00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0005"
down_revision: str | Sequence[str] | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "nfl_teams",
        sa.Column("in_playoffs", sa.Boolean(), nullable=False, server_default="false"),
        schema="nfl",
    )
    op.execute("UPDATE nfl.nfl_players SET position = 'RB' WHERE position = 'FB'")


def downgrade() -> None:
    op.drop_column("nfl_teams", "in_playoffs", schema="nfl")
