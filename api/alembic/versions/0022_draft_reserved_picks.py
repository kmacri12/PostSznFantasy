"""draft reserved picks

Players a commissioner assigned by hand to slots that have not come up yet (#332), and
the activity kind that records every manual assignment.

Revision ID: 0022_draft_reserved_picks
Revises: 0021_merge_0020_heads
Create Date: 2026-11-09 12:00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0022_draft_reserved_picks"
down_revision: str | Sequence[str] | None = "0021_merge_0020_heads"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

OLD_KINDS = (
    "'lineup_move', 'commissioner_override', 'stat_correction', 'settings_change', "
    "'league_created', 'membership_joined', 'membership_left', 'role_changed', "
    "'draft_order_randomized', 'draft_order_changed', 'draft_started', "
    "'draft_completed'"
)
NEW_KINDS = f"{OLD_KINDS}, 'draft_pick_assigned'"


def _set_kind_constraint(kinds: str) -> None:
    op.drop_constraint(
        "ck_activity_events_kind", "activity_events", schema="fantasy", type_="check"
    )
    op.create_check_constraint(
        "ck_activity_events_kind",
        "activity_events",
        f"kind IN ({kinds})",
        schema="fantasy",
    )


def upgrade() -> None:
    op.add_column(
        "drafts",
        sa.Column(
            "reserved_picks",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default="{}",
            nullable=False,
        ),
        schema="fantasy",
    )
    _set_kind_constraint(NEW_KINDS)


def downgrade() -> None:
    op.execute("DELETE FROM fantasy.activity_events WHERE kind = 'draft_pick_assigned'")
    _set_kind_constraint(OLD_KINDS)
    op.drop_column("drafts", "reserved_picks", schema="fantasy")
