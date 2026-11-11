"""pinned league announcement

The commissioner's pinned announcement (#403): three columns on `leagues`, the
`announcement` activity kind, and a push preference for it.

Revision ID: 0031_announcements
Revises: 0030_feature_flags
Create Date: 2026-11-11 20:00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0031_announcements"
down_revision: str | Sequence[str] | None = "0030_feature_flags"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

OLD_KINDS = (
    "'lineup_move', 'commissioner_override', 'stat_correction', 'settings_change', "
    "'league_created', 'membership_joined', 'membership_left', 'role_changed', "
    "'draft_order_randomized', 'draft_order_changed', 'draft_started', "
    "'draft_completed', 'draft_pick_assigned', 'draft_time_set'"
)
NEW_KINDS = f"{OLD_KINDS}, 'announcement'"


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
        "leagues",
        sa.Column("announcement", sa.Text(), nullable=False, server_default=""),
        schema="fantasy",
    )
    op.add_column(
        "leagues",
        sa.Column("announcement_at", sa.DateTime(timezone=True), nullable=True),
        schema="fantasy",
    )
    op.add_column(
        "leagues",
        sa.Column("announcement_by", sa.Integer(), nullable=True),
        schema="fantasy",
    )
    op.create_foreign_key(
        "fk_leagues_announcement_by_users",
        "leagues",
        "users",
        ["announcement_by"],
        ["id"],
        source_schema="fantasy",
        referent_schema="fantasy",
        ondelete="SET NULL",
    )
    op.add_column(
        "users",
        sa.Column(
            "push_announcements",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
        schema="fantasy",
    )
    _set_kind_constraint(NEW_KINDS)


def downgrade() -> None:
    op.execute("DELETE FROM fantasy.activity_events WHERE kind = 'announcement'")
    _set_kind_constraint(OLD_KINDS)
    op.drop_column("users", "push_announcements", schema="fantasy")
    op.drop_constraint(
        "fk_leagues_announcement_by_users",
        "leagues",
        schema="fantasy",
        type_="foreignkey",
    )
    op.drop_column("leagues", "announcement_by", schema="fantasy")
    op.drop_column("leagues", "announcement_at", schema="fantasy")
    op.drop_column("leagues", "announcement", schema="fantasy")
