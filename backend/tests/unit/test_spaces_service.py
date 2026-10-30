"""Service layer only: what SpaceService raises when the repository fails. The repository is a mock."""

from __future__ import annotations

from unittest.mock import Mock, create_autospec

import pytest

from app.spaces.exceptions.space import SpaceNotFoundException
from app.spaces.models.space import Space
from app.spaces.repositories.space import ISpaceRepository
from app.spaces.schemas.space import SpaceCreateRequestSchema
from app.spaces.services.space import SpaceService
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
def service(space_repository: Mock) -> SpaceService:
    return SpaceService(space_repository=space_repository, clock=create_autospec(IClock))


def test_delete_of_a_space_deleted_meanwhile_is_not_found(
    service: SpaceService, space_repository: Mock
) -> None:
    space_repository.delete.return_value = False

    with pytest.raises(SpaceNotFoundException):
        service.delete(space_id=7, current_user=create_current_user(1, is_host=True))
