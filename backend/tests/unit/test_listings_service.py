"""Service layer only: what ListingService raises when the repository fails. The repository is a mock."""

from __future__ import annotations

from unittest.mock import Mock, create_autospec

import pytest
from sqlalchemy.exc import IntegrityError

from app.auth.exceptions.auth import InvalidTokenException
from app.listings.models.listing import ListingCategory
from app.listings.repositories.listing import IListingRepository
from app.listings.schemas.listing import ListingCreateRequestSchema
from app.listings.services.listing import ListingService
from app.users.repositories.user import IUserRepository
from tests.utils import create_current_user

pytestmark = pytest.mark.unit

NEW_LISTING = ListingCreateRequestSchema(
    title="Elden Ring", price=35, category=ListingCategory.GAMES, city="Nikšić"
)


@pytest.fixture
def listing_repository() -> Mock:
    repository: Mock = create_autospec(IListingRepository, instance=True)
    return repository


@pytest.fixture
def user_repository() -> Mock:
    repository: Mock = create_autospec(IUserRepository, instance=True)
    return repository


@pytest.fixture
def service(listing_repository: Mock, user_repository: Mock) -> ListingService:
    return ListingService(listing_repository=listing_repository, user_repository=user_repository)


def test_create_for_an_owner_deleted_meanwhile_is_invalid_token(
    service: ListingService, listing_repository: Mock, user_repository: Mock
) -> None:
    listing_repository.add.side_effect = IntegrityError("INSERT", {}, Exception("FOREIGN KEY"))
    user_repository.exists.return_value = False

    with pytest.raises(InvalidTokenException):
        service.create(data=NEW_LISTING, current_user=create_current_user(1))


def test_create_refused_while_the_owner_exists_is_not_hidden(
    service: ListingService, listing_repository: Mock, user_repository: Mock
) -> None:
    listing_repository.add.side_effect = IntegrityError("INSERT", {}, Exception("CHECK"))
    user_repository.exists.return_value = True

    with pytest.raises(IntegrityError):
        service.create(data=NEW_LISTING, current_user=create_current_user(1))
