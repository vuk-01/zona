from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Path, Query, status

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
from app.bookings.schemas.booking import (
    MAX_ID,
    BookingCreateRequestSchema,
    BookingListFilters,
    BookingResponseSchema,
    BookingReturnedStatus,
    BookingUpdateRequestSchema,
    IsoDate,
    PopularTimesResponseSchema,
)
from app.bookings.services.booking import IBookingService
from app.database.session_handler import DBAPIRouter
from app.deps import (
    CURRENT_USER_ERRORS,
    OPTIONAL_USER_ERRORS,
    get_current_user,
    get_di_entity,
    get_optional_user,
)
from app.spaces.exceptions.space import SpaceNotFoundException
from app.utils.exceptions import ValidationFailedException
from app.utils.openapi import error_responses
from app.utils.pagination import Page, PaginationParams, get_pagination_params

router = DBAPIRouter(prefix="/bookings")

BookingId = Annotated[int, Path(ge=1, le=MAX_ID)]

# Examples for /docs, copied from real responses.
_INVALID_FILTER = ValidationFailedException({"size": "Input should be greater than or equal to 1"})
_INVALID_ID = ValidationFailedException(
    {"booking_id": "Input should be a valid integer, unable to parse string as an integer"}
)
# PATCH can fail on the path and the body in one answer; one example, because /docs keys them by code.
_INVALID_ID_OR_STATUS = ValidationFailedException(
    {
        "booking_id": "Input should be a valid integer, unable to parse string as an integer",
        "status": "Input should be 'confirmed', 'declined' or 'cancelled'",
    }
)
_INVALID_SPACE_ID = ValidationFailedException(
    {"spaceId": "Input should be a valid integer, unable to parse string as an integer"}
)
_INVALID_BODY = ValidationFailedException(
    {"startTime": "String should match pattern '^([01][0-9]|2[0-3]):[0-5][0-9]$'"}
)


def get_booking_filters(
    space_id: Annotated[int | None, Query(alias="spaceId", ge=1, le=MAX_ID)] = None,
    guest_id: Annotated[
        int | None, Query(alias="guestId", ge=1, le=MAX_ID, description="Own id only")
    ] = None,
    host_id: Annotated[
        int | None, Query(alias="hostId", ge=1, le=MAX_ID, description="Own id only")
    ] = None,
    booking_status: Annotated[
        BookingReturnedStatus | None,
        Query(alias="status", description="As returned: `finished` and `expired` too"),
    ] = None,
    day: Annotated[IsoDate | None, Query(alias="date", description="YYYY-MM-DD")] = None,
) -> BookingListFilters:
    return BookingListFilters(
        space_id=space_id, guest_id=guest_id, host_id=host_id, status=booking_status, date=day
    )


@router.get(
    path="",
    summary="List own bookings",
    description=(
        "Only bookings where the signed-in user is the guest or the space's host, earliest first "
        "(date, start time, id). `guestId` / `hostId` must be the user's own id."
    ),
    responses=error_responses(*CURRENT_USER_ERRORS, NotOwnBookingsException(), _INVALID_FILTER),
)
def get_bookings(
    booking_service: Annotated[IBookingService, Depends(get_di_entity(IBookingService))],
    filters: Annotated[BookingListFilters, Depends(get_booking_filters)],
    pagination_params: Annotated[PaginationParams, Depends(get_pagination_params)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> Page[BookingResponseSchema]:
    return booking_service.list(
        filters=filters, pagination_params=pagination_params, current_user=current_user
    )


# Above /{booking_id}: FastAPI takes the first route that matches, and "popular-times" would
# otherwise be parsed as a booking id.
@router.get(
    path="/popular-times",
    summary="Popular times of a space",
    description=(
        "Public. How booked the space usually is per weekday and local hour 08:00-21:00, 0-100, "
        "from the confirmed bookings of the last 8 weeks; `null` for a closed day. The whole "
        "answer is `null` while the space is younger than 14 days. 404 for someone else's draft."
    ),
    responses=error_responses(*OPTIONAL_USER_ERRORS, SpaceNotFoundException(), _INVALID_SPACE_ID),
)
def get_popular_times(
    space_id: Annotated[int, Query(alias="spaceId", ge=1, le=MAX_ID)],
    booking_service: Annotated[IBookingService, Depends(get_di_entity(IBookingService))],
    current_user: Annotated[CurrentUser | None, Depends(get_optional_user)],
) -> PopularTimesResponseSchema | None:
    return booking_service.popular_times(space_id=space_id, current_user=current_user)


@router.get(
    path="/{booking_id}",
    summary="Get booking",
    description="Only the guest and the space's host.",
    responses=error_responses(
        *CURRENT_USER_ERRORS,
        NotBookingParticipantException(),
        BookingNotFoundException(),
        _INVALID_ID,
    ),
)
def get_booking(
    booking_id: BookingId,
    booking_service: Annotated[IBookingService, Depends(get_di_entity(IBookingService))],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> BookingResponseSchema:
    return booking_service.get(booking_id=booking_id, current_user=current_user)


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
        BookingTooFarAheadException(),
        _INVALID_BODY,
    ),
)
def create_booking(
    data: BookingCreateRequestSchema,
    booking_service: Annotated[IBookingService, Depends(get_di_entity(IBookingService))],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> BookingResponseSchema:
    return booking_service.create(data=data, current_user=current_user)


@router.patch(
    path="/{booking_id}",
    summary="Confirm, decline or cancel a booking",
    description=(
        "The host confirms or declines a `pending` booking; the guest or the host cancels a "
        "`pending` or `confirmed` one. Confirming checks the room again under a lock on the "
        "space: `409 slot_full` when an hour of the slot is full. The same status again is "
        "`422`, not a no-op."
    ),
    responses=error_responses(
        *CURRENT_USER_ERRORS,
        NotBookingParticipantException(),
        NotBookingHostException(),
        BookingNotFoundException(),
        SlotFullException(),
        InvalidStatusChangeException(),
        _INVALID_ID_OR_STATUS,
    ),
)
def update_booking(
    booking_id: BookingId,
    data: BookingUpdateRequestSchema,
    booking_service: Annotated[IBookingService, Depends(get_di_entity(IBookingService))],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> BookingResponseSchema:
    return booking_service.update(booking_id=booking_id, data=data, current_user=current_user)


@router.delete(
    path="/{booking_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
    summary="Delete a pending booking",
    description="Only the guest, and only while the booking is `pending`.",
    responses=error_responses(
        *CURRENT_USER_ERRORS,
        NotBookingParticipantException(),
        NotBookingGuestException(),
        BookingNotFoundException(),
        InvalidStatusChangeException("Only a pending booking can be deleted"),
        _INVALID_ID,
    ),
)
def delete_booking(
    booking_id: BookingId,
    booking_service: Annotated[IBookingService, Depends(get_di_entity(IBookingService))],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> None:
    booking_service.delete(booking_id=booking_id, current_user=current_user)
