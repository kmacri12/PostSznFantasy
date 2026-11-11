from datetime import UTC, datetime

from sqlalchemy import Boolean, DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from api.db.base import Base


class FeatureFlag(Base):
    """An owner-controlled kill switch. A missing row means the flag's default
    (services.feature_flags.DEFAULTS), so the table starts empty."""

    __tablename__ = "feature_flags"
    __table_args__ = {"schema": "fantasy"}

    key: Mapped[str] = mapped_column(String(40), primary_key=True)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC)
    )
