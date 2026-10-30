"""Service layer only: what SpaceService raises when the repository fails. The repository is a mock."""

from __future__ import annotations

from datetime import UTC, date, datetime
from typing import Any
from unittest.mock import Mock, create_autospec

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm.exc import StaleDataError

from app.auth.exceptions.auth import InvalidTokenException, NotAuthenticatedException
from app.auth.schemas.auth import CurrentUser
from app.bookings.repositories.booking import IBookingRepository
from app.spaces.exceptions.space import NotOwnFavoritesException, SpaceNotFoundException
from app.spaces.models.space import Space
from app.spaces.repositories.space import ISpaceRepository
from app.spaces.schemas.space import (
    SpaceCreateRequestSchema,
    SpaceListFilters,
    SpaceUpdateRequestSchema,
)
from app.spaces.services.space import SpaceService
from app.users.models.user import User
from app.users.repositories.user import IUserRepository
from app.utils.pagination import Page, PaginationParams
from tests.utils import FixedClock, create_current_user, space_body

pytestmark = pytest.mark.unit

# Wednesday 2026-10-28 10:00 in Podgorica (CET, UTC+1).
WEDNESDAY_10_LOCAL = datetime(2026, 10, 28, 9, 0, tzinfo=UTC)


@pytest.fixture
def space_repository() -> Mock:
    repository: Mock = create_autospec(ISpaceRepository, instance=True)
    fields = SpaceCreateRequestSchema.model_validate(space_body()).model_dump()
    repository.get_by_id.return_value = Space(**fields, id=7, host_id=1)
    return repository


@pytest.fixture
def user_repository() -> Mock:
    repository: Mock = create_autospec(IUserRepository, instance=True)
    return repository


@pytest.fixture
def booking_repository() -> Mock:
    repository: Mock = create_autospec(IBookingRepository, instance=True)
    repository.confirmed_at.return_value = {}
    repository.booking_counts.return_value = {}
    return repository


@pytest.fixture
def service(
    space_repository: Mock, booking_repository: Mock, user_repository: Mock
) -> SpaceService:
    return SpaceService(
        space_repository=space_repository,
        booking_repository=booking_repository,
        user_repository=user_repository,
        clock=FixedClock(WEDNESDAY_10_LOCAL),
    )


def desk_space(id: int, desk_count: int = 20, **changes: Any) -> Space:
    """A listed desk space of host 1, open 08:00-20:00 Monday to Friday."""
    fields = SpaceCreateRequestSchema.model_validate(
        space_body(deskCount=desk_count, **changes)
    ).model_dump()
    host = User(id=1, name="ana")
    return Space(**fields, id=id, host_id=1, host=host, created_at=WEDNESDAY_10_LOCAL)


def list_as_host(service: SpaceService, space_repository: Mock, *spaces: Space) -> list[Any]:
    space_repository.get_all.return_value = Page(total=len(spaces), items=list(spaces), pages=1)
    page = service.list(
        filters=SpaceListFilters(host_id=1),
        pagination_params=PaginationParams(page=1, size=50),
        current_user=create_current_user(1, is_host=True),
    )
    return [item.model_dump(by_alias=True) for item in page.items]


def test_available_desks_is_desk_count_minus_this_hours_confirmed_and_never_below_0(
    service: SpaceService, space_repository: Mock, booking_repository: Mock
) -> None:
    # Space 2's desk count was lowered below its confirmed bookings by a PATCH.
    booking_repository.confirmed_at.return_value = {1: 3, 2: 5}

    items = list_as_host(
        service, space_repository, desk_space(1), desk_space(2, desk_count=2), desk_space(3)
    )

    assert [item["availableDesks"] for item in items] == [17, 0, 20]


def test_one_query_per_field_for_the_whole_page_and_none_for_closed_or_whole_spaces(
    service: SpaceService, space_repository: Mock, booking_repository: Mock
) -> None:
    closed_today = {"wed": None}
    room = desk_space(2, category="meeting-room")  # the schema drops the desk count

    list_as_host(
        service,
        space_repository,
        desk_space(1),
        room,
        desk_space(3, openingHours=space_body()["openingHours"] | closed_today),
        desk_space(4),
    )

    # Wednesday 10:00 in Podgorica: only the open desk spaces need this hour's bookings.
    booking_repository.confirmed_at.assert_called_once_with(
        space_ids=[1, 4], day=date(2026, 10, 28), hour=10
    )
    booking_repository.booking_counts.assert_called_once_with(
        space_ids=[1, 2, 3, 4], now=WEDNESDAY_10_LOCAL
    )


def test_booking_counts_only_on_the_hosts_own_list(
    service: SpaceService, space_repository: Mock, booking_repository: Mock
) -> None:
    booking_repository.booking_counts.return_value = {1: (2, 1)}

    own = list_as_host(service, space_repository, desk_space(1), desk_space(2))
    page = service.list(
        filters=SpaceListFilters(host_id=1),
        pagination_params=PaginationParams(page=1, size=50),
        current_user=create_current_user(2),
    )

    assert [item["bookingCounts"] for item in own] == [
        {"active": 2, "pending": 1},
        {"active": 0, "pending": 0},
    ]
    assert all(item.booking_counts is None for item in page.items)
    booking_repository.booking_counts.assert_called_once()  # only for the host's own list


def test_create_for_a_host_deleted_meanwhile_is_invalid_token(
    service: SpaceService, space_repository: Mock, user_repository: Mock
) -> None:
    space_repository.add.side_effect = IntegrityError("INSERT", {}, Exception("FOREIGN KEY"))
    user_repository.exists.return_value = False

    with pytest.raises(InvalidTokenException):
        service.create(
            data=SpaceCreateRequestSchema.model_validate(space_body()),
            current_user=create_current_user(1, is_host=True),
        )


def test_create_refused_while_the_host_exists_is_not_hidden(
    service: SpaceService, space_repository: Mock, user_repository: Mock
) -> None:
    space_repository.add.side_effect = IntegrityError("INSERT", {}, Exception("CHECK"))
    user_repository.exists.return_value = True

    with pytest.raises(IntegrityError):
        service.create(
            data=SpaceCreateRequestSchema.model_validate(space_body()),
            current_user=create_current_user(1, is_host=True),
        )


def test_delete_of_a_space_deleted_meanwhile_is_not_found(
    service: SpaceService, space_repository: Mock
) -> None:
    space_repository.delete.return_value = False

    with pytest.raises(SpaceNotFoundException):
        service.delete(space_id=7, current_user=create_current_user(1, is_host=True))


def test_update_of_a_space_deleted_meanwhile_is_not_found(
    service: SpaceService, space_repository: Mock
) -> None:
    space_repository.save.side_effect = StaleDataError("UPDATE matched 0 rows")

    with pytest.raises(SpaceNotFoundException):
        service.update(
            space_id=7,
            data=SpaceUpdateRequestSchema(name="Hub Morača"),
            current_user=create_current_user(1, is_host=True),
        )


@pytest.mark.parametrize(
    ("current_user", "error"),
    [(None, NotAuthenticatedException), (create_current_user(2), NotOwnFavoritesException)],
    ids=["no-token", "another-id"],
)
def test_favorite_of_is_only_the_signed_in_users_own(
    service: SpaceService,
    space_repository: Mock,
    current_user: CurrentUser | None,
    error: type[Exception],
) -> None:
    with pytest.raises(error):
        service.list(
            filters=SpaceListFilters(favorite_of=1),
            pagination_params=PaginationParams(page=1, size=50),
            current_user=current_user,
        )
    space_repository.get_all.assert_not_called()
