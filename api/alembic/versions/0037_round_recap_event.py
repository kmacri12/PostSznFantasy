"""round recap feed event

The weekly recap (the `round_recap` activity kind): posted to each league's feed once a
round is over, with the highlights stored in the payload.

Revision ID: 0037_round_recap_event
Revises: 0036_team_pictures
Create Date: 2026-11-24 14:00:00

"""

from collections.abc import Sequence

from alembic import op

revision: str = "0037_round_recap_event"
down_revision: str | Sequence[str] | None = "0036_team_pictures"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

OLD_KINDS = (
    "'lineup_move', 'commissioner_override', 'stat_correction', 'settings_change', "
    "'league_created', 'membership_joined', 'membership_left', 'role_changed', "
    "'draft_order_randomized', 'draft_order_changed', 'draft_started', "
    "'draft_completed', 'draft_pick_assigned', 'draft_time_set', 'announcement'"
)
NEW_KINDS = f"{OLD_KINDS}, 'round_recap'"


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
    op.execute("DELETE FROM fantasy.activity_events WHERE kind = 'round_recap'")
    _set_kind_constraint(OLD_KINDS)
