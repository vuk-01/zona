"""Service layer only: what UserService raises when the repository fails. The repository is a mock."""

from __future__ import annotations

from datetime import UTC, datetime
from unittest.mock import Mock, create_autospec

import pytest
from sqlalchemy.orm.exc import StaleDataError

from app.users.exceptions.user import UserNotFoundException
from app.users.models.user import User, UserMode
from app.users.repositories.user import IUserRepository
from app.users.schemas.user import UserUpdateRequestSchema
from app.users.services.user import UserService
from tests.utils import create_current_user

pytestmark = pytest.mark.unit


@pytest.fixture
def user_repository() -> Mock:
    repository: Mock = create_autospec(IUserRepository, instance=True)
    repository.get_by_id.return_value = User(
        id=1,
        email="test@example.com",
        password_hash="hash",
        name="Test User",
        avatar_url=None,
        city="",
        bio="",
        is_host=False,
        mode=UserMode.GUEST.value,
        created_at=datetime(2026, 1, 1, tzinfo=UTC),
    )
    return repository


def test_update_of_an_account_deleted_meanwhile_is_not_found(user_repository: Mock) -> None:
    user_repository.save.side_effect = StaleDataError("UPDATE matched 0 rows")
    service = UserService(user_repository=user_repository)

    with pytest.raises(UserNotFoundException):
        service.update(
            user_id=1,
            data=UserUpdateRequestSchema(name="Ana"),
            current_user=create_current_user(1),
        )


def test_delete_of_an_account_deleted_meanwhile_is_not_found(user_repository: Mock) -> None:
    user_repository.delete.return_value = False
    service = UserService(user_repository=user_repository)

    with pytest.raises(UserNotFoundException):
        service.delete(user_id=1, current_user=create_current_user(1))
