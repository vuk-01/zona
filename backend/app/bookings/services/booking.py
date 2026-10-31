from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
from typing import NoReturn, Protocol

from sqlalchemy.exc import IntegrityError

from app.auth.exceptions.auth import InvalidTokenException
from app.auth.schemas.auth import CurrentUser
from app.bookings.exceptions.booking import (
    BookingInPastException,
    BookingNotFoundException,
    BookingTooFarAheadException,
    CannotBookOwnSpaceException,
    InvalidSlotException,
    InvalidStatusChangeException,
    NotBookingGuestException,
    NotBookingHostException,
    NotBookingParticipantException,
    NotOwnBookingsException,
    SlotFullException,
)
from app.bookings.models.booking import Booking, BookingStatus
from app.bookings.repositories.booking import IBookingRepository
from app.bookings.schemas.booking import (
    POPULAR_FIRST_HOUR,
    POPULAR_HOURS,
    AvailabilityResponseSchema,
    BookingCreateRequestSchema,
    BookingGuestSchema,
    BookingListFilters,
    BookingResponseSchema,
    BookingReturnedStatus,
    BookingSpaceSchema,
    BookingUpdateRequestSchema,
    PopularDaysSchema,
    PopularTimesResponseSchema,
)
from app.spaces.exceptions.space import SpaceNotFoundException
from app.spaces.repositories.space import ISpaceRepository
from app.spaces.schemas.space import SpaceResponseSchema
from app.spaces.services.space import ISpaceService
from app.users.repositories.user import IUserRepository
from app.utils.clock import (
    LOCAL_TIMEZONE,
    WEEKDAYS,
    IClock,
    hour_exists,
    local_hour_to_utc,
)
from app.utils.di import inject
from app.utils.pagination import Page, PaginationParams

# How far ahead a guest can book: a date at most this many days after today (docs/entities.md).
BOOKING_DAYS_AHEAD = 365
# Popular times: a space younger than this has no popular times yet, and the average covers at
# most the last 8 weeks (docs/entities.md).
# At least 8 days: a shorter minimum can leave a weekday with no dates, and its average divides by 0.
POPULAR_MIN_AGE = timedelta(days=14)
POPULAR_WINDOW_DAYS = 56


class IBookingService(Protocol):
    def list(
        self,
        filters: BookingListFilters,
        pagination_params: PaginationParams,
        current_user: CurrentUser,
    ) -> Page[BookingResponseSchema]: ...

    def get(self, booking_id: int, current_user: CurrentUser) -> BookingResponseSchema: ...

    def update(
        self, booking_id: int, data: BookingUpdateRequestSchema, current_user: CurrentUser
    ) -> BookingResponseSchema: ...

    def delete(self, booking_id: int, current_user: CurrentUser) -> None: ...

    def create(
        self, data: BookingCreateRequestSchema, current_user: CurrentUser
    ) -> BookingResponseSchema: ...

    def availability(
        self, data: BookingCreateRequestSchema, current_user: CurrentUser | None
    ) -> AvailabilityResponseSchema: ...

    def popular_times(
        self, space_id: int, current_user: CurrentUser | None
    ) -> PopularTimesResponseSchema | None: ...


