from __future__ import annotations

from app.utils.exceptions import (
    ForbiddenException,
    NotFoundException,
    UnprocessableEntityException,
)


class SpaceNotFoundException(NotFoundException):
    def __init__(self) -> None:
        super().__init__(message="Space not found", code="space_not_found")


class NotSpaceOwnerException(ForbiddenException):
    def __init__(self) -> None:
        super().__init__(message="Only the host can change this space", code="not_space_owner")


class NotAHostException(ForbiddenException):
    def __init__(self) -> None:
        super().__init__(message="Only hosts can create spaces", code="not_a_host")


class InvalidSpaceException(UnprocessableEntityException):
    """A PATCH that leaves the space invalid as a whole (e.g. a desk space without a desk count)."""

    def __init__(self, field_errors: dict[str, str]) -> None:
        super().__init__(
            message="Validation failed", code="validation_error", field_errors=field_errors
        )
