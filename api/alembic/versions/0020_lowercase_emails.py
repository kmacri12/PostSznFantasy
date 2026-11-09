"""lowercase emails

Login now stores the email from the verified token, lowercased (#320).

Revision ID: 0020_lowercase_emails
Revises: 0019_avatars
Create Date: 2026-11-09 10:00:00

"""

from collections.abc import Sequence

from alembic import op

revision: str = "0020_lowercase_emails"
down_revision: str | Sequence[str] | None = "0019_avatars"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("UPDATE fantasy.users SET email = lower(email) WHERE email IS NOT NULL")


def downgrade() -> None:
    pass
