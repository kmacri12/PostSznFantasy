"""league_notes

Adds the free-text league notes the commissioner edits (house rules, welcome message).

Revision ID: 0011_league_notes
Revises: 0010_drop_tiebreaker
Create Date: 2026-10-30 21:00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0011_league_notes"
down_revision: str | Sequence[str] | None = "0010_drop_tiebreaker"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "leagues",
        sa.Column("notes", sa.Text(), nullable=False, server_default=""),
        schema="fantasy",
    )


def downgrade() -> None:
    op.drop_column("leagues", "notes", schema="fantasy")
