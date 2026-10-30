from __future__ import annotations

from collections import Counter
from datetime import UTC, date, datetime
from typing import Protocol

from sqlalchemy import ColumnElement, case, delete, or_, select, update
from sqlalchemy.orm import contains_eager, joinedload

from app.bookings.models.booking import Booking, BookingStatus
from app.bookings.schemas.booking import BookingListFilters, BookingReturnedStatus
from app.database.session_factory import ISessionFactory
from app.spaces.models.space import Space
from app.utils.di import inject
from app.utils.pagination import Page, PaginationParams, paginate


class IBookingRepository(Protocol):
    def get_all(
        self,
        user_id: int,
        filters: BookingListFilters,
        now: datetime,
        pagination_params: PaginationParams,
    ) -> Page[Booking]: ...

    def get_by_id(self, booking_id: int) -> Booking | None: ...

    def get_participants(self, booking_id: int) -> tuple[int, int] | None: ...

    def add(self, booking: Booking) -> Booking: ...

    def confirmed_per_hour(
        self, space_id: int, day: date, exclude_id: int | None = None
    ) -> dict[int, int]: ...

    def set_status(self, booking: Booking, new: str) -> bool: ...

    def get_status(self, booking: Booking) -> str | None: ...

    def delete_pending(self, booking: Booking) -> bool: ...


@inject(alias=IBookingRepository)
class BookingRepository(IBookingRepository):
    def __init__(self, session_factory: ISessionFactory) -> None:
        self._session_factory = session_factory

    def get_all(
        self,
        user_id: int,
        filters: BookingListFilters,
        now: datetime,
        pagination_params: PaginationParams,
    ) -> Page[Booking]:
        db = self._session_factory()
        # Another domain's table in the same query (ADR-020): only bookings the user takes part
        # in, as the guest or as the space's host. Not filtered by whether the space is listed:
        # a guest keeps seeing a booking after the host turns the space into a draft.
        # Earliest first; `id` breaks the tie between two bookings of the same slot.
        query = (
            select(Booking)
            .join(Booking.space)
            .where(or_(Booking.guest_id == user_id, Space.host_id == user_id))
            .options(contains_eager(Booking.space), joinedload(Booking.guest))
            .order_by(Booking.date, Booking.start_hour, Booking.id)
        )
        if filters.space_id is not None:
            query = query.where(Booking.space_id == filters.space_id)
        if filters.guest_id is not None:
            query = query.where(Booking.guest_id == filters.guest_id)
        if filters.host_id is not None:
            query = query.where(Space.host_id == filters.host_id)
        if filters.date is not None:
            query = query.where(Booking.date == filters.date)
        if filters.status is not None:
            query = query.where(_returned_status(now) == filters.status)
        return paginate(query=query, pagination_params=pagination_params, db=db)

    def get_by_id(self, booking_id: int) -> Booking | None:
        db = self._session_factory()
        return db.get(
            Booking, booking_id, options=[joinedload(Booking.space), joinedload(Booking.guest)]
        )

    def get_participants(self, booking_id: int) -> tuple[int, int] | None:
        """`(guest_id, host_id)` of a booking; None when the booking is gone."""
        db = self._session_factory()
        # Columns, not the Booking entity: nothing enters the identity map, so the read after the
        # space lock still loads the booking as the database has it then (ADR-024). Another
        # domain's table in the same query (ADR-020).
        row = db.execute(
            select(Booking.guest_id, Space.host_id)
            .join(Booking.space)
            .where(Booking.id == booking_id)
        ).one_or_none()
        if row is None:
            return None
        return row.guest_id, row.host_id

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

    def set_status(self, booking: Booking, new: str) -> bool:
        """Compare-and-set: False when the row is gone or no longer has the status it was read with."""
        db = self._session_factory()
        # One statement, so no other request can change the status between the check and the
        # write; the service reads again to tell a deleted row from a changed one (ADR-023).
        # "fetch": only the row RETURNING names gets the new status in the session. The default
        # ("auto") evaluated the WHERE in Python here and set it on the loaded booking even when
        # the database changed no row.
        updated_id = db.execute(
            update(Booking)
            .where(*_same_booking(booking), Booking.status == booking.status)
            .values(status=new)
            .returning(Booking.id)
            .execution_options(synchronize_session="fetch")
        ).scalar_one_or_none()
        return updated_id is not None

    def get_status(self, booking: Booking) -> str | None:
        """The stored status as the database has it now; None when the row is gone."""
        db = self._session_factory()
        # A select(), not db.get(): the booking read earlier in the request is in the identity
        # map with the status it had then.
        return db.scalar(select(Booking.status).where(*_same_booking(booking)))

    def delete_pending(self, booking: Booking) -> bool:
        """False when the row is gone or no longer pending (deleted or changed by a parallel request)."""
        db = self._session_factory()
        # "fetch", as in set_status: the loaded booking leaves the session only if the row went.
        deleted_id = db.execute(
            delete(Booking)
            .where(*_same_booking(booking), Booking.status == BookingStatus.PENDING)
            .returning(Booking.id)
            .execution_options(synchronize_session="fetch")
        ).scalar_one_or_none()
        return deleted_id is not None


def _same_booking(booking: Booking) -> tuple[ColumnElement[bool], ...]:
    """The row that was read, not whichever row has its id now.

    SQLite gives a new row the id of the deleted last row (no AUTOINCREMENT), so a booking deleted
    after the read can come back as someone else's under the same id; `guest_id` and `space_id`
    never change, so together with the id they name the booking that was read (ADR-024).
    """
    return (
        Booking.id == booking.id,
        Booking.guest_id == booking.guest_id,
        Booking.space_id == booking.space_id,
    )


def _returned_status(now: datetime) -> ColumnElement[str]:
    """The status as returned, in SQL: what the service computes in Python for each row.

    `now` comes from `IClock`, never `func.now()` (ADR-022); in UTC, because SQLite compares the
    stored `ends_at` as text.
    """
    ended = Booking.ends_at <= now.astimezone(UTC)
    return case(
        (ended & (Booking.status == BookingStatus.CONFIRMED), BookingReturnedStatus.FINISHED),
        (ended & (Booking.status == BookingStatus.PENDING), BookingReturnedStatus.EXPIRED),
        else_=Booking.status,
    )
