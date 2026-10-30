from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import TIMESTAMP, String, false, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base

if TYPE_CHECKING:
    from app.listings.models.listing import Listing
    from app.spaces.models.space import Space


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(254), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(128))
    display_name: Mapped[str] = mapped_column(String(60))
    # Becomes true the first time the user switches to host mode and stays true (docs/entities.md).
    is_host: Mapped[bool] = mapped_column(default=False, server_default=false())
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
