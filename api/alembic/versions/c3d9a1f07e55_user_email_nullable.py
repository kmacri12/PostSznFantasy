"""user_email_nullable

Revision ID: c3d9a1f07e55
Revises: b7c1e4d92a10
Create Date: 2026-10-28 13:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "c3d9a1f07e55"
down_revision: str | Sequence[str] | None = "b7c1e4d92a10"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column(
        "users", "email", existing_type=sa.String(120), nullable=True, schema="fantasy"
    )


def downgrade() -> None:
    op.alter_column(
        "users", "email", existing_type=sa.String(120), nullable=False, schema="fantasy"
    )
