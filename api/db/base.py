from typing import Any

from sqlalchemy import inspect
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Base declarative class for all SQLAlchemy 2.0 ORM models."""

    def to_dict(self) -> dict[str, Any]:
        """Convert SQLAlchemy model attributes to a dictionary."""
        return {c.key: getattr(self, c.key) for c in inspect(self).mapper.column_attrs}
