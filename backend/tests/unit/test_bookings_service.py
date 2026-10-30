"""Service layer only: the order of the checks on create and how a refused INSERT is read.

The repositories, the space service and the clock are mocks or fixed.
"""

from __future__ import annotations

from datetime import UTC, date, datetime
from typing import Any
from unittest.mock import Mock, create_autospec

import pytest
from sqlalchemy.exc import IntegrityError

from app.auth.exceptions.auth import InvalidTokenException
from app.bookings.exceptions.booking import (
    BookingNotFoundException,
    CannotBookOwnSpaceException,
    NotBookingParticipantException,
    NotOwnBookingsException,
    SlotFullException,
)
from app.bookings.models.booking import Booking, BookingStatus
from app.bookings.repositories.booking import IBookingRepository
from app.bookings.schemas.booking import BookingCreateRequestSchema, BookingListFilters
from app.bookings.services.booking import BookingService
from app.spaces.exceptions.space import SpaceNotFoundException
from app.spaces.models.space import Space
from app.spaces.repositories.space import ISpaceRepository
from app.spaces.schemas.space import SpaceResponseSchema
from app.spaces.services.space import ISpaceService
from app.users.models.user import User
from app.users.repositories.user import IUserRepository
from app.utils.pagination import Page, PaginationParams
from tests.utils import FixedClock, create_current_user, space_body

pytestmark = pytest.mark.unit

GUEST = create_current_user(1)
HOST_ID = 2
# Wednesday 2026-10-28 10:00 in Podgorica; the bookings below are a week later.
NOW = datetime(2026, 10, 28, 9, 0, tzinfo=UTC)
WEDNESDAY_10_TO_12 = BookingCreateRequestSchema(
    space_id=7, date=date(2026, 11, 4), start_time="10:00", end_time="12:00"
)
REFUSED = IntegrityError("INSERT", {}, Exception("FOREIGN KEY constraint failed"))


def space(**changes: Any) -> SpaceResponseSchema:
    """A listed desk space (20 desks, Mon-Fri 08:00-20:00) of user 2, as `ISpaceService.get` returns it."""
    return SpaceResponseSchema.model_validate(
        space_body(**changes)
        | {
            "id": 7,
            "description": "",
            "host": {"id": HOST_ID, "name": "Ana"},
            "createdAt": "2026-01-01T00:00:00Z",
            "availableDesks": None,
        }
    )


@pytest.fixture
def booking_repository() -> Mock:
    repository: Mock = create_autospec(IBookingRepository, instance=True)
    repository.add.side_effect = REFUSED
    repository.confirmed_per_hour.return_value = {}
    return repository


@pytest.fixture
def space_service() -> Mock:
    service: Mock = create_autospec(ISpaceService, instance=True)
    service.get.return_value = space()
    return service


@pytest.fixture
def space_repository() -> Mock:
    repository: Mock = create_autospec(ISpaceRepository, instance=True)
    repository.exists.return_value = True
    return repository


@pytest.fixture
def user_repository() -> Mock:
    repository: Mock = create_autospec(IUserRepository, instance=True)
    repository.exists.return_value = True
    return repository


@pytest.fixture
def service(
    booking_repository: Mock,
    space_service: Mock,
    space_repository: Mock,
    user_repository: Mock,
) -> BookingService:
    return BookingService(
        booking_repository=booking_repository,
        space_service=space_service,
        space_repository=space_repository,
        user_repository=user_repository,
        clock=FixedClock(NOW),
    )


# --- a refused INSERT (ADR-019) -------------------------------------------------------------------


def test_refused_insert_with_the_guest_gone_is_invalid_token(
    service: BookingService, user_repository: Mock, space_repository: Mock
) -> None:
    user_repository.exists.return_value = False

    with pytest.raises(InvalidTokenException):
        service.create(WEDNESDAY_10_TO_12, GUEST)

    user_repository.exists.assert_called_once_with(GUEST.id)
    space_repository.exists.assert_not_called()


def test_refused_insert_with_the_space_gone_is_space_not_found(
    service: BookingService, space_repository: Mock
) -> None:
    space_repository.exists.return_value = False

    with pytest.raises(SpaceNotFoundException):
        service.create(WEDNESDAY_10_TO_12, GUEST)

    space_repository.exists.assert_called_once_with(7)


def test_refused_insert_with_both_rows_there_is_raised_again(service: BookingService) -> None:
    with pytest.raises(IntegrityError):
        service.create(WEDNESDAY_10_TO_12, GUEST)


# --- the order of the checks ----------------------------------------------------------------------


def test_own_space_is_refused_before_the_slot_is_checked(
    service: BookingService, space_service: Mock, booking_repository: Mock
) -> None:
    space_service.get.return_value = space()
    off_the_hour = WEDNESDAY_10_TO_12.model_copy(update={"start_time": "10:30"})

    with pytest.raises(CannotBookOwnSpaceException):
        service.create(off_the_hour, create_current_user(HOST_ID))

    booking_repository.confirmed_per_hour.assert_not_called()
    booking_repository.add.assert_not_called()


