from __future__ import annotations

from typing import Annotated

from fastapi import Depends, status

from app.auth.schemas.auth import CurrentUser
from app.bookings.exceptions.booking import (
    BookingInPastException,
    CannotBookOwnSpaceException,
    InvalidSlotException,
    SlotFullException,
)
from app.bookings.schemas.booking import BookingCreateRequestSchema, BookingResponseSchema
from app.bookings.services.booking import IBookingService
from app.database.session_handler import DBAPIRouter
from app.deps import CURRENT_USER_ERRORS, get_current_user, get_di_entity
from app.spaces.exceptions.space import SpaceNotFoundException
from app.utils.exceptions import ValidationFailedException
from app.utils.openapi import error_responses

router = DBAPIRouter(prefix="/bookings")

# Examples for /docs, copied from real responses.
_INVALID_BODY = ValidationFailedException(
    {"startTime": "String should match pattern '^([01]\\d|2[0-3]):[0-5]\\d$'"}
)


@router.post(
    path="",
    status_code=status.HTTP_201_CREATED,
    summary="Book a space",
    description=(
        "Always `pending`; the host confirms or declines. Local date and whole hours in "
        "Europe/Podgorica. `409 slot_full` here is advice: a free slot can still be refused "
        "on confirm."
    ),
    responses=error_responses(
        *CURRENT_USER_ERRORS,
        CannotBookOwnSpaceException(),
        SpaceNotFoundException(),
        SlotFullException(),
        InvalidSlotException(),
        BookingInPastException(),
        _INVALID_BODY,
    ),
)
def create_booking(
    data: BookingCreateRequestSchema,
    booking_service: Annotated[IBookingService, Depends(get_di_entity(IBookingService))],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> BookingResponseSchema:
    return booking_service.create(data=data, current_user=current_user)
