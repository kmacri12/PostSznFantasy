"""draft pick source

How each pick was made (#466): `draft_picks.source`. Older picks with `autopick`
set become `timer`, the most common reason; the rest stay `manager`. `autopick`
stays, since the API build still serving during a deploy writes it.

Revision ID: 0032_draft_pick_source
Revises: 0031_announcements
Create Date: 2026-11-17 12:00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0032_draft_pick_source"
down_revision: str | Sequence[str] | None = "0031_announcements"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SOURCES = (
    "'manager', 'timer', 'autopilot', 'no_owner', 'commissioner_auto', "
    "'commissioner_assigned'"
)


def upgrade() -> None:
    op.add_column(
        "draft_picks",
        sa.Column("source", sa.String(24), nullable=False, server_default="manager"),
        schema="fantasy",
    )
    op.execute("UPDATE fantasy.draft_picks SET source = 'timer' WHERE autopick")
    op.create_check_constraint(
        "ck_draft_picks_source",
        "draft_picks",
        f"source IN ({SOURCES})",
        schema="fantasy",
    )


def downgrade() -> None:
    op.drop_constraint(
        "ck_draft_picks_source", "draft_picks", schema="fantasy", type_="check"
    )
    op.drop_column("draft_picks", "source", schema="fantasy")
