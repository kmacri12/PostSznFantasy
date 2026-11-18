"""draft autopilot

Teams on autopilot (#463): `drafts.autopilot_team_ids`. The clock auto-picks for
them a few seconds into their turn instead of waiting out the pick timer.

Revision ID: 0033_draft_autopilot
Revises: 0032_draft_pick_source
Create Date: 2026-11-17 22:00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0033_draft_autopilot"
down_revision: str | Sequence[str] | None = "0032_draft_pick_source"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "drafts",
        sa.Column(
            "autopilot_team_ids",
            postgresql.ARRAY(sa.Integer()),
            nullable=False,
            server_default="{}",
        ),
        schema="fantasy",
    )


def downgrade() -> None:
    op.drop_column("drafts", "autopilot_team_ids", schema="fantasy")
