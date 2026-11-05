"""league_messages

Feed chat: the `league_messages` table, the newest message each member has seen
(`activity_views.last_message_id`, so one dot covers events and messages), and four
draft activity kinds (order randomized, order changed, draft started, completed).

Revision ID: 0017_league_messages
Revises: 0016_membership_activity
Create Date: 2026-11-04 12:00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0017_league_messages"
down_revision: str | Sequence[str] | None = "0016_membership_activity"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

OLD_KINDS = (
    "'lineup_move', 'commissioner_override', 'stat_correction', 'settings_change', "
    "'league_created', 'membership_joined', 'membership_left', 'role_changed'"
)
NEW_KINDS = (
    "'draft_order_randomized', 'draft_order_changed', 'draft_started', "
    "'draft_completed'"
)


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
    op.create_table(
        "league_messages",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("league_id", sa.Integer(), nullable=False),
        sa.Column("season_id", sa.Integer(), nullable=False),
        sa.Column("author_user_id", sa.Integer(), nullable=True),
        sa.Column("author_name", sa.String(length=20), nullable=True),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("gif_url", sa.String(length=500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by", sa.Integer(), nullable=True),
        sa.CheckConstraint("char_length(body) <= 2000", name="ck_league_messages_body"),
        sa.CheckConstraint(
            "body <> '' OR gif_url IS NOT NULL", name="ck_league_messages_not_empty"
        ),
        sa.ForeignKeyConstraint(
            ["league_id"], ["fantasy.leagues.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["season_id"], ["fantasy.seasons.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["author_user_id"], ["fantasy.users.id"], ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(
            ["deleted_by"], ["fantasy.users.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
        schema="fantasy",
    )
    op.create_index(
        "ix_league_messages_season_id_id",
        "league_messages",
        ["season_id", "id"],
        schema="fantasy",
    )
    op.add_column(
        "activity_views",
        sa.Column(
            "last_message_id", sa.BigInteger(), nullable=False, server_default="0"
        ),
        schema="fantasy",
    )
    _set_kind_constraint(f"{OLD_KINDS}, {NEW_KINDS}")


def downgrade() -> None:
    op.execute(f"DELETE FROM fantasy.activity_events WHERE kind IN ({NEW_KINDS})")
    _set_kind_constraint(OLD_KINDS)
    op.drop_column("activity_views", "last_message_id", schema="fantasy")
    op.drop_index(
        "ix_league_messages_season_id_id",
        table_name="league_messages",
        schema="fantasy",
    )
    op.drop_table("league_messages", schema="fantasy")
