from __future__ import annotations

from typing import Any

from pydantic import Field

from app.utils.exceptions import AppBaseException, status_code_for
from app.utils.schemas import CamelCaseModel


class ErrorResponseSchema(CamelCaseModel):
    """The one error shape (ADR-005). Only documents responses; the handlers in `app.app` build them."""

    detail: str = Field(examples=["Space not found"])
    code: str = Field(examples=["space_not_found"])
    field_errors: dict[str, str] = Field(
        default_factory=dict,
        description="Only when an input field is at fault: field name -> message",
    )


def error_responses(*errors: AppBaseException) -> dict[int | str, dict[str, Any]]:
    """`responses=` for a route: each error it can return, as an example under its status.

    Declaring the 422 here also replaces FastAPI's default `{"detail": [{loc, msg, type}]}` in /docs.
    """
    examples_by_status: dict[int, dict[str, Any]] = {}
    for error in errors:
        examples = examples_by_status.setdefault(status_code_for(error), {})
        examples[error.code] = {"summary": error.message, "value": error.response_content()}
    return {
        status_code: {
            "model": ErrorResponseSchema,
            "content": {"application/json": {"examples": examples}},
        }
        for status_code, examples in sorted(examples_by_status.items())
    }
