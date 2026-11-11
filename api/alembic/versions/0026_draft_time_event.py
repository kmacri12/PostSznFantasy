"""draft time activity event

The activity kind that records the draft time being set, moved or cleared (#388).

Revision ID: 0026_draft_time_event
Revises: 0025_notifications
Create Date: 2026-11-11 12:00:00

"""

from collections.abc import Sequence

from alembic import op

revision: str = "0026_draft_time_event"
down_revision: str | Sequence[str] | None = "0025_notifications"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

OLD_KINDS = (
    "'lineup_move', 'commissioner_override', 'stat_correction', 'settings_change', "
    "'league_created', 'membership_joined', 'membership_left', 'role_changed', "
    "'draft_order_randomized', 'draft_order_changed', 'draft_started', "
    "'draft_completed', 'draft_pick_assigned'"
)
NEW_KINDS = f"{OLD_KINDS}, 'draft_time_set'"


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
    _set_kind_constraint(NEW_KINDS)


def downgrade() -> None:
    op.execute("DELETE FROM fantasy.activity_events WHERE kind = 'draft_time_set'")
    _set_kind_constraint(OLD_KINDS)
