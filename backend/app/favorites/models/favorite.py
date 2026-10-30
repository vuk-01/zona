from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import TIMESTAMP, ForeignKey, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base

if TYPE_CHECKING:
    from app.spaces.models.space import Space
    from app.users.models.user import User


class Favorite(Base):
    """A space a user saved with the heart. The API knows it by `userId` + `spaceId`, never by `id`."""

    __tablename__ = "favorites"
    # A user saves a space at most once; the database decides, not a SELECT first (ADR-007).
    __table_args__ = (UniqueConstraint("user_id", "space_id"),)

    # Internal only: the tie-break for "newest saved first" when two rows share a `created_at`.
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    space_id: Mapped[int] = mapped_column(ForeignKey("spaces.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), server_default=func.now()
    )

    user: Mapped[User] = relationship("User", back_populates="favorites")
    space: Mapped[Space] = relationship("Space", back_populates="favorites")
