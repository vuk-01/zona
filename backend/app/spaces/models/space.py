from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING

from sqlalchemy import (
    JSON,
    TIMESTAMP,
    CheckConstraint,
    ColumnElement,
    ForeignKey,
    Numeric,
    String,
    Text,
    func,
    or_,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base

if TYPE_CHECKING:
    from app.favorites.models.favorite import Favorite
    from app.users.models.user import User


class SpaceCategory(StrEnum):
    DESK = "desk"
    MEETING_ROOM = "meeting-room"
    OFFICE = "office"
    EVENT_HALL = "event-hall"


class SpaceStatus(StrEnum):
    LISTED = "listed"
    DRAFT = "draft"


_CATEGORY_LIST = ", ".join(f"'{category.value}'" for category in SpaceCategory)
_STATUS_LIST = ", ".join(f"'{status.value}'" for status in SpaceStatus)

# {"mon": {"open": "08:00", "close": "20:00"}, ..., "sun": None}; local time in Europe/Podgorica.
OpeningHours = dict[str, dict[str, str] | None]


class Space(Base):
    __tablename__ = "spaces"
    # Invariants live in the database, so they hold no matter which code writes the row (ADR-007).
    # The JSON columns (images, opening_hours) are checked by Pydantic only: JSON functions differ
    # between SQLite and Postgres (ADR-003).
    __table_args__ = (
        CheckConstraint("price_per_hour > 0 AND price_per_hour <= 1000", name="price_in_range"),
        CheckConstraint("capacity >= 1 AND capacity <= 1000", name="capacity_in_range"),
        CheckConstraint(f"category IN ({_CATEGORY_LIST})", name="category_known"),
        CheckConstraint(f"status IN ({_STATUS_LIST})", name="status_known"),
        # A desk space has 1..capacity desks; every other category has none.
        CheckConstraint(
            "(category = 'desk' AND desk_count IS NOT NULL AND desk_count >= 1"
            " AND desk_count <= capacity)"
            " OR (category <> 'desk' AND desk_count IS NULL)",
            name="desk_count_matches_category",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(80))
    # server_default too: a row written without the ORM still gets "" (ADR-007).
    description: Mapped[str] = mapped_column(Text, default="", server_default="")
    category: Mapped[str] = mapped_column(String(20))
    city: Mapped[str] = mapped_column(String(80))
    address: Mapped[str] = mapped_column(String(120))
    # asdecimal=False: the API speaks JSON numbers, not decimal strings.
    price_per_hour: Mapped[float] = mapped_column(Numeric(6, 2, asdecimal=False))
    capacity: Mapped[int]
    desk_count: Mapped[int | None]
    images: Mapped[list[str]] = mapped_column(JSON)
    opening_hours: Mapped[OpeningHours] = mapped_column(JSON)
    status: Mapped[str] = mapped_column(String(10))
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), server_default=func.now()
    )
    host_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)

    host: Mapped[User] = relationship("User", back_populates="spaces")
    # One-to-many: Space -> Favorite. Deleting a space deletes its favorites (ON DELETE CASCADE).
    favorites: Mapped[list[Favorite]] = relationship(
        "Favorite", back_populates="space", cascade="all, delete-orphan", passive_deletes=True
    )


def space_visible_to(viewer_id: int | None) -> ColumnElement[bool]:
    """Listed spaces for everyone, plus the viewer's own drafts; other people's drafts never.

    One rule for every query that returns spaces or rows about them (the spaces list, favorites):
    a repository of another domain imports it with the model (ADR-020).
    """
    if viewer_id is None:
        return Space.status == SpaceStatus.LISTED
    return or_(Space.status == SpaceStatus.LISTED, Space.host_id == viewer_id)
