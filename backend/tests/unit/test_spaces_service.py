"""Service layer only: what SpaceService raises when the repository fails. The repository is a mock."""

from __future__ import annotations

from unittest.mock import Mock, create_autospec

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm.exc import StaleDataError

from app.auth.exceptions.auth import InvalidTokenException
from app.spaces.exceptions.space import SpaceNotFoundException
from app.spaces.models.space import Space
from app.spaces.repositories.space import ISpaceRepository
from app.spaces.schemas.space import SpaceCreateRequestSchema, SpaceUpdateRequestSchema
from app.spaces.services.space import SpaceService
from app.users.repositories.user import IUserRepository
from app.utils.clock import IClock
from tests.utils import create_current_user, space_body

pytestmark = pytest.mark.unit


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
def service(space_repository: Mock, user_repository: Mock) -> SpaceService:
    return SpaceService(
        space_repository=space_repository,
        user_repository=user_repository,
        clock=create_autospec(IClock),
    )


def test_create_for_a_host_deleted_meanwhile_is_invalid_token(
    service: SpaceService, space_repository: Mock, user_repository: Mock
) -> None:
    space_repository.add.side_effect = IntegrityError("INSERT", {}, Exception("FOREIGN KEY"))
    user_repository.get_by_id.return_value = None

    with pytest.raises(InvalidTokenException):
        service.create(
            data=SpaceCreateRequestSchema.model_validate(space_body()),
            current_user=create_current_user(1, is_host=True),
        )


def test_create_refused_while_the_host_exists_is_not_hidden(
    service: SpaceService, space_repository: Mock, user_repository: Mock
) -> None:
    space_repository.add.side_effect = IntegrityError("INSERT", {}, Exception("CHECK"))
    user_repository.get_by_id.return_value = Mock()

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
