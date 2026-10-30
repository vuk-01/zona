from __future__ import annotations

from datetime import date, datetime
from enum import StrEnum
from typing import TYPE_CHECKING

from sqlalchemy import (
    TIMESTAMP,
    CheckConstraint,
    Date,
    ForeignKey,
    Index,
    Numeric,
    SmallInteger,
    String,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base

if TYPE_CHECKING:
    from app.spaces.models.space import Space
    from app.users.models.user import User


class BookingStatus(StrEnum):
    """The stored status. `finished` and `expired` are derived on read from `ends_at`, never stored."""

    PENDING = "pending"
    CONFIRMED = "confirmed"
    DECLINED = "declined"
    CANCELLED = "cancelled"


_STATUS_LIST = ", ".join(f"'{status.value}'" for status in BookingStatus)


class Booking(Base):
    __tablename__ = "bookings"
    # Invariants live in the database, so they hold no matter which code writes the row (ADR-007).
    # The capacity per hour is a rule across rows that no constraint can hold: confirm keeps it
    # under a lock on the space row (ADR-023).
    __table_args__ = (
        CheckConstraint("start_hour >= 0 AND start_hour <= 23", name="start_hour_in_range"),
        CheckConstraint("end_hour >= 1 AND end_hour <= 24", name="end_hour_in_range"),
        CheckConstraint("end_hour > start_hour", name="end_after_start"),
        CheckConstraint("total_price >= 0", name="total_price_not_negative"),
        CheckConstraint(f"status IN ({_STATUS_LIST})", name="status_known"),
        # The overlap count reads one space on one date.
        Index(None, "space_id", "date"),
        # Without AUTOINCREMENT SQLite gives a new row the id of the deleted last row, so a request
        # that names a booking by its id could reach another booking. Postgres sequences never
        # repeat an id and ignore this option (ADR-024).
        {"sqlite_autoincrement": True},
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    space_id: Mapped[int] = mapped_column(ForeignKey("spaces.id", ondelete="CASCADE"), index=True)
    # Always the signed-in user, taken from the token (ADR-006).
    guest_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    # Wall-clock time in Europe/Podgorica: the local date and whole hours, `end_hour = 24` is
    # midnight (ADR-022).
    date: Mapped[date] = mapped_column(Date)
    start_hour: Mapped[int] = mapped_column(SmallInteger)
    end_hour: Mapped[int] = mapped_column(SmallInteger)
    # pricePerHour x hours at the moment of booking; never recomputed. asdecimal=False: JSON numbers.
    total_price: Mapped[float] = mapped_column(Numeric(7, 2, asdecimal=False))
    status: Mapped[str] = mapped_column(String(10))
    # Internal: `date` + `end_hour` in Podgorica as UTC, so SQL can derive finished/expired (ADR-022).
    ends_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), server_default=func.now()
    )

    space: Mapped[Space] = relationship("Space", back_populates="bookings")
    guest: Mapped[User] = relationship("User", back_populates="bookings")
