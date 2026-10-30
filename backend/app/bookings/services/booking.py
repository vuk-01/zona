from __future__ import annotations

from datetime import UTC, date, datetime
from typing import Protocol

from sqlalchemy.exc import IntegrityError

from app.auth.exceptions.auth import InvalidTokenException
from app.auth.schemas.auth import CurrentUser
from app.bookings.exceptions.booking import (
    BookingInPastException,
    CannotBookOwnSpaceException,
    InvalidSlotException,
    SlotFullException,
)
from app.bookings.models.booking import Booking, BookingStatus
from app.bookings.repositories.booking import IBookingRepository
from app.bookings.schemas.booking import (
    BookingCreateRequestSchema,
    BookingGuestSchema,
    BookingResponseSchema,
    BookingReturnedStatus,
    BookingSpaceSchema,
)
from app.spaces.exceptions.space import SpaceNotFoundException
from app.spaces.repositories.space import ISpaceRepository
from app.spaces.schemas.space import SpaceResponseSchema
from app.spaces.services.space import ISpaceService
from app.users.repositories.user import IUserRepository
from app.utils.clock import WEEKDAYS, IClock, hour_exists, local_hour_to_utc
from app.utils.di import inject


class IBookingService(Protocol):
    def create(
        self, data: BookingCreateRequestSchema, current_user: CurrentUser
    ) -> BookingResponseSchema: ...


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

    def create(
        self, data: BookingCreateRequestSchema, current_user: CurrentUser
    ) -> BookingResponseSchema:
        # Only a space the user can view: 404 for an unknown id or someone else's draft.
        space = self._space_service.get(space_id=data.space_id, current_user=current_user)
        if space.host.id == current_user.id:
            raise CannotBookOwnSpaceException
        start_hour, end_hour = _slot_hours(space, data)
        now = self._clock.now()
        # A booking that starts exactly now has already started (ADR-022).
        if local_hour_to_utc(data.date, start_hour) <= now:
            raise BookingInPastException
        # Advice only: a pending booking takes no room, confirm checks again under the lock (ADR-023).
        self._raise_if_full(space, data.date, start_hour, end_hour)
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

    def _raise_if_full(
        self, space: SpaceResponseSchema, day: date, start_hour: int, end_hour: int
    ) -> None:
        taken = self._booking_repository.confirmed_per_hour(space_id=space.id, day=day)
        # A database CHECK keeps desk_count NULL for every category but desk.
        units = space.desk_count or 1
        for hour in range(start_hour, end_hour):
            if taken.get(hour, 0) >= units:
                raise SlotFullException.at(_hh_mm(hour), has_desks=space.desk_count is not None)


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
        space=BookingSpaceSchema.model_validate(booking.space),
        guest=BookingGuestSchema.model_validate(booking.guest),
        date=booking.date,
        start_time=_hh_mm(booking.start_hour),
        end_time=_hh_mm(booking.end_hour),
        total_price=booking.total_price,
        status=_returned_status(booking, now),
        created_at=booking.created_at,
    )
