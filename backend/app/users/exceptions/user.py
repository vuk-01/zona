from __future__ import annotations

from app.utils.exceptions import ConflictException, ForbiddenException, NotFoundException


class UserNotFoundException(NotFoundException):
    def __init__(self) -> None:
        super().__init__(message="User not found", code="user_not_found")


class NotAccountOwnerException(ForbiddenException):
    def __init__(self) -> None:
        super().__init__(
            message="Only the account owner can change this account", code="not_account_owner"
        )


class UserConflictException(ConflictException):
    """The database refused the write (e.g. the account was deleted while the request ran)."""

    def __init__(self) -> None:
        super().__init__(
            message="The account could not be saved, please try again", code="user_conflict"
        )
