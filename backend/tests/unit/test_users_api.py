"""API layer only: routing, validation, auth and the error shape. The service is a mock."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from unittest.mock import Mock

import pytest
from fastapi.testclient import TestClient

from app.auth.exceptions.auth import InvalidTokenException
from app.users.exceptions.user import NotAccountOwnerException, UserNotFoundException
from app.users.models.user import UserMode
from app.users.schemas.user import PublicUserResponseSchema, UserResponseSchema
from app.utils.pagination import Page

pytestmark = pytest.mark.unit

AUTH = {"Authorization": "Bearer token"}

PUBLIC_USER = PublicUserResponseSchema(
    id=1,
    name="Ana",
    avatar_url=None,
    city="Podgorica",
    bio="",
    is_host=True,
    created_at=datetime(2026, 1, 1, tzinfo=UTC),
)
USER = UserResponseSchema(**dict(PUBLIC_USER), email="ana@example.com", mode=UserMode.HOST)

PUBLIC_JSON = {
    "id": 1,
    "name": "Ana",
    "avatarUrl": None,
    "city": "Podgorica",
    "bio": "",
    "isHost": True,
    "createdAt": "2026-01-01T00:00:00Z",
}


def test_list_returns_public_users(client: TestClient, user_service: Mock) -> None:
    user_service.list.return_value = Page(total=1, items=[PUBLIC_USER], pages=1)

    response = client.get("/api/users")

    assert response.status_code == 200
    assert response.json() == {"total": 1, "items": [PUBLIC_JSON], "pages": 1}


def test_list_passes_filters_and_pagination(client: TestClient, user_service: Mock) -> None:
    user_service.list.return_value = Page(total=0, items=[], pages=0)

    response = client.get("/api/users?search=an&isHost=true&page=2&size=10")

    assert response.status_code == 200
    kwargs = user_service.list.call_args.kwargs
    assert kwargs["filters"].search == "an"
    assert kwargs["filters"].is_host is True
    assert (kwargs["pagination_params"].page, kwargs["pagination_params"].size) == (2, 10)


def test_list_without_filters_passes_defaults(client: TestClient, user_service: Mock) -> None:
    user_service.list.return_value = Page(total=0, items=[], pages=0)

    client.get("/api/users")

    filters = user_service.list.call_args.kwargs["filters"]
    assert (filters.search, filters.is_host) == ("", None)


@pytest.mark.parametrize(
    ("query", "field"),
    [("isHost=maybe", "isHost"), (f"search={'a' * 81}", "search"), ("size=0", "size")],
)
def test_list_with_invalid_filter_is_422(
    client: TestClient, user_service: Mock, query: str, field: str
) -> None:
    response = client.get(f"/api/users?{query}")

    assert response.status_code == 422
    assert set(response.json()["fieldErrors"]) == {field}
    user_service.list.assert_not_called()


def test_list_with_invalid_token_is_401(
    client: TestClient, auth_service: Mock, user_service: Mock
) -> None:
    auth_service.get_current_user.side_effect = InvalidTokenException()

    response = client.get("/api/users", headers=AUTH)

    assert response.status_code == 401
    assert response.json()["code"] == "invalid_token"
    user_service.list.assert_not_called()


def test_get_returns_the_public_user(client: TestClient, user_service: Mock) -> None:
    user_service.get.return_value = PUBLIC_USER

    response = client.get("/api/users/1")

    assert response.status_code == 200
    assert response.json() == PUBLIC_JSON
    assert user_service.get.call_args.kwargs["user_id"] == 1


def test_get_unknown_user_is_404(client: TestClient, user_service: Mock) -> None:
    user_service.get.side_effect = UserNotFoundException()

    response = client.get("/api/users/99")

    assert response.status_code == 404
    assert response.json() == {"detail": "User not found", "code": "user_not_found"}


@pytest.mark.parametrize("user_id", ["abc", "0", str(2**31)])
def test_get_with_invalid_id_is_422(client: TestClient, user_service: Mock, user_id: str) -> None:
    response = client.get(f"/api/users/{user_id}")

    assert response.status_code == 422
    assert set(response.json()["fieldErrors"]) == {"user_id"}
    user_service.get.assert_not_called()


def test_patch_passes_only_sent_fields_and_the_user(client: TestClient, user_service: Mock) -> None:
    user_service.update.return_value = USER

    response = client.patch(
        "/api/users/1", json={"name": "  Ana  ", "avatarUrl": None, "mode": "host"}, headers=AUTH
    )

    assert response.status_code == 200
    assert response.json() == PUBLIC_JSON | {"email": "ana@example.com", "mode": "host"}
    kwargs = user_service.update.call_args.kwargs
    assert kwargs["user_id"] == 1
    assert kwargs["current_user"].id == 1
    assert kwargs["data"].model_dump(exclude_unset=True) == {
        "name": "Ana",
        "avatar_url": None,
        "mode": UserMode.HOST,
    }


def test_patch_with_empty_body_reaches_the_service(client: TestClient, user_service: Mock) -> None:
    user_service.update.return_value = USER

    response = client.patch("/api/users/1", json={}, headers=AUTH)

    assert response.status_code == 200
    assert user_service.update.call_args.kwargs["data"].model_dump(exclude_unset=True) == {}


def test_patch_without_token_is_401(client: TestClient, user_service: Mock) -> None:
    response = client.patch("/api/users/1", json={"name": "Ana"})

    assert response.status_code == 401
    assert response.json() == {"detail": "Authentication required", "code": "not_authenticated"}
    assert response.headers["WWW-Authenticate"] == "Bearer"
    user_service.update.assert_not_called()


@pytest.mark.parametrize(
    ("body", "field"),
    [
        ({"name": "A"}, "name"),
        ({"name": "   "}, "name"),
        ({"name": "A" * 61}, "name"),
        ({"name": None}, "name"),
        ({"avatarUrl": "not-a-url"}, "avatarUrl"),
        ({"avatarUrl": "ftp://example.com/a.png"}, "avatarUrl"),
        ({"avatarUrl": "https://example.com/" + "a" * 481}, "avatarUrl"),
        ({"city": "a" * 81}, "city"),
        ({"city": None}, "city"),
        ({"bio": "a" * 201}, "bio"),
        ({"bio": None}, "bio"),
        ({"mode": "admin"}, "mode"),
        ({"mode": None}, "mode"),
    ],
)
def test_patch_with_invalid_field_is_422(
    client: TestClient, user_service: Mock, body: dict[str, Any], field: str
) -> None:
    response = client.patch("/api/users/1", json=body, headers=AUTH)

    assert response.status_code == 422
    assert response.json()["code"] == "validation_error"
    assert set(response.json()["fieldErrors"]) == {field}
    user_service.update.assert_not_called()


@pytest.mark.parametrize("user_id", ["abc", "0", str(2**31)])
def test_patch_with_invalid_id_is_422(client: TestClient, user_service: Mock, user_id: str) -> None:
    response = client.patch(f"/api/users/{user_id}", json={"name": "Ana"}, headers=AUTH)

    assert response.status_code == 422
    assert set(response.json()["fieldErrors"]) == {"user_id"}
    user_service.update.assert_not_called()


@pytest.mark.parametrize(
    ("error", "status_code", "body"),
    [
        (
            NotAccountOwnerException(),
            403,
            {
                "detail": "Only the account owner can change this account",
                "code": "not_account_owner",
            },
        ),
        (UserNotFoundException(), 404, {"detail": "User not found", "code": "user_not_found"}),
    ],
)
def test_patch_maps_service_errors(
    client: TestClient,
    user_service: Mock,
    error: Exception,
    status_code: int,
    body: dict[str, str],
) -> None:
    user_service.update.side_effect = error

    response = client.patch("/api/users/2", json={"name": "Ana"}, headers=AUTH)

    assert response.status_code == status_code
    assert response.json() == body


def test_delete_returns_204_without_body(client: TestClient, user_service: Mock) -> None:
    response = client.delete("/api/users/1", headers=AUTH)

    assert response.status_code == 204
    assert response.content == b""
    kwargs = user_service.delete.call_args.kwargs
    assert (kwargs["user_id"], kwargs["current_user"].id) == (1, 1)


def test_delete_without_token_is_401(client: TestClient, user_service: Mock) -> None:
    response = client.delete("/api/users/1")

    assert response.status_code == 401
    assert response.json()["code"] == "not_authenticated"
    user_service.delete.assert_not_called()


@pytest.mark.parametrize("user_id", ["abc", "0", str(2**31)])
def test_delete_with_invalid_id_is_422(
    client: TestClient, user_service: Mock, user_id: str
) -> None:
    response = client.delete(f"/api/users/{user_id}", headers=AUTH)

    assert response.status_code == 422
    assert set(response.json()["fieldErrors"]) == {"user_id"}
    user_service.delete.assert_not_called()


@pytest.mark.parametrize(
    ("error", "status_code", "body"),
    [
        (
            NotAccountOwnerException(),
            403,
            {
                "detail": "Only the account owner can change this account",
                "code": "not_account_owner",
            },
        ),
        (UserNotFoundException(), 404, {"detail": "User not found", "code": "user_not_found"}),
    ],
)
def test_delete_maps_service_errors(
    client: TestClient,
    user_service: Mock,
    error: Exception,
    status_code: int,
    body: dict[str, str],
) -> None:
    user_service.delete.side_effect = error

    response = client.delete("/api/users/2", headers=AUTH)

    assert response.status_code == status_code
    assert response.json() == body