@inject(alias=IBookingService)
class BookingService(IBookingService):
    def __init__(
        self,
        booking_repository: IBookingRepository,
        space_service: ISpaceService,
        space_repository: ISpaceRepository,
        user_repository: IUserRepository,
        clock: IClock,
    ) -> None:
        self._booking_repository = booking_repository
        self._space_service = space_service
        self._space_repository = space_repository
        self._user_repository = user_repository
        self._clock = clock

    def list(
        self,
        filters: BookingListFilters,
        pagination_params: PaginationParams,
        current_user: CurrentUser,
    ) -> Page[BookingResponseSchema]:
        # `guestId` and `hostId` narrow the list to one role, and only to the user's own.
        for own_id in (filters.guest_id, filters.host_id):
            if own_id is not None and own_id != current_user.id:
                raise NotOwnBookingsException
        # One "now" for the filter in SQL and for the statuses in the response.
        now = self._clock.now()
        bookings = self._booking_repository.get_all(
            user_id=current_user.id,
            filters=filters,
            now=now,
            pagination_params=pagination_params,
        )
        return Page(
            total=bookings.total,
            items=[_to_response(booking, now) for booking in bookings.items],
            pages=bookings.pages,
        )

    def get(self, booking_id: int, current_user: CurrentUser) -> BookingResponseSchema:
        booking = self._get_as_participant_or_raise(booking_id, current_user)
        return _to_response(booking, self._clock.now())

    def update(
        self, booking_id: int, data: BookingUpdateRequestSchema, current_user: CurrentUser
    ) -> BookingResponseSchema:
        change = BookingStatus(data.status)
        if change == BookingStatus.CONFIRMED:
            # Only the host may confirm, and anyone else is 403 before the lock, so they never
            # hold the space (on SQLite the whole database). The guest, the space and its host
            # never change, so the check cannot go stale before the lock (ADR-024).
            participants = self._booking_repository.get_participants(booking_id)
            if participants is None:
                raise BookingNotFoundException
            guest_id, host_id = participants
            if current_user.id not in (guest_id, host_id):
                raise NotBookingParticipantException
            if current_user.id != host_id:
                raise NotBookingHostException
            # Confirming takes room: the space lock comes before the booking is read, so the read
            # and the count below see every confirm that committed first (ADR-023).
            if self._space_repository.lock_for_booking(booking_id) is None:
                raise BookingNotFoundException
        booking = self._get_as_participant_or_raise(booking_id, current_user)
        # Cancelling is for the guest and the host; everything else only for the host.
        if change != BookingStatus.CANCELLED and current_user.id != booking.space.host_id:
            raise NotBookingHostException
        now = self._clock.now()
        error = _status_change_error(_returned_status(booking, now), change)
        if error is not None:
            raise error
        if change == BookingStatus.CONFIRMED:
            # Under the lock: the count is the truth. This booking is still pending, so it is
            # not counted, and `exclude_id` keeps it that way.
            self._raise_if_full(
                space_id=booking.space_id,
                desk_count=booking.space.desk_count,
                day=booking.date,
                start_hour=booking.start_hour,
                end_hour=booking.end_hour,
                exclude_id=booking.id,
            )
        # Compare-and-set; declining and cancelling take no room, so they run without the lock.
        # It also guards confirm: on Postgres a parallel cancel does not wait for the space lock.
        if not self._booking_repository.set_status(booking, new=change):
            self._raise_lost_race(booking, change)
        # The UPDATE also set the new status on `booking` in the session.
        return _to_response(booking, now)

    def delete(self, booking_id: int, current_user: CurrentUser) -> None:
        booking = self._get_as_participant_or_raise(booking_id, current_user)
        if current_user.id != booking.guest_id:
            raise NotBookingGuestException
        if _returned_status(booking, self._clock.now()) != BookingReturnedStatus.PENDING:
            raise InvalidStatusChangeException.only_from(_PENDING, "deleted")
        if not self._booking_repository.delete_pending(booking):
            # Deleted or changed by a parallel request after the read: read again, never assume.
            if self._booking_repository.get_status(booking) is None:
                raise BookingNotFoundException
            raise InvalidStatusChangeException.only_from(_PENDING, "deleted")

    def _get_as_participant_or_raise(self, booking_id: int, current_user: CurrentUser) -> Booking:
        booking = self._booking_repository.get_by_id(booking_id)
        if booking is None:
            raise BookingNotFoundException
        if current_user.id not in (booking.guest_id, booking.space.host_id):
            raise NotBookingParticipantException
        return booking

    def _raise_lost_race(self, booking: Booking, change: BookingStatus) -> NoReturn:
        """The compare-and-set changed no row: the booking was deleted or changed after the read."""
        status = self._booking_repository.get_status(booking)
        if status is None:
            raise BookingNotFoundException
        raise _status_change_error(
            BookingReturnedStatus(status), change
        ) or InvalidStatusChangeException.changed_meanwhile(status)

    def create(
        self, data: BookingCreateRequestSchema, current_user: CurrentUser
    ) -> BookingResponseSchema:
        # Only a space the user can view: 404 for an unknown id or someone else's draft.
        space = self._space_service.get(space_id=data.space_id, current_user=current_user)
        if space.host.id == current_user.id:
            raise CannotBookOwnSpaceException
        now = self._clock.now()
        start_hour, end_hour = _checked_slot(space, data, now)
        # Advice only: a pending booking takes no room, confirm checks again under the lock (ADR-023).
        self._raise_if_full(
            space_id=space.id,
            desk_count=space.desk_count,
            day=data.date,
            start_hour=start_hour,
            end_hour=end_hour,
        )
        # The guest is always the signed-in user, never an id from the request body (ADR-006).
        booking = Booking(
            space_id=space.id,
            guest_id=current_user.id,
            date=data.date,
            start_hour=start_hour,
            end_hour=end_hour,
            total_price=round(space.price_per_hour * (end_hour - start_hour), 2),
            status=BookingStatus.PENDING,
            ends_at=local_hour_to_utc(data.date, end_hour),
        )
        try:
            booking = self._booking_repository.add(booking)
        except IntegrityError as e:
            # Every CHECK has a Pydantic twin; what is left are the two foreign keys (ADR-019).
            # exists(), not get_by_id(): a query every time, never an answer from the identity map.
            if not self._user_repository.exists(current_user.id):
                raise InvalidTokenException from e  # the account was deleted meanwhile
            if not self._space_repository.exists(data.space_id):
                raise SpaceNotFoundException from e  # the space was deleted meanwhile
            raise  # both exist: a rule Pydantic lets through, a bug, not a client error
        return _to_response(booking, now)

    def availability(
        self, data: BookingCreateRequestSchema, current_user: CurrentUser | None
    ) -> AvailabilityResponseSchema:
        # The checks of POST and the count of confirm, so the answer is what confirm would say now
        # (ADR-028). Without the lock: advice, like POST. A host may ask about their own space.
        space = self._space_service.get(space_id=data.space_id, current_user=current_user)
        start_hour, end_hour = _checked_slot(space, data, self._clock.now())
        free, full_at = self._free_units(
            space_id=space.id,
            desk_count=space.desk_count,
            day=data.date,
            start_hour=start_hour,
            end_hour=end_hour,
        )
        has_desks = space.desk_count is not None
        return AvailabilityResponseSchema(
            available=full_at is None,
            free_desks=free if has_desks else None,
            message=(
                None
                if full_at is None
                else SlotFullException.at(_hh_mm(full_at), has_desks=has_desks).message
            ),
        )

    def _raise_if_full(
        self,
        space_id: int,
        desk_count: int | None,
        day: date,
        start_hour: int,
        end_hour: int,
        exclude_id: int | None = None,
    ) -> None:
        _, full_at = self._free_units(
            space_id=space_id,
            desk_count=desk_count,
            day=day,
            start_hour=start_hour,
            end_hour=end_hour,
            exclude_id=exclude_id,
        )
        if full_at is not None:
            raise SlotFullException.at(_hh_mm(full_at), has_desks=desk_count is not None)

    def _free_units(
        self,
        space_id: int,
        desk_count: int | None,
        day: date,
        start_hour: int,
        end_hour: int,
        exclude_id: int | None = None,
    ) -> tuple[int, int | None]:
        """Units free in the busiest hour of the slot (never below 0), and the first full hour.

        One count for POST, confirm and availability, so they cannot disagree (ADR-028).
        """
        taken = self._booking_repository.confirmed_per_hour(
            space_id=space_id, day=day, exclude_id=exclude_id
        )
        # A database CHECK keeps desk_count NULL for every category but desk.
        units = desk_count or 1
        free = [units - taken.get(hour, 0) for hour in range(start_hour, end_hour)]
        full_at = next((start_hour + i for i, left in enumerate(free) if left <= 0), None)
        # A lowered deskCount can leave more confirmed bookings than desks (docs/follow-ups.md).
        return max(min(free), 0), full_at

    def popular_times(
        self, space_id: int, current_user: CurrentUser | None
    ) -> PopularTimesResponseSchema | None:
        # Only a space the user can view: 404 for an unknown id or someone else's draft.
        space = self._space_service.get(space_id=space_id, current_user=current_user)
        now = self._clock.now()
        # Not enough history yet: an absolute 14 days, both moments in UTC.
        if now - space.created_at < POPULAR_MIN_AGE:
            return None
        first_day, last_day = _popular_window(space.created_at, now)
        taken = self._booking_repository.confirmed_per_date_and_hour(
            space_id=space.id, first_day=first_day, last_day=last_day
        )
        return PopularTimesResponseSchema(days=_popular_days(space, taken, first_day, last_day))


