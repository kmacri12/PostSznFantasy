from typing import TYPE_CHECKING

from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from api.db.base import Base

if TYPE_CHECKING:
    from api.db.models.league import Team


class User(Base):
    __tablename__ = "users"
    __table_args__ = {"schema": "fantasy"}

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    supabase_uid: Mapped[str] = mapped_column(String(128), unique=True, nullable=False)
    username: Mapped[str] = mapped_column(String(20), nullable=False)
    email: Mapped[str | None] = mapped_column(String(120), unique=True, nullable=True)
    # Key of the profile picture in the avatar store (services/avatars.py); None = initials.
    avatar_key: Mapped[str | None] = mapped_column(String(32), nullable=True)

    teams_owned: Mapped[list["Team"]] = relationship(
        "Team", back_populates="owner", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<User {self.username}>"
