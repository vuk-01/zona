from __future__ import annotations

from collections import Counter
from datetime import date
from typing import Protocol

from sqlalchemy import select

from app.bookings.models.booking import Booking, BookingStatus
from app.database.session_factory import ISessionFactory
from app.utils.di import inject


class IBookingRepository(Protocol):
    def add(self, booking: Booking) -> Booking: ...

    def confirmed_per_hour(
        self, space_id: int, day: date, exclude_id: int | None = None
    ) -> dict[int, int]: ...


@inject(alias=IBookingRepository)
class BookingRepository(IBookingRepository):
    def __init__(self, session_factory: ISessionFactory) -> None:
        self._session_factory = session_factory

    def add(self, booking: Booking) -> Booking:
        db = self._session_factory()
        # A SAVEPOINT: when the database refuses the row, only the savepoint rolls back and the
        # session stays usable, so the service can still find out which foreign key refused it.
        with db.begin_nested():
            db.add(booking)
            db.flush()  # assigns id and created_at; the endpoint's session handler commits (ADR-009)
        return booking

    def confirmed_per_hour(
        self, space_id: int, day: date, exclude_id: int | None = None
    ) -> dict[int, int]:
        """Confirmed bookings of one space per local hour of `day`: `{10: 2}` = two at 10:00-11:00.

        `exclude_id` leaves out the booking that is being confirmed.
        """
        db = self._session_factory()
        query = select(Booking.start_hour, Booking.end_hour).where(
            Booking.space_id == space_id,
            Booking.date == day,
            Booking.status == BookingStatus.CONFIRMED,
        )
        if exclude_id is not None:
            query = query.where(Booking.id != exclude_id)
        taken: Counter[int] = Counter()
        for start_hour, end_hour in db.execute(query):
            taken.update(range(start_hour, end_hour))
        return dict(taken)
