"""/docs shows the error shape the API really sends, not FastAPI's default 422."""

from __future__ import annotations

from typing import Any

import pytest
from fastapi.testclient import TestClient

pytestmark = pytest.mark.unit

ERROR_SCHEMA = {"$ref": "#/components/schemas/ErrorResponseSchema"}


def _openapi(client: TestClient) -> dict[str, Any]:
    response = client.get("/openapi.json")
    assert response.status_code == 200
    schema: dict[str, Any] = response.json()
    return schema


def test_default_validation_error_schema_is_gone(client: TestClient) -> None:
    schemas = _openapi(client)["components"]["schemas"]

    assert "HTTPValidationError" not in schemas
    assert "ValidationError" not in schemas
    assert set(schemas["ErrorResponseSchema"]["properties"]) == {"detail", "code", "fieldErrors"}


def test_every_error_response_uses_the_error_shape(client: TestClient) -> None:
    for path, operations in _openapi(client)["paths"].items():
        for method, operation in operations.items():
            for status_code, response in operation["responses"].items():
                if int(status_code) < 400:
                    continue
                content = response["content"]["application/json"]
                assert content["schema"] == ERROR_SCHEMA, f"{method} {path} {status_code}"


def test_patch_booking_documents_an_invalid_id_and_an_invalid_status(client: TestClient) -> None:
    """Both are `validation_error`, so they share one example; the second would replace the first."""
    responses = _openapi(client)["paths"]["/api/bookings/{booking_id}"]["patch"]["responses"]
    example = responses["422"]["content"]["application/json"]["examples"]["validation_error"]

    assert set(example["value"]["fieldErrors"]) == {"booking_id", "status"}


def test_patch_booking_with_an_invalid_id_and_status_answers_both_fields(
    client: TestClient,
) -> None:
    """The /docs example above is a real answer: FastAPI reports the path and the body together."""
    response = client.patch(
        "/api/bookings/x", json={"status": "done"}, headers={"Authorization": "Bearer token"}
    )

    assert response.status_code == 422
    assert set(response.json()["fieldErrors"]) == {"booking_id", "status"}


def test_create_space_documents_its_errors_with_real_codes(client: TestClient) -> None:
    responses = _openapi(client)["paths"]["/api/spaces"]["post"]["responses"]

    def codes(status_code: str) -> set[str]:
        return set(responses[status_code]["content"]["application/json"]["examples"])

    assert set(responses) == {"201", "401", "403", "422"}
    assert codes("401") == {"not_authenticated", "invalid_token"}
    assert codes("403") == {"not_a_host"}
    assert responses["422"]["content"]["application/json"]["examples"]["validation_error"][
        "value"
    ] == {
        "detail": "Validation failed",
        "code": "validation_error",
        "fieldErrors": {"name": "String should have at least 3 characters"},
    }
