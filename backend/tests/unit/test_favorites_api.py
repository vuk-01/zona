"""API layer only: routing, validation, auth, status codes and the error shape. The service is a mock."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from unittest.mock import Mock

import pytest
from fastapi.testclient import TestClient

from app.favorites.schemas.favorite import FavoriteResponseSchema, FavoriteSaved
from app.spaces.exceptions.space import SpaceNotFoundException
from app.utils.pagination import Page

pytestmark = pytest.mark.unit

AUTH = {"Authorization": "Bearer token"}

FAVORITE = FavoriteResponseSchema(
    user_id=1, space_id=7, created_at=datetime(2026, 1, 1, tzinfo=UTC)
)
FAVORITE_JSON = {"userId": 1, "spaceId": 7, "createdAt": "2026-01-01T00:00:00Z"}


def test_list_returns_own_favorites_with_pagination(
    client: TestClient, favorite_service: Mock
) -> None:
    favorite_service.list.return_value = Page(total=1, items=[FAVORITE], pages=1)

    response = client.get("/api/favorites?page=2&size=10", headers=AUTH)

    assert response.status_code == 200
    assert response.json() == {"total": 1, "items": [FAVORITE_JSON], "pages": 1}
    kwargs = favorite_service.list.call_args.kwargs
    assert (kwargs["pagination_params"].page, kwargs["pagination_params"].size) == (2, 10)
    assert kwargs["current_user"].id == 1


@pytest.mark.parametrize("query", ["size=0", "size=501", "page=0"])
def test_list_with_invalid_pagination_is_422(
    client: TestClient, favorite_service: Mock, query: str
) -> None:
    response = client.get(f"/api/favorites?{query}", headers=AUTH)

    assert response.status_code == 422
    assert response.json()["code"] == "validation_error"
    favorite_service.list.assert_not_called()


@pytest.mark.parametrize(
    ("method", "path"),
    [("get", "/api/favorites"), ("post", "/api/favorites"), ("delete", "/api/favorites/7")],
)
def test_without_token_is_401(
    client: TestClient, favorite_service: Mock, method: str, path: str
) -> None:
    kwargs: dict[str, Any] = {"json": {"spaceId": 7}} if method == "post" else {}

    response = getattr(client, method)(path, **kwargs)

    assert response.status_code == 401
    assert response.json() == {"detail": "Authentication required", "code": "not_authenticated"}
    assert not favorite_service.method_calls


def test_create_new_is_201(client: TestClient, favorite_service: Mock) -> None:
    favorite_service.create.return_value = FavoriteSaved(favorite=FAVORITE, created=True)

    response = client.post("/api/favorites", json={"spaceId": 7, "userId": 99}, headers=AUTH)

    assert response.status_code == 201
    assert response.json() == FAVORITE_JSON
    kwargs = favorite_service.create.call_args.kwargs
    assert (kwargs["data"].space_id, kwargs["current_user"].id) == (
        7,
        1,
    )  # userId from the body ignored


def test_create_already_saved_is_200_with_the_existing_one(
    client: TestClient, favorite_service: Mock
) -> None:
    favorite_service.create.return_value = FavoriteSaved(favorite=FAVORITE, created=False)

    response = client.post("/api/favorites", json={"spaceId": 7}, headers=AUTH)

    assert response.status_code == 200
    assert response.json() == FAVORITE_JSON


@pytest.mark.parametrize("body", [{}, {"spaceId": 0}, {"spaceId": "abc"}, {"spaceId": 2**31}])
def test_create_with_invalid_space_id_is_422(
    client: TestClient, favorite_service: Mock, body: dict[str, Any]
) -> None:
    response = client.post("/api/favorites", json=body, headers=AUTH)

    assert response.status_code == 422
    assert set(response.json()["fieldErrors"]) == {"spaceId"}
    favorite_service.create.assert_not_called()


def test_create_for_a_space_the_user_cannot_view_is_404(
    client: TestClient, favorite_service: Mock
) -> None:
    favorite_service.create.side_effect = SpaceNotFoundException()

    response = client.post("/api/favorites", json={"spaceId": 7}, headers=AUTH)

    assert response.status_code == 404
    assert response.json() == {"detail": "Space not found", "code": "space_not_found"}


def test_delete_returns_204_without_body(client: TestClient, favorite_service: Mock) -> None:
    response = client.delete("/api/favorites/7", headers=AUTH)

    assert response.status_code == 204
    assert response.content == b""
    kwargs = favorite_service.delete.call_args.kwargs
    assert (kwargs["space_id"], kwargs["current_user"].id) == (7, 1)


@pytest.mark.parametrize("space_id", ["abc", "0", str(2**31)])
def test_delete_with_invalid_id_is_422(
    client: TestClient, favorite_service: Mock, space_id: str
) -> None:
    response = client.delete(f"/api/favorites/{space_id}", headers=AUTH)

    assert response.status_code == 422
    assert set(response.json()["fieldErrors"]) == {"space_id"}
    favorite_service.delete.assert_not_called()