def _checked_slot(
    space: SpaceResponseSchema, data: BookingCreateRequestSchema, now: datetime
) -> tuple[int, int]:
    """The slot checks of POST and availability, in the contract's order (ADR-028).

    The booking window, then the slot, then a start strictly after now; the caller has already
    checked that the user can view the space. Returns the slot as local hours.
    """
    # Before the slot: the time helpers cannot reach a date in year 1 or 9999 (OverflowError).
    _raise_if_outside_booking_window(data.date, now)
    start_hour, end_hour = _slot_hours(space, data)
    # A booking that starts exactly now has already started (ADR-022).
    if local_hour_to_utc(data.date, start_hour) <= now:
        raise BookingInPastException
    return start_hour, end_hour


def _raise_if_outside_booking_window(day: date, now: datetime) -> None:
    """From today to `BOOKING_DAYS_AHEAD` days ahead, today being the date in Podgorica now."""
    today = now.astimezone(LOCAL_TIMEZONE).date()
    # A day already gone is in the past whatever the space's hours that day (docs/entities.md).
    if day < today:
        raise BookingInPastException
    if day > today + timedelta(days=BOOKING_DAYS_AHEAD):
        raise BookingTooFarAheadException


def _slot_hours(space: SpaceResponseSchema, data: BookingCreateRequestSchema) -> tuple[int, int]:
    """The slot as local hours, or `invalid_slot` naming the first field at fault."""
    start_hour = _whole_hour(data.start_time, field="startTime")
    end_hour = _whole_hour(data.end_time, field="endTime")
    if end_hour <= start_hour:
        raise InvalidSlotException.end_not_after_start()
    hours = getattr(space.opening_hours, WEEKDAYS[data.date.weekday()])
    if hours is None:
        raise InvalidSlotException.closed(space.name)
    if start_hour < _hour(hours.open):
        raise InvalidSlotException.outside_opening_hours(
            space.name, hours.open, hours.close, field="startTime"
        )
    if end_hour > _hour(hours.close):
        raise InvalidSlotException.outside_opening_hours(
            space.name, hours.open, hours.close, field="endTime"
        )
    # On the day the clocks go forward 02:00-03:00 does not exist (ADR-022).
    for hour in range(start_hour, end_hour):
        if not hour_exists(data.date, hour):
            field = "startTime" if hour == start_hour else "endTime"
            raise InvalidSlotException.hour_does_not_exist(_hh_mm(hour), field=field)
    return start_hour, end_hour


