"""merge the two 0020 heads

Lowercase emails (#320) and settings bounds (#322) merged in parallel, both on top of 0019.

Revision ID: 0021_merge_0020_heads
Revises: 0020_lowercase_emails, 0020_settings_bounds
Create Date: 2026-11-09 12:00:00

"""

from collections.abc import Sequence

revision: str = "0021_merge_0020_heads"
down_revision: str | Sequence[str] | None = (
    "0020_lowercase_emails",
    "0020_settings_bounds",
)
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
