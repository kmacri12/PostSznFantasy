"""account center

The member's display preferences (#405): the time zone times are shown in (null follows
the browser) and a 12 or 24 hour clock (null follows the browser's locale).

Revision ID: 0029_account_center
Revises: 0028_chat_polish
Create Date: 2026-11-11 16:00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0029_account_center"
down_revision: str | Sequence[str] | None = "0028_chat_polish"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("display_time_zone", sa.String(64), nullable=True),
        schema="fantasy",
    )
    op.add_column(
        "users",
        sa.Column("hour_cycle", sa.String(2), nullable=True),
        schema="fantasy",
    )
    op.create_check_constraint(
        "ck_users_hour_cycle",
        "users",
        "hour_cycle IN ('12', '24')",
        schema="fantasy",
    )


def downgrade() -> None:
    op.drop_constraint("ck_users_hour_cycle", "users", schema="fantasy", type_="check")
    op.drop_column("users", "hour_cycle", schema="fantasy")
    op.drop_column("users", "display_time_zone", schema="fantasy")