@pytest.mark.parametrize(
    ("changes", "taken", "message"),
    [
        ({}, {10: 19, 11: 20}, "No desks left at 11:00"),
        (
            {"category": "meeting-room", "deskCount": None},
            {10: 1},
            "This space is already booked at 10:00",
        ),
    ],
)
def test_a_full_hour_is_slot_full_with_the_first_full_hour(
    service: BookingService,
    space_service: Mock,
    booking_repository: Mock,
    changes: dict[str, Any],
    taken: dict[int, int],
    message: str,
) -> None:
    space_service.get.return_value = space(**changes)
    booking_repository.confirmed_per_hour.return_value = taken

    with pytest.raises(SlotFullException) as error:
        service.create(WEDNESDAY_10_TO_12, GUEST)

    assert error.value.message == message
    booking_repository.confirmed_per_hour.assert_called_once_with(space_id=7, day=date(2026, 11, 4))
    booking_repository.add.assert_not_called()


def test_a_desk_left_in_every_hour_goes_on_to_the_insert(
    service: BookingService, booking_repository: Mock
) -> None:
    booking_repository.confirmed_per_hour.return_value = {10: 19, 11: 19}

    with pytest.raises(IntegrityError):  # the mocked INSERT refuses: it was reached
        service.create(WEDNESDAY_10_TO_12, GUEST)

    booking = booking_repository.add.call_args.args[0]
    assert (booking.guest_id, booking.status, booking.total_price) == (GUEST.id, "pending", 6.0)


# --- list and get ---------------------------------------------------------------------------------


def stored_booking(guest_id: int = GUEST.id, host_id: int = HOST_ID) -> Booking:
    """A pending booking of space 7, Wednesday 2026-11-04 10:00-12:00, as the repository returns it."""
    return Booking(
        id=3,
        space_id=7,
        guest_id=guest_id,
        date=date(2026, 11, 4),
        start_hour=10,
        end_hour=12,
        total_price=6.0,
        status=BookingStatus.PENDING,
        ends_at=datetime(2026, 11, 4, 11, 0, tzinfo=UTC),
        created_at=NOW,
        space=Space(id=7, name="Glass Room", address="Njegoševa 1", host_id=host_id),
        guest=User(id=guest_id, name="Marko", avatar_url=None),
    )


@pytest.mark.parametrize(
    "filters",
    [
        BookingListFilters(guest_id=GUEST.id + 1),
        BookingListFilters(host_id=GUEST.id + 1),
        BookingListFilters(guest_id=GUEST.id, host_id=GUEST.id + 1),
        BookingListFilters(guest_id=GUEST.id + 1, host_id=GUEST.id),
    ],
)
def test_list_with_another_users_id_is_not_own_bookings(
    service: BookingService, booking_repository: Mock, filters: BookingListFilters
) -> None:
    with pytest.raises(NotOwnBookingsException):
        service.list(filters, PaginationParams(page=1, size=50), GUEST)

    booking_repository.get_all.assert_not_called()


def test_list_with_own_ids_reads_the_users_bookings_at_one_now(
    service: BookingService, booking_repository: Mock
) -> None:
    filters = BookingListFilters(guest_id=GUEST.id, host_id=GUEST.id)
    booking_repository.get_all.return_value = Page(total=1, items=[stored_booking()], pages=1)

    page = service.list(filters, PaginationParams(page=1, size=50), GUEST)

    assert [booking.id for booking in page.items] == [3]
    kwargs = booking_repository.get_all.call_args.kwargs
    assert (kwargs["user_id"], kwargs["filters"], kwargs["now"]) == (GUEST.id, filters, NOW)


def test_get_an_unknown_booking_is_not_found(
    service: BookingService, booking_repository: Mock
) -> None:
    booking_repository.get_by_id.return_value = None

    with pytest.raises(BookingNotFoundException):
        service.get(3, GUEST)


def test_get_by_someone_else_is_not_booking_participant(
    service: BookingService, booking_repository: Mock
) -> None:
    booking_repository.get_by_id.return_value = stored_booking()

    with pytest.raises(NotBookingParticipantException):
        service.get(3, create_current_user(99))


@pytest.mark.parametrize("user_id", [GUEST.id, HOST_ID])
def test_get_by_the_guest_or_the_host_returns_the_booking(
    service: BookingService, booking_repository: Mock, user_id: int
) -> None:
    booking_repository.get_by_id.return_value = stored_booking()

    booking = service.get(3, create_current_user(user_id))

    assert (booking.id, booking.start_time, booking.end_time) == (3, "10:00", "12:00")
    assert (booking.space.host_id, booking.guest.id) == (HOST_ID, GUEST.id)


@pytest.mark.parametrize(
    ("stored", "now", "returned"),
    [
        ("pending", datetime(2026, 11, 4, 10, 59, tzinfo=UTC), "pending"),
        ("pending", datetime(2026, 11, 4, 11, 0, tzinfo=UTC), "expired"),
        ("confirmed", datetime(2026, 11, 4, 10, 59, tzinfo=UTC), "confirmed"),
        ("confirmed", datetime(2026, 11, 4, 11, 0, tzinfo=UTC), "finished"),
        ("declined", datetime(2026, 11, 4, 11, 0, tzinfo=UTC), "declined"),
        ("cancelled", datetime(2026, 11, 4, 11, 0, tzinfo=UTC), "cancelled"),
    ],
)
def test_get_returns_finished_or_expired_once_the_slot_has_ended(
    booking_repository: Mock,
    space_service: Mock,
    space_repository: Mock,
    user_repository: Mock,
    stored: str,
    now: datetime,
    returned: str,
) -> None:
    service = BookingService(
        booking_repository=booking_repository,
        space_service=space_service,
        space_repository=space_repository,
        user_repository=user_repository,
        clock=FixedClock(now),
    )
    booking = stored_booking()
    booking.status = stored
    booking_repository.get_by_id.return_value = booking

    assert service.get(3, GUEST).status == returned
