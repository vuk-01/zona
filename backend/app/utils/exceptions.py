from __future__ import annotations

from typing import Any

from fastapi import HTTPException, status


class AppBaseException(Exception):
    """Base of every error a service raises. `app.app` maps each subclass to an HTTP status.

    The client always receives `{"detail": message, "code": code}`; `field_errors` adds
    `"fieldErrors": {"email": "..."}` when one input field is at fault (ADR-005).
    """

    def __init__(self, message: str, code: str, field_errors: dict[str, str] | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.code = code
        self.field_errors = field_errors

    def response_content(self) -> dict[str, Any]:
        content: dict[str, Any] = {"detail": self.message, "code": self.code}
        if self.field_errors:
            content["fieldErrors"] = self.field_errors
        return content


class NotFoundException(AppBaseException):
    pass


class InvalidRequestException(AppBaseException):
    pass


class UnprocessableEntityException(AppBaseException):
    """422: the input is well-formed but breaks a rule only the service can check."""


class UnauthenticatedException(AppBaseException):
    pass


class ForbiddenException(AppBaseException):
    pass


class ConflictException(AppBaseException):
    pass


class ServerException(AppBaseException):
    pass


class ValidationFailedException(UnprocessableEntityException):
    """422 for input FastAPI rejected before the endpoint ran; `fieldErrors` names each field."""

    def __init__(self, field_errors: dict[str, str]) -> None:
        super().__init__(
            message="Validation failed", code="validation_error", field_errors=field_errors
        )


STATUS_BY_EXCEPTION: dict[type[AppBaseException], int] = {
    NotFoundException: status.HTTP_404_NOT_FOUND,
    InvalidRequestException: status.HTTP_400_BAD_REQUEST,
    UnprocessableEntityException: status.HTTP_422_UNPROCESSABLE_ENTITY,
    UnauthenticatedException: status.HTTP_401_UNAUTHORIZED,
    ForbiddenException: status.HTTP_403_FORBIDDEN,
    ConflictException: status.HTTP_409_CONFLICT,
    ServerException: status.HTTP_500_INTERNAL_SERVER_ERROR,
}


def status_code_for(exc: AppBaseException) -> int:
    return next(
        (code for base, code in STATUS_BY_EXCEPTION.items() if isinstance(exc, base)),
        status.HTTP_500_INTERNAL_SERVER_ERROR,
    )


class HTTPExceptionWithCode(HTTPException):
    # override the default HTTPException to include a custom error code
    def __init__(
        self,
        status_code: int,
        detail: Any = None,
        headers: dict[str, str] | None = None,
        code: str = "",
    ) -> None:
        super().__init__(status_code=status_code, detail=detail, headers=headers)
        self.code = code
