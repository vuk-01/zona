"""API layer only: routing, validation, auth and the error shape. The service is a mock."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from unittest.mock import Mock

import pytest
from fastapi.testclient import TestClient

from app.auth.exceptions.auth import InvalidTokenException, NotAuthenticatedException
from app.spaces.exceptions.space import (
    InvalidSpaceException,
    NotAHostException,
    NotOwnFavoritesException,
    NotSpaceOwnerException,
    SpaceHasActiveBookingsException,
    SpaceNotFoundException,
)
from app.spaces.models.space import SpaceCategory, SpaceStatus
from app.spaces.schemas.space import (
    BookingCountsSchema,
    OpeningHoursSchema,
    SpaceHostSchema,
    SpaceResponseSchema,
)
from app.utils.pagination import Page
from tests.utils import space_body

pytestmark = pytest.mark.unit

AUTH = {"Authorization": "Bearer token"}

HOURS = {"open": "08:00", "close": "20:00"}

SPACE = SpaceResponseSchema(
    id=7,
    name="Glass Room",
    description="",
    category=SpaceCategory.MEETING_ROOM,
    city="Podgorica",
    address="Bulevar Džordža Vašingtona 98",
    price_per_hour=18,
    capacity=8,
    desk_count=None,
    images=["https://example.com/glass.jpg"],
    opening_hours=OpeningHoursSchema.model_validate(
        {"mon": HOURS, "tue": None, "wed": None, "thu": None, "fri": None, "sat": None, "sun": None}
    ),
    status=SpaceStatus.LISTED,
    host=SpaceHostSchema(id=1, name="Test User"),
    created_at=datetime(2026, 1, 1, tzinfo=UTC),
    available_desks=None,
)


def test_list_is_paginated_and_camel_case(client: TestClient, space_service: Mock) -> None:
    space_service.list.return_value = Page(total=1, items=[SPACE], pages=1)

    response = client.get("/api/spaces?page=1&size=10")

    assert response.status_code == 200
    body = response.json()
    assert (body["total"], body["pages"]) == (1, 1)
    item = body["items"][0]
    assert item["pricePerHour"] == 18
    assert item["openingHours"]["mon"] == HOURS
    assert item["host"] == {"id": 1, "name": "Test User"}
    assert item["createdAt"] == "2026-01-01T00:00:00Z"
    assert item["availableDesks"] is None
    # A meeting room has no desks, and this is not the host's own list.
    assert "deskCount" not in item
    assert "bookingCounts" not in item


def test_list_passes_every_filter_to_the_service(client: TestClient, space_service: Mock) -> None:
    space_service.list.return_value = Page(total=0, items=[], pages=0)

    response = client.get(
        "/api/spaces?search=glass&category=meeting-room&city=Podgorica&hostId=3"
        "&status=listed&minPrice=10&maxPrice=30.5&favoriteOf=1&page=2&size=5",
        headers=AUTH,
    )

    assert response.status_code == 200
    call = space_service.list.call_args.kwargs
    filters = call["filters"]
    assert filters.search == "glass"
    assert filters.category == SpaceCategory.MEETING_ROOM
    assert filters.city == "Podgorica"
    assert filters.host_id == 3
    assert filters.status == SpaceStatus.LISTED
    assert (filters.min_price, filters.max_price) == (10, 30.5)
    assert filters.favorite_of == 1
    assert (call["pagination_params"].page, call["pagination_params"].size) == (2, 5)


def test_list_without_token_passes_no_user(client: TestClient, space_service: Mock) -> None:
    space_service.list.return_value = Page(total=0, items=[], pages=0)

    client.get("/api/spaces")

    assert space_service.list.call_args.kwargs["current_user"] is None


def test_list_with_token_passes_the_signed_in_user(client: TestClient, space_service: Mock) -> None:
    space_service.list.return_value = Page(total=0, items=[], pages=0)

    client.get("/api/spaces", headers=AUTH)

    assert space_service.list.call_args.kwargs["current_user"].id == 1


def test_list_returns_booking_counts_when_the_service_sets_them(
    client: TestClient, space_service: Mock
) -> None:
    own = SPACE.model_copy(update={"booking_counts": BookingCountsSchema(active=0, pending=0)})
    space_service.list.return_value = Page(total=1, items=[own], pages=1)

    response = client.get("/api/spaces?hostId=1", headers=AUTH)

    assert response.json()["items"][0]["bookingCounts"] == {"active": 0, "pending": 0}


def test_list_with_invalid_filters_is_422(client: TestClient, space_service: Mock) -> None:
    response = client.get("/api/spaces?category=garage&minPrice=-1&status=hidden")

    assert response.status_code == 422
    body = response.json()
    assert body["code"] == "validation_error"
    assert set(body["fieldErrors"]) == {"category", "minPrice", "status"}
    space_service.list.assert_not_called()


@pytest.mark.parametrize(
    "query",
    [
        "size=0",
        "size=-1",
        "size=501",
        "page=0",
        f"page={2**31}",
        f"hostId={2**31}",
        "favoriteOf=0",
        f"favoriteOf={2**31}",
    ],
)
def test_list_with_out_of_range_numbers_is_422(
    client: TestClient, space_service: Mock, query: str
) -> None:
    response = client.get(f"/api/spaces?{query}")

    assert response.status_code == 422
    assert set(response.json()["fieldErrors"]) == {query.split("=")[0]}
    space_service.list.assert_not_called()


@pytest.mark.parametrize("query", ["minPrice=inf", "maxPrice=nan", "maxPrice=1000.01"])
def test_list_with_invalid_price_filter_is_422(
    client: TestClient, space_service: Mock, query: str
) -> None:
    response = client.get(f"/api/spaces?{query}")

    assert response.status_code == 422
    assert set(response.json()["fieldErrors"]) == {query.split("=")[0]}
    space_service.list.assert_not_called()


@pytest.mark.parametrize("url", ["/api/spaces", "/api/spaces/7"])
def test_public_read_with_invalid_token_is_401(
    client: TestClient, space_service: Mock, auth_service: Mock, url: str
) -> None:
    # A stale token is not treated as "anonymous": the frontend clears it on this code.
    auth_service.get_current_user.side_effect = InvalidTokenException()

    response = client.get(url, headers=AUTH)

    assert response.status_code == 401
    assert response.json() == {"detail": "Invalid or expired token", "code": "invalid_token"}
    assert response.headers["WWW-Authenticate"] == "Bearer"
    space_service.list.assert_not_called()
    space_service.get.assert_not_called()


@pytest.mark.parametrize("space_id", ["abc", "0", str(2**31)])
def test_get_with_invalid_id_is_422(client: TestClient, space_service: Mock, space_id: str) -> None:
    response = client.get(f"/api/spaces/{space_id}")

    assert response.status_code == 422
    assert response.json()["code"] == "validation_error"
    space_service.get.assert_not_called()


def test_get_passes_the_optional_user(client: TestClient, space_service: Mock) -> None:
    space_service.get.return_value = SPACE

    response = client.get("/api/spaces/7")

    assert response.status_code == 200
    assert response.json()["id"] == 7
    assert space_service.get.call_args.kwargs == {"space_id": 7, "current_user": None}


def test_get_unknown_space_is_404_with_error_shape(client: TestClient, space_service: Mock) -> None:
    space_service.get.side_effect = SpaceNotFoundException()

    response = client.get("/api/spaces/999")

    assert response.status_code == 404
    assert response.json() == {"detail": "Space not found", "code": "space_not_found"}


def test_create_without_token_is_401(client: TestClient, space_service: Mock) -> None:
    response = client.post("/api/spaces", json=space_body())

    assert response.status_code == 401
    assert response.json()["code"] == "not_authenticated"
    assert response.headers["WWW-Authenticate"] == "Bearer"
    space_service.create.assert_not_called()


def test_create_with_invalid_token_is_401(
    client: TestClient, space_service: Mock, auth_service: Mock
) -> None:
    auth_service.get_current_user.side_effect = InvalidTokenException()

    response = client.post("/api/spaces", json=space_body(), headers=AUTH)

    assert response.status_code == 401
    assert response.json()["code"] == "invalid_token"
    space_service.create.assert_not_called()


def test_create_passes_the_signed_in_user_to_the_service(
    client: TestClient, space_service: Mock
) -> None:
    space_service.create.return_value = SPACE

    response = client.post("/api/spaces", json=space_body(hostId=42, host={"id": 42}), headers=AUTH)

    assert response.status_code == 201
    assert response.json()["host"]["id"] == 1
    call = space_service.create.call_args.kwargs
    # the host comes from the token (user 1); "hostId" and "host" in the body are ignored
    assert call["current_user"].id == 1
    assert call["data"].desk_count == 20


def test_create_not_a_host_is_403(client: TestClient, space_service: Mock) -> None:
    space_service.create.side_effect = NotAHostException()

    response = client.post("/api/spaces", json=space_body(), headers=AUTH)

    assert response.status_code == 403
    assert response.json() == {"detail": "Only hosts can create spaces", "code": "not_a_host"}


def test_create_with_invalid_body_is_422_with_field_errors(
    client: TestClient, space_service: Mock
) -> None:
    response = client.post(
        "/api/spaces",
        json={
            "name": "ab",
            "category": "garage",
            "pricePerHour": 0,
            "capacity": 0,
            "images": [],
            "status": "hidden",
        },
        headers=AUTH,
    )

    assert response.status_code == 422
    body = response.json()
    assert body["detail"] == "Validation failed"
    assert body["code"] == "validation_error"
    assert set(body["fieldErrors"]) == {
        "name",
        "category",
        "city",
        "address",
        "pricePerHour",
        "capacity",
        "images",
        "openingHours",
        "status",
    }
    space_service.create.assert_not_called()


def test_create_desk_without_desk_count_is_422(client: TestClient, space_service: Mock) -> None:
    response = client.post("/api/spaces", json=space_body(deskCount=None), headers=AUTH)

    assert response.status_code == 422
    assert set(response.json()["fieldErrors"]) == {"deskCount"}
    space_service.create.assert_not_called()


def test_create_with_closing_before_opening_is_422(client: TestClient, space_service: Mock) -> None:
    bad_hours = space_body()["openingHours"] | {"mon": {"open": "18:00", "close": "09:00"}}

    response = client.post("/api/spaces", json=space_body(openingHours=bad_hours), headers=AUTH)

    assert response.status_code == 422
    assert set(response.json()["fieldErrors"]) == {"openingHours.mon"}
    space_service.create.assert_not_called()


def test_patch_sends_only_the_changed_fields(client: TestClient, space_service: Mock) -> None:
    space_service.update.return_value = SPACE

    response = client.patch("/api/spaces/7", json={"pricePerHour": 20}, headers=AUTH)

    assert response.status_code == 200
    call = space_service.update.call_args.kwargs
    assert call["space_id"] == 7
    assert call["current_user"].id == 1
    assert call["data"].model_dump(exclude_unset=True) == {"price_per_hour": 20}


def test_patch_without_token_is_401(client: TestClient, space_service: Mock) -> None:
    response = client.patch("/api/spaces/7", json={"pricePerHour": 20})

    assert response.status_code == 401
    space_service.update.assert_not_called()


def test_patch_with_invalid_field_is_422(client: TestClient, space_service: Mock) -> None:
    response = client.patch("/api/spaces/7", json={"capacity": 1001}, headers=AUTH)

    assert response.status_code == 422
    assert set(response.json()["fieldErrors"]) == {"capacity"}
    space_service.update.assert_not_called()


def test_patch_by_other_user_is_403(client: TestClient, space_service: Mock) -> None:
    space_service.update.side_effect = NotSpaceOwnerException()

    response = client.patch("/api/spaces/7", json={"pricePerHour": 1}, headers=AUTH)

    assert response.status_code == 403
    assert response.json() == {
        "detail": "Only the host can change this space",
        "code": "not_space_owner",
    }


def test_patch_that_breaks_a_rule_across_fields_is_422(
    client: TestClient, space_service: Mock
) -> None:
    space_service.update.side_effect = InvalidSpaceException(
        field_errors={"deskCount": "Value error, Required for desk spaces"}
    )

    response = client.patch("/api/spaces/7", json={"category": "desk"}, headers=AUTH)

    assert response.status_code == 422
    assert response.json() == {
        "detail": "Validation failed",
        "code": "validation_error",
        "fieldErrors": {"deskCount": "Value error, Required for desk spaces"},
    }


def test_delete_is_204_without_body(client: TestClient, space_service: Mock) -> None:
    response = client.delete("/api/spaces/7", headers=AUTH)

    assert response.status_code == 204
    assert response.content == b""
    assert space_service.delete.call_args.kwargs["space_id"] == 7


def test_delete_without_token_is_401(client: TestClient, space_service: Mock) -> None:
    response = client.delete("/api/spaces/7")

    assert response.status_code == 401
    space_service.delete.assert_not_called()


def test_delete_unknown_space_is_404(client: TestClient, space_service: Mock) -> None:
    space_service.delete.side_effect = SpaceNotFoundException()

    response = client.delete("/api/spaces/999", headers=AUTH)

    assert response.status_code == 404
    assert response.json() == {"detail": "Space not found", "code": "space_not_found"}


def test_patch_unknown_space_is_404(client: TestClient, space_service: Mock) -> None:
    space_service.update.side_effect = SpaceNotFoundException()

    response = client.patch("/api/spaces/999", json={"pricePerHour": 1}, headers=AUTH)

    assert response.status_code == 404
    assert response.json() == {"detail": "Space not found", "code": "space_not_found"}


def test_delete_by_other_user_is_403(client: TestClient, space_service: Mock) -> None:
    space_service.delete.side_effect = NotSpaceOwnerException()

    response = client.delete("/api/spaces/7", headers=AUTH)

    assert response.status_code == 403
    assert response.json() == {
        "detail": "Only the host can change this space",
        "code": "not_space_owner",
    }


@pytest.mark.parametrize(
    ("error", "status_code", "body"),
    [
        (
            NotSpaceOwnerException(),
            403,
            {"detail": "Only the host can change this space", "code": "not_space_owner"},
        ),
        (SpaceNotFoundException(), 404, {"detail": "Space not found", "code": "space_not_found"}),
        (
            SpaceHasActiveBookingsException(1),
            409,
            {"detail": "This space has 1 active booking", "code": "space_has_active_bookings"},
        ),
        (
            SpaceHasActiveBookingsException(2),
            409,
            {"detail": "This space has 2 active bookings", "code": "space_has_active_bookings"},
        ),
    ],
)
def test_delete_maps_the_service_errors(
    client: TestClient,
    space_service: Mock,
    error: Exception,
    status_code: int,
    body: dict[str, str],
) -> None:
    space_service.delete.side_effect = error

    response = client.delete("/api/spaces/7", headers=AUTH)

    assert response.status_code == status_code
    assert response.json() == body


@pytest.mark.parametrize("method", ["patch", "delete"])
@pytest.mark.parametrize("space_id", ["abc", "0", str(2**31)])
def test_write_with_invalid_id_is_422(
    client: TestClient, space_service: Mock, method: str, space_id: str
) -> None:
    kwargs: dict[str, Any] = {"headers": AUTH}
    if method == "patch":
        kwargs["json"] = {"pricePerHour": 1}

    response = getattr(client, method)(f"/api/spaces/{space_id}", **kwargs)

    assert response.status_code == 422
    assert response.json()["code"] == "validation_error"
    space_service.update.assert_not_called()
    space_service.delete.assert_not_called()


@pytest.mark.parametrize(
    ("error", "status_code", "body"),
    [
        (
            NotAuthenticatedException(),
            401,
            {"detail": "Authentication required", "code": "not_authenticated"},
        ),
        (
            NotOwnFavoritesException(),
            403,
            {"detail": "You can only list your own favorites", "code": "not_own_favorites"},
        ),
    ],
)
def test_list_favorite_of_maps_service_errors(
    client: TestClient,
    space_service: Mock,
    error: Exception,
    status_code: int,
    body: dict[str, str],
) -> None:
    space_service.list.side_effect = error

    response = client.get("/api/spaces?favoriteOf=2")

    assert response.status_code == status_code
    assert response.json() == body