def _whole_hour(time: str, field: str) -> int:
    """`"10:00"` -> 10; the schema already checked the `HH:mm` shape."""
    if not time.endswith(":00"):
        raise InvalidSlotException.not_whole_hour(field)
    return _hour(time)


def _hour(time: str) -> int:
    return int(time[:2])


def _hh_mm(hour: int) -> str:
    return f"{hour:02d}:00"


def _popular_window(created_at: datetime, now: datetime) -> tuple[date, date]:
    """The local dates popular times average over: yesterday back to 8 weeks, only whole days.

    Today is left out (its hours have not all passed) and so is the day the space was created
    (its earlier hours could not be booked). Dates, not datetimes: a DST change inside the window
    does not move it (ADR-022).
    """
    today = now.astimezone(LOCAL_TIMEZONE).date()
    created = created_at.astimezone(LOCAL_TIMEZONE).date()
    first_day = max(today - timedelta(days=POPULAR_WINDOW_DAYS), created + timedelta(days=1))
    return first_day, today - timedelta(days=1)


def _popular_days(
    space: SpaceResponseSchema,
    taken: dict[tuple[date, int], int],
    first_day: date,
    last_day: date,
) -> PopularDaysSchema:
    """Per weekday and hour: taken units / units, averaged over that weekday's dates, 0-100."""
    # A database CHECK keeps desk_count NULL for every category but desk.
    units = space.desk_count or 1
    dates_by_weekday: dict[str, list[date]] = {weekday: [] for weekday in WEEKDAYS}
    day = first_day
    while day <= last_day:
        dates_by_weekday[WEEKDAYS[day.weekday()]].append(day)
        day += timedelta(days=1)

    days: dict[str, list[int] | None] = {}
    for weekday, dates in dates_by_weekday.items():
        # The current opening hours decide, as on the space page.
        hours = getattr(space.opening_hours, weekday)
        if hours is None:
            days[weekday] = None
            continue
        values = []
        for hour in range(POPULAR_FIRST_HOUR, POPULAR_FIRST_HOUR + POPULAR_HOURS):
            if not _hour(hours.open) <= hour < _hour(hours.close):
                values.append(0)
                continue
            # Capped at the units: a lowered deskCount must not show more than 100.
            booked = sum(min(taken.get((d, hour), 0), units) for d in dates)
            values.append(_percent(booked, units * len(dates)))
        days[weekday] = values
    return PopularDaysSchema.model_validate(days)


