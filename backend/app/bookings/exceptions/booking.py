from __future__ import annotations

from typing import Self

from app.utils.exceptions import (
    ConflictException,
    ForbiddenException,
    NotFoundException,
    UnprocessableEntityException,
)

# The contract writes ranges with an en dash (U+2013), "open 08:00-20:00" with a long dash; chr()
# keeps the character out of the source, where ruff (RUF001) flags it as a look-alike of "-".
_EN_DASH = chr(0x2013)


class BookingNotFoundException(NotFoundException):
    def __init__(self) -> None:
        super().__init__(message="Booking not found", code="booking_not_found")


class NotOwnBookingsException(ForbiddenException):
    def __init__(self) -> None:
        super().__init__(message="You can only list your own bookings", code="not_own_bookings")


class NotBookingParticipantException(ForbiddenException):
    def __init__(self) -> None:
        super().__init__(
            message="Only the guest or the host can see this booking",
            code="not_booking_participant",
        )


class CannotBookOwnSpaceException(ForbiddenException):
    def __init__(self) -> None:
        super().__init__(message="You cannot book your own space", code="cannot_book_own_space")


class InvalidSlotException(UnprocessableEntityException):
    """A slot that breaks the space's rules; `field` is the input at fault (docs/entities.md)."""

    def __init__(
        self,
        message: str = f"Glass Room is open 08:00{_EN_DASH}20:00 on that day",
        field: str = "endTime",
    ) -> None:
        super().__init__(message=message, code="invalid_slot", field_errors={field: message})

    @classmethod
    def not_whole_hour(cls, field: str) -> Self:
        return cls("Pick a whole hour", field=field)

    @classmethod
    def end_not_after_start(cls) -> Self:
        return cls("End must be after the start", field="endTime")

    @classmethod
    def closed(cls, space_name: str) -> Self:
        return cls(f"{space_name} is closed on that day", field="date")

    @classmethod
    def outside_opening_hours(cls, space_name: str, open: str, close: str, field: str) -> Self:
        return cls(f"{space_name} is open {open}{_EN_DASH}{close} on that day", field=field)

    @classmethod
    def hour_does_not_exist(cls, hour: str, field: str) -> Self:
        return cls(f"{hour} does not exist on that day", field=field)


class BookingInPastException(UnprocessableEntityException):
    def __init__(self) -> None:
        message = "Pick a time that has not started yet"
        super().__init__(
            message=message, code="booking_in_past", field_errors={"startTime": message}
        )


class SlotFullException(ConflictException):
    def __init__(self, message: str = "No desks left at 10:00") -> None:
        super().__init__(message=message, code="slot_full")

    @classmethod
    def at(cls, hour: str, has_desks: bool) -> Self:
        if has_desks:
            return cls(f"No desks left at {hour}")
        return cls(f"This space is already booked at {hour}")
