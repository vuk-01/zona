from __future__ import annotations

from app.utils.exceptions import ForbiddenException, NotFoundException


class UserNotFoundException(NotFoundException):
    def __init__(self) -> None:
        super().__init__(message="User not found", code="user_not_found")


class NotAccountOwnerException(ForbiddenException):
    def __init__(self) -> None:
        super().__init__(
            message="Only the account owner can change this account", code="not_account_owner"
        )
