"""previous_league

Links a league to the one it was run back from (Epic 18).

Revision ID: 0012_previous_league
Revises: 0011_league_notes
Create Date: 2026-10-31 09:00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0012_previous_league"
down_revision: str | Sequence[str] | None = "0011_league_notes"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "leagues",
        sa.Column("previous_league_id", sa.Integer(), nullable=True),
        schema="fantasy",
    )
    op.create_foreign_key(
        "fk_leagues_previous_league_id",
        "leagues",
        "leagues",
        ["previous_league_id"],
        ["id"],
        source_schema="fantasy",
        referent_schema="fantasy",
        ondelete="SET NULL",
    )
    op.create_unique_constraint(
        "uq_leagues_previous_league_id",
        "leagues",
        ["previous_league_id"],
        schema="fantasy",
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_leagues_previous_league_id", "leagues", schema="fantasy", type_="unique"
    )
    op.drop_constraint(
        "fk_leagues_previous_league_id", "leagues", schema="fantasy", type_="foreignkey"
    )
    op.drop_column("leagues", "previous_league_id", schema="fantasy")
