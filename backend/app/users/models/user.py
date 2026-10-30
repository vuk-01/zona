from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING

from sqlalchemy import TIMESTAMP, CheckConstraint, String, false, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base

if TYPE_CHECKING:
    from app.listings.models.listing import Listing
    from app.spaces.models.space import Space


class UserMode(StrEnum):
    GUEST = "guest"
    HOST = "host"


_MODE_LIST = ", ".join(f"'{mode.value}'" for mode in UserMode)


class User(Base):
    __tablename__ = "users"
    # Invariants live in the database, so they hold no matter which code writes the row (ADR-007).
    __table_args__ = (
        CheckConstraint(f"mode IN ({_MODE_LIST})", name="mode_known"),
        # Host mode only once hosting is turned on (docs/entities.md).
        CheckConstraint("mode = 'guest' OR is_host", name="host_mode_requires_is_host"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(254), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(128))
    name: Mapped[str] = mapped_column(String(60))
    # None: the app shows the user's initials instead of a photo.
    avatar_url: Mapped[str | None] = mapped_column(String(500))
    # server_default too: a row written without the ORM still gets "" (ADR-007).
    city: Mapped[str] = mapped_column(String(80), default="", server_default="")
    bio: Mapped[str] = mapped_column(String(200), default="", server_default="")
    # Becomes true the first time the user switches to host mode and stays true (docs/entities.md).
    is_host: Mapped[bool] = mapped_column(default=False, server_default=false())
    # The last mode the user chose; kept across logins.
    mode: Mapped[str] = mapped_column(
        String(10), default=UserMode.GUEST.value, server_default=UserMode.GUEST.value
    )
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), server_default=func.now()
    )

    # One-to-many: User -> Listing. Deleting a user deletes their listings (ON DELETE CASCADE).
    listings: Mapped[list[Listing]] = relationship(
        "Listing", back_populates="owner", cascade="all, delete-orphan", passive_deletes=True
    )
    # One-to-many: User -> Space. Deleting a user deletes the spaces they host (ON DELETE CASCADE).
    spaces: Mapped[list[Space]] = relationship(
        "Space", back_populates="host", cascade="all, delete-orphan", passive_deletes=True
    )
