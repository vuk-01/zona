"""Service layer only: how FavoriteService reads a refused INSERT. The repositories are mocks."""

from __future__ import annotations

from datetime import UTC, datetime
from unittest.mock import Mock, create_autospec

import pytest
from sqlalchemy.exc import IntegrityError

from app.auth.exceptions.auth import InvalidTokenException
from app.favorites.models.favorite import Favorite
from app.favorites.repositories.favorite import IFavoriteRepository
from app.favorites.schemas.favorite import FavoriteCreateRequestSchema
from app.favorites.services.favorite import FavoriteService
from app.spaces.exceptions.space import SpaceNotFoundException
from app.spaces.repositories.space import ISpaceRepository
from app.spaces.services.space import ISpaceService
from app.users.repositories.user import IUserRepository
from tests.utils import create_current_user

pytestmark = pytest.mark.unit

SAVE_SPACE_7 = FavoriteCreateRequestSchema(space_id=7)
REFUSED = IntegrityError("INSERT", {}, Exception("constraint failed"))


@pytest.fixture
def favorite_repository() -> Mock:
    repository: Mock = create_autospec(IFavoriteRepository, instance=True)
    repository.add.side_effect = REFUSED
    repository.get.return_value = None
    return repository


@pytest.fixture
def space_service() -> Mock:
    service: Mock = create_autospec(ISpaceService, instance=True)
    return service


@pytest.fixture
def space_repository() -> Mock:
    repository: Mock = create_autospec(ISpaceRepository, instance=True)
    repository.exists.return_value = True
    return repository


@pytest.fixture
def user_repository() -> Mock:
    repository: Mock = create_autospec(IUserRepository, instance=True)
    repository.get_by_id.return_value = Mock()
    return repository


@pytest.fixture
def service(
    favorite_repository: Mock, space_service: Mock, space_repository: Mock, user_repository: Mock
) -> FavoriteService:
    return FavoriteService(
        favorite_repository=favorite_repository,
        space_service=space_service,
        space_repository=space_repository,
        user_repository=user_repository,
    )


def test_refused_for_a_user_deleted_meanwhile_is_invalid_token(
    service: FavoriteService, user_repository: Mock
) -> None:
    user_repository.get_by_id.return_value = None

    with pytest.raises(InvalidTokenException):
        service.create(data=SAVE_SPACE_7, current_user=create_current_user(1))


def test_refused_for_a_space_deleted_meanwhile_is_space_not_found(
    service: FavoriteService, space_repository: Mock
) -> None:
    space_repository.exists.return_value = False

    with pytest.raises(SpaceNotFoundException):
        service.create(data=SAVE_SPACE_7, current_user=create_current_user(1))


def test_refused_because_the_pair_exists_returns_it_not_created(
    service: FavoriteService, favorite_repository: Mock
) -> None:
    favorite_repository.get.return_value = Favorite(
        user_id=1, space_id=7, created_at=datetime(2026, 1, 1, tzinfo=UTC)
    )

    saved = service.create(data=SAVE_SPACE_7, current_user=create_current_user(1))

    assert saved.created is False
    assert (saved.favorite.user_id, saved.favorite.space_id) == (1, 7)


def test_refused_for_no_known_reason_is_not_hidden(service: FavoriteService) -> None:
    with pytest.raises(IntegrityError):
        service.create(data=SAVE_SPACE_7, current_user=create_current_user(1))


def test_a_space_the_user_cannot_view_is_never_inserted(
    service: FavoriteService, space_service: Mock, favorite_repository: Mock
) -> None:
    space_service.get.side_effect = SpaceNotFoundException()

    with pytest.raises(SpaceNotFoundException):
        service.create(data=SAVE_SPACE_7, current_user=create_current_user(1))
    favorite_repository.add.assert_not_called()
