"""API layer only: routing, validation, auth, status codes and the error shape. The service is a mock."""

from __future__ import annotations

from datetime import UTC, date, datetime
from typing import Any
from unittest.mock import Mock

import pytest
from fastapi.testclient import TestClient

from app.bookings.schemas.booking import (
    BookingGuestSchema,
    BookingResponseSchema,
    BookingReturnedStatus,
    BookingSpaceSchema,
)

pytestmark = pytest.mark.unit

AUTH = {"Authorization": "Bearer token"}
BODY = {"spaceId": 7, "date": "2026-11-04", "startTime": "10:00", "endTime": "12:00"}

BOOKING = BookingResponseSchema(
    id=3,
    space_id=7,
    space=BookingSpaceSchema(id=7, name="Glass Room", address="Njegoševa 1", host_id=2),
    guest=BookingGuestSchema(id=1, name="Marko", avatar_url=None),
    date=date(2026, 11, 4),
    start_time="10:00",
    end_time="12:00",
    total_price=6.0,
    status=BookingReturnedStatus.PENDING,
    created_at=datetime(2026, 10, 28, 9, 0, tzinfo=UTC),
)
BOOKING_JSON = {
    "id": 3,
    "spaceId": 7,
    "space": {"id": 7, "name": "Glass Room", "address": "Njegoševa 1", "hostId": 2},
    "guest": {"id": 1, "name": "Marko", "avatarUrl": None},
    "date": "2026-11-04",
    "startTime": "10:00",
    "endTime": "12:00",
    "totalPrice": 6.0,
    "status": "pending",
    "createdAt": "2026-10-28T09:00:00Z",
}


def test_create_is_201_with_the_booking_and_the_guest_from_the_token(
    client: TestClient, booking_service: Mock
) -> None:
    booking_service.create.return_value = BOOKING

    response = client.post(
        "/api/bookings", json=BODY | {"guestId": 99, "status": "confirmed"}, headers=AUTH
    )

    assert response.status_code == 201
    assert response.json() == BOOKING_JSON
    kwargs = booking_service.create.call_args.kwargs
    assert kwargs["current_user"].id == 1  # guestId from the body ignored
    data = kwargs["data"]
    assert (data.space_id, data.date, data.start_time, data.end_time) == (
        7,
        date(2026, 11, 4),
        "10:00",
        "12:00",
    )
    assert "status" not in data.model_dump()


def test_create_without_token_is_401(client: TestClient, booking_service: Mock) -> None:
    response = client.post("/api/bookings", json=BODY)

    assert response.status_code == 401
    assert response.json() == {"detail": "Authentication required", "code": "not_authenticated"}
    assert response.headers["WWW-Authenticate"] == "Bearer"
    booking_service.create.assert_not_called()


@pytest.mark.parametrize(
    ("changes", "field"),
    [
        ({"spaceId": 0}, "spaceId"),
        ({"spaceId": 2**31}, "spaceId"),
        ({"spaceId": None}, "spaceId"),
        ({"date": "2026-13-01"}, "date"),
        ({"date": "04.11.2026"}, "date"),
        ({"startTime": "10"}, "startTime"),
        ({"startTime": "24:00"}, "startTime"),
        ({"startTime": "9:00"}, "startTime"),
        ({"endTime": "25:00"}, "endTime"),
        ({"endTime": "24:30"}, "endTime"),
    ],
)
def test_create_with_invalid_body_is_422_with_field_errors(
    client: TestClient, booking_service: Mock, changes: dict[str, Any], field: str
) -> None:
    response = client.post("/api/bookings", json=BODY | changes, headers=AUTH)

    assert response.status_code == 422
    body = response.json()
    assert (body["detail"], body["code"]) == ("Validation failed", "validation_error")
    assert set(body["fieldErrors"]) == {field}
    booking_service.create.assert_not_called()


@pytest.mark.parametrize("missing", ["spaceId", "date", "startTime", "endTime"])
def test_create_without_a_field_is_422(
    client: TestClient, booking_service: Mock, missing: str
) -> None:
    body = {key: value for key, value in BODY.items() if key != missing}

    response = client.post("/api/bookings", json=body, headers=AUTH)

    assert response.status_code == 422
    assert response.json()["fieldErrors"] == {missing: "Field required"}
    booking_service.create.assert_not_called()


def test_create_with_a_time_off_the_whole_hour_reaches_the_service(
    client: TestClient, booking_service: Mock
) -> None:
    """10:30 has the `HH:mm` shape: the service answers it with `invalid_slot` (docs/entities.md)."""
    booking_service.create.return_value = BOOKING

    response = client.post("/api/bookings", json=BODY | {"startTime": "10:30"}, headers=AUTH)

    assert response.status_code == 201
    assert booking_service.create.call_args.kwargs["data"].start_time == "10:30"
