"""chat polish

Chat reactions, replies, @mentions and edits (#396): the reactions table, a reply link,
an edited stamp and the tagged members on `league_messages`, and the mention push
preference.

Revision ID: 0028_chat_polish
Revises: 0027_player_alerts
Create Date: 2026-11-11 15:00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0028_chat_polish"
down_revision: str | Sequence[str] | None = "0027_player_alerts"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "league_messages",
        sa.Column("reply_to_id", sa.BigInteger(), nullable=True),
        schema="fantasy",
    )
    op.create_foreign_key(
        "fk_league_messages_reply_to_id",
        "league_messages",
        "league_messages",
        ["reply_to_id"],
        ["id"],
        source_schema="fantasy",
        referent_schema="fantasy",
        ondelete="SET NULL",
    )
    op.add_column(
        "league_messages",
        sa.Column("edited_at", sa.DateTime(timezone=True), nullable=True),
        schema="fantasy",
    )
    op.add_column(
        "league_messages",
        sa.Column(
            "mentioned_user_ids",
            postgresql.ARRAY(sa.Integer()),
            nullable=False,
            server_default=sa.text("'{}'"),
        ),
        schema="fantasy",
    )
    op.add_column(
        "users",
        sa.Column(
            "push_mentions", sa.Boolean(), nullable=False, server_default=sa.true()
        ),
        schema="fantasy",
    )
    op.create_table(
        "message_reactions",
        sa.Column("message_id", sa.BigInteger(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("emoji", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["message_id"], ["fantasy.league_messages.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["user_id"], ["fantasy.users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("message_id", "user_id", "emoji"),
        schema="fantasy",
    )


def downgrade() -> None:
    op.drop_table("message_reactions", schema="fantasy")
    op.drop_column("users", "push_mentions", schema="fantasy")
    op.drop_column("league_messages", "mentioned_user_ids", schema="fantasy")
    op.drop_column("league_messages", "edited_at", schema="fantasy")
    op.drop_constraint(
        "fk_league_messages_reply_to_id",
        "league_messages",
        schema="fantasy",
        type_="foreignkey",
    )
    op.drop_column("league_messages", "reply_to_id", schema="fantasy")