def _percent(part: int, whole: int) -> int:
    """`100 * part / whole` rounded half up, in integers: 12.5 -> 13, as the frontend's Math.round.

    Not round(): it rounds half to even (round(12.5) == 12).
    """
    return (200 * part + whole) // (2 * whole)


# The statuses each change may start from (docs/entities.md, status flow).
_PENDING = (BookingReturnedStatus.PENDING,)
_ALLOWED_FROM: dict[BookingStatus, tuple[BookingReturnedStatus, ...]] = {
    BookingStatus.CONFIRMED: _PENDING,
    BookingStatus.DECLINED: _PENDING,
    BookingStatus.CANCELLED: (BookingReturnedStatus.PENDING, BookingReturnedStatus.CONFIRMED),
}


def _status_change_error(
    current: BookingReturnedStatus, change: BookingStatus
) -> InvalidStatusChangeException | None:
    """Why `current` cannot become `change`, or None when the flow allows it."""
    # The same status again is an error, not a no-op (docs/entities.md).
    if current == BookingReturnedStatus(change):
        return InvalidStatusChangeException.again(current)
    allowed = _ALLOWED_FROM[change]
    if current not in allowed:
        return InvalidStatusChangeException.only_from(allowed, change)
    return None


def _returned_status(booking: Booking, now: datetime) -> BookingReturnedStatus:
    """`finished` / `expired` once the slot has ended; the stored status never changes for it."""
    # SQLite returns naive datetimes (UTC), Postgres aware ones.
    ends_at = booking.ends_at
    if ends_at.tzinfo is None:
        ends_at = ends_at.replace(tzinfo=UTC)
    if ends_at <= now:
        if booking.status == BookingStatus.CONFIRMED:
            return BookingReturnedStatus.FINISHED
        if booking.status == BookingStatus.PENDING:
            return BookingReturnedStatus.EXPIRED
    return BookingReturnedStatus(booking.status)


def _to_response(booking: Booking, now: datetime) -> BookingResponseSchema:
    # Called inside the request, before the endpoint's session handler commits: `space` and
    # `guest` load from the open session (`space` straight from the identity map).
    return BookingResponseSchema(
        id=booking.id,
        space_id=booking.space_id,
        space=BookingSpaceSchema(
            id=booking.space.id,
            name=booking.space.name,
            address=booking.space.address,
            host_id=booking.space.host_id,
            image_url=booking.space.images[0] if booking.space.images else None,
        ),
        guest=BookingGuestSchema.model_validate(booking.guest),
        date=booking.date,
        start_time=_hh_mm(booking.start_hour),
        end_time=_hh_mm(booking.end_hour),
        total_price=booking.total_price,
        status=_returned_status(booking, now),
        created_at=booking.created_at,
    )
