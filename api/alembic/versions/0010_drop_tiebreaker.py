"""drop_tiebreaker

Drops league_settings.tiebreaker: the tiebreaker chain is fixed
(docs/product-rules.md section 6) and no code reads the column any more.

Revision ID: 0010_drop_tiebreaker
Revises: 0009_team_unit_settings
Create Date: 2026-10-30 17:00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0010_drop_tiebreaker"
down_revision: str | Sequence[str] | None = "0009_team_unit_settings"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_column("league_settings", "tiebreaker")


def downgrade() -> None:
    op.add_column(
        "league_settings",
        sa.Column(
            "tiebreaker",
            sa.String(length=30),
            nullable=False,
            server_default="most_players_alive",
        ),
    )
    op.alter_column("league_settings", "tiebreaker", server_default=None)
