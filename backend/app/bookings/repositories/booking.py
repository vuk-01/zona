from __future__ import annotations

from collections import Counter
from collections.abc import Collection
from datetime import UTC, date, datetime
from typing import Protocol

from sqlalchemy import ColumnElement, case, delete, func, or_, select, update
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

    def confirmed_at(self, space_ids: Collection[int], day: date, hour: int) -> dict[int, int]: ...

    def booking_counts(
        self, space_ids: Collection[int], now: datetime
    ) -> dict[int, tuple[int, int]]: ...

    def set_status(self, booking: Booking, new: str) -> bool: ...

    def get_status(self, booking: Booking) -> str | None: ...

    def delete_pending(self, booking: Booking) -> bool: ...

    def confirmed_per_date_and_hour(
        self, space_id: int, first_day: date, last_day: date
    ) -> dict[tuple[date, int], int]: ...


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

    def confirmed_at(self, space_ids: Collection[int], day: date, hour: int) -> dict[int, int]:
        """Confirmed bookings per space that cover the local `hour` of `day`: `{7: 2}`.

        One query for a whole page of spaces, never one per space (ADR-027); a space without
        such a booking is not in the result.
        """
        if not space_ids:
            return {}
        db = self._session_factory()
        rows = db.execute(
            select(Booking.space_id, func.count())
            .where(
                Booking.space_id.in_(space_ids),
                Booking.date == day,
                Booking.status == BookingStatus.CONFIRMED,
                # The slot is [start, end): 10:00-12:00 covers 10 and 11, not 12.
                Booking.start_hour <= hour,
                Booking.end_hour > hour,
            )
            .group_by(Booking.space_id)
        )
        return dict(rows.tuples().all())

    def booking_counts(
        self, space_ids: Collection[int], now: datetime
    ) -> dict[int, tuple[int, int]]:
        """`(active, pending)` per space: active is `pending` or `confirmed` as returned at `now`.

        The status as returned, so a booking whose slot has ended (`finished`, `expired`) is not
        active; one that is under way still is. One query for a whole page of spaces (ADR-027); a
        space without active bookings is not in the result.
        """
        if not space_ids:
            return {}
        db = self._session_factory()
        returned = _returned_status(now)
        rows = db.execute(
            select(
                Booking.space_id,
                func.count(),
                func.sum(case((returned == BookingReturnedStatus.PENDING, 1), else_=0)),
            )
            .where(
                Booking.space_id.in_(space_ids),
                returned.in_((BookingReturnedStatus.PENDING, BookingReturnedStatus.CONFIRMED)),
            )
            .group_by(Booking.space_id)
        )
        return {space_id: (active, int(pending)) for space_id, active, pending in rows.tuples()}

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

    def confirmed_per_date_and_hour(
        self, space_id: int, first_day: date, last_day: date
    ) -> dict[tuple[date, int], int]:
        """Confirmed bookings of one space per local date and hour, `first_day` to `last_day` inclusive.

        `{(date(2026, 10, 5), 10): 2}` = two at 10:00-11:00 that day; the same count as
        `confirmed_per_hour`, over a range of dates.
        """
        db = self._session_factory()
        query = select(Booking.date, Booking.start_hour, Booking.end_hour).where(
            Booking.space_id == space_id,
            Booking.date >= first_day,
            Booking.date <= last_day,
            Booking.status == BookingStatus.CONFIRMED,
        )
        taken: Counter[tuple[date, int]] = Counter()
        for day, start_hour, end_hour in db.execute(query):
            taken.update((day, hour) for hour in range(start_hour, end_hour))
        return dict(taken)


def _same_booking(booking: Booking) -> tuple[ColumnElement[bool], ...]:
    """The row that was read, not whichever row has its id now.

    `bookings` never hands out an id twice (`sqlite_autoincrement`, ADR-024); this match also covers
    a row that comes back under the same id some other way (an insert with an explicit id).
    `guest_id` and `space_id` never change, so together with the id they name the booking that was
    read.
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
