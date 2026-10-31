"""API layer only: routing, validation, auth, status codes and the error shape. The service is a mock."""

from __future__ import annotations

import inspect
from datetime import UTC, date, datetime
from typing import Any, get_args
from unittest.mock import Mock

import pytest
from fastapi import params
from fastapi.testclient import TestClient

from app.auth.exceptions.auth import InvalidTokenException
from app.bookings.api.booking import get_availability_slot
from app.bookings.exceptions.booking import (
    BookingInPastException,
    BookingNotFoundException,
    BookingTooFarAheadException,
    CannotBookOwnSpaceException,
    InvalidSlotException,
    InvalidStatusChangeException,
    NotBookingGuestException,
    NotBookingHostException,
    NotBookingParticipantException,
    NotOwnBookingsException,
    SlotFullException,
)
from app.bookings.schemas.booking import (
    AvailabilityResponseSchema,
    BookingCreateRequestSchema,
    BookingGuestSchema,
    BookingListFilters,
    BookingResponseSchema,
    BookingReturnedStatus,
    BookingSpaceSchema,
    PopularDaysSchema,
    PopularTimesResponseSchema,
)
from app.spaces.exceptions.space import SpaceNotFoundException
from app.utils.pagination import Page

pytestmark = pytest.mark.unit

AUTH = {"Authorization": "Bearer token"}
BODY = {"spaceId": 7, "date": "2026-11-04", "startTime": "10:00", "endTime": "12:00"}
# The same slot as query parameters of GET /availability.
QUERY: dict[str, str | int] = {
    "spaceId": 7,
    "date": "2026-11-04",
    "startTime": "10:00",
    "endTime": "12:00",
}

BOOKING = BookingResponseSchema(
    id=3,
    space_id=7,
    space=BookingSpaceSchema(
        id=7,
        name="Glass Room",
        address="Njegoševa 1",
        host_id=2,
        image_url="https://example.com/glass.jpg",
    ),
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
    "space": {
        "id": 7,
        "name": "Glass Room",
        "address": "Njegoševa 1",
        "hostId": 2,
        "imageUrl": "https://example.com/glass.jpg",
    },
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
        # Pydantic's lax date would take these as 2026-11-05 and 2026-11-04.
        ({"date": 1793836800}, "date"),
        ({"date": "1793836800"}, "date"),
        ({"date": "2026-11-04T00:00:00"}, "date"),
        # Arabic-Indic digits: `\d` matched them and the service read "1\u0660" as 10.
        ({"startTime": "1\u0660:00"}, "startTime"),
        ({"endTime": "1\u0662:00"}, "endTime"),
        ({"startTime": "10:0\u0660"}, "startTime"),
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


# "2026-11-04\n": `$` in a regex also matches before a trailing newline, `fullmatch` does not.
@pytest.mark.parametrize("value", [1793836800, "2026-11-04T00:00:00", "2026-11-04\n"])
def test_a_date_that_is_not_yyyy_mm_dd_says_the_format(
    client: TestClient, booking_service: Mock, value: int | str
) -> None:
    created = client.post("/api/bookings", json=BODY | {"date": value}, headers=AUTH)
    listed = client.get("/api/bookings", params={"date": value}, headers=AUTH)
    checked = client.get("/api/bookings/availability", params=QUERY | {"date": value})

    for response in (created, listed, checked):
        assert response.status_code == 422
        assert response.json()["fieldErrors"]["date"] == "Use the format YYYY-MM-DD"
    booking_service.create.assert_not_called()
    booking_service.list.assert_not_called()
    booking_service.availability.assert_not_called()


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


_OPEN_08_TO_20 = f"Glass Room is open 08:00{chr(0x2013)}20:00 on that day"
_NOT_STARTED = "Pick a time that has not started yet"
_WITHIN_A_YEAR = "Pick a date within the next 365 days"


@pytest.mark.parametrize(
    ("error", "status_code", "body"),
    [
        (
            InvalidTokenException(),
            401,
            {"detail": "Invalid or expired token", "code": "invalid_token"},
        ),
        (
            CannotBookOwnSpaceException(),
            403,
            {"detail": "You cannot book your own space", "code": "cannot_book_own_space"},
        ),
        (SpaceNotFoundException(), 404, {"detail": "Space not found", "code": "space_not_found"}),
        (
            SlotFullException.at("11:00", has_desks=True),
            409,
            {"detail": "No desks left at 11:00", "code": "slot_full"},
        ),
        (
            InvalidSlotException(),
            422,
            {
                "detail": _OPEN_08_TO_20,
                "code": "invalid_slot",
                "fieldErrors": {"endTime": _OPEN_08_TO_20},
            },
        ),
        (
            BookingInPastException(),
            422,
            {
                "detail": _NOT_STARTED,
                "code": "booking_in_past",
                "fieldErrors": {"startTime": _NOT_STARTED},
            },
        ),
        (
            BookingTooFarAheadException(),
            422,
            {
                "detail": _WITHIN_A_YEAR,
                "code": "booking_too_far_ahead",
                "fieldErrors": {"date": _WITHIN_A_YEAR},
            },
        ),
    ],
)
def test_create_maps_the_service_errors(
    client: TestClient,
    booking_service: Mock,
    error: Exception,
    status_code: int,
    body: dict[str, Any],
) -> None:
    booking_service.create.side_effect = error

    response = client.post("/api/bookings", json=BODY, headers=AUTH)

    assert response.status_code == status_code
    assert response.json() == body


# --- GET list and GET by id -----------------------------------------------------------------------


def test_list_passes_the_filters_pagination_and_user(
    client: TestClient, booking_service: Mock
) -> None:
    booking_service.list.return_value = Page(total=1, items=[BOOKING], pages=1)

    response = client.get(
        "/api/bookings?spaceId=7&guestId=1&hostId=1&status=expired&date=2026-11-04"
        "&page=2&size=10",
        headers=AUTH,
    )

    assert response.status_code == 200
    assert response.json() == {"total": 1, "items": [BOOKING_JSON], "pages": 1}
    kwargs = booking_service.list.call_args.kwargs
    assert kwargs["filters"] == BookingListFilters(
        space_id=7,
        guest_id=1,
        host_id=1,
        status=BookingReturnedStatus.EXPIRED,
        date=date(2026, 11, 4),
    )
    assert (kwargs["pagination_params"].page, kwargs["pagination_params"].size) == (2, 10)
    assert kwargs["current_user"].id == 1


def test_list_without_filters_passes_empty_filters(
    client: TestClient, booking_service: Mock
) -> None:
    booking_service.list.return_value = Page(total=0, items=[], pages=0)

    response = client.get("/api/bookings", headers=AUTH)

    assert response.status_code == 200
    assert booking_service.list.call_args.kwargs["filters"] == BookingListFilters()


@pytest.mark.parametrize(
    ("query", "field"),
    [
        ("spaceId=0", "spaceId"),
        ("guestId=x", "guestId"),
        ("hostId=2147483648", "hostId"),
        ("status=done", "status"),
        ("date=2026-02-30", "date"),
        ("date=1793836800", "date"),
        ("date=2026-11-04T00:00:00", "date"),
        ("size=501", "size"),
    ],
)
def test_list_with_an_invalid_filter_is_422(
    client: TestClient, booking_service: Mock, query: str, field: str
) -> None:
    response = client.get(f"/api/bookings?{query}", headers=AUTH)

    assert response.status_code == 422
    assert set(response.json()["fieldErrors"]) == {field}
    booking_service.list.assert_not_called()


def test_list_not_own_is_403(client: TestClient, booking_service: Mock) -> None:
    booking_service.list.side_effect = NotOwnBookingsException

    response = client.get("/api/bookings?guestId=2", headers=AUTH)

    assert response.status_code == 403
    assert response.json() == {
        "detail": "You can only list your own bookings",
        "code": "not_own_bookings",
    }


def test_get_passes_the_id_and_user(client: TestClient, booking_service: Mock) -> None:
    booking_service.get.return_value = BOOKING

    response = client.get("/api/bookings/3", headers=AUTH)

    assert response.status_code == 200
    assert response.json() == BOOKING_JSON
    kwargs = booking_service.get.call_args.kwargs
    assert (kwargs["booking_id"], kwargs["current_user"].id) == (3, 1)


@pytest.mark.parametrize(
    ("error", "status_code", "body"),
    [
        (
            NotBookingParticipantException,
            403,
            {
                "detail": "Only the guest or the host can see this booking",
                "code": "not_booking_participant",
            },
        ),
        (
            BookingNotFoundException,
            404,
            {"detail": "Booking not found", "code": "booking_not_found"},
        ),
    ],
)
def test_get_maps_the_service_errors(
    client: TestClient,
    booking_service: Mock,
    error: type[Exception],
    status_code: int,
    body: dict[str, str],
) -> None:
    booking_service.get.side_effect = error

    response = client.get("/api/bookings/3", headers=AUTH)

    assert response.status_code == status_code
    assert response.json() == body


@pytest.mark.parametrize("bad_id", ["abc", "0", "2147483648"])
def test_get_with_an_invalid_id_is_422(
    client: TestClient, booking_service: Mock, bad_id: str
) -> None:
    response = client.get(f"/api/bookings/{bad_id}", headers=AUTH)

    assert response.status_code == 422
    assert set(response.json()["fieldErrors"]) == {"booking_id"}
    booking_service.get.assert_not_called()


@pytest.mark.parametrize("path", ["/api/bookings", "/api/bookings/3"])
def test_get_without_token_is_401(client: TestClient, booking_service: Mock, path: str) -> None:
    response = client.get(path)

    assert response.status_code == 401
    assert response.json() == {"detail": "Authentication required", "code": "not_authenticated"}
    assert not booking_service.method_calls


# --- PATCH and DELETE -----------------------------------------------------------------------------


@pytest.mark.parametrize("change", ["confirmed", "declined", "cancelled"])
def test_patch_passes_the_id_change_and_user(
    client: TestClient, booking_service: Mock, change: str
) -> None:
    booking_service.update.return_value = BOOKING

    response = client.patch("/api/bookings/3", json={"status": change}, headers=AUTH)

    assert response.status_code == 200
    assert response.json() == BOOKING_JSON
    kwargs = booking_service.update.call_args.kwargs
    assert (kwargs["booking_id"], kwargs["data"].status, kwargs["current_user"].id) == (
        3,
        change,
        1,
    )


@pytest.mark.parametrize(
    "body",
    [{}, {"status": "pending"}, {"status": "finished"}, {"status": "done"}, {"status": None}],
)
def test_patch_with_an_invalid_body_is_422(
    client: TestClient, booking_service: Mock, body: dict[str, Any]
) -> None:
    response = client.patch("/api/bookings/3", json=body, headers=AUTH)

    assert response.status_code == 422
    assert set(response.json()["fieldErrors"]) == {"status"}
    booking_service.update.assert_not_called()


@pytest.mark.parametrize(
    ("error", "status_code", "code"),
    [
        (NotBookingParticipantException, 403, "not_booking_participant"),
        (NotBookingHostException, 403, "not_booking_host"),
        (BookingNotFoundException, 404, "booking_not_found"),
        (SlotFullException, 409, "slot_full"),
        (InvalidStatusChangeException, 422, "invalid_status_change"),
    ],
)
def test_patch_maps_the_service_errors(
    client: TestClient,
    booking_service: Mock,
    error: type[Exception],
    status_code: int,
    code: str,
) -> None:
    booking_service.update.side_effect = error

    response = client.patch("/api/bookings/3", json={"status": "confirmed"}, headers=AUTH)

    assert response.status_code == status_code
    assert response.json()["code"] == code


def test_patch_with_slot_full_has_the_message_of_the_first_full_hour(
    client: TestClient, booking_service: Mock
) -> None:
    booking_service.update.side_effect = SlotFullException.at("11:00", has_desks=False)

    response = client.patch("/api/bookings/3", json={"status": "confirmed"}, headers=AUTH)

    assert response.status_code == 409
    assert response.json() == {
        "detail": "This space is already booked at 11:00",
        "code": "slot_full",
    }


def test_delete_is_204_without_a_body(client: TestClient, booking_service: Mock) -> None:
    response = client.delete("/api/bookings/3", headers=AUTH)

    assert response.status_code == 204
    assert response.content == b""
    kwargs = booking_service.delete.call_args.kwargs
    assert (kwargs["booking_id"], kwargs["current_user"].id) == (3, 1)


@pytest.mark.parametrize(
    ("error", "status_code", "code"),
    [
        (NotBookingParticipantException, 403, "not_booking_participant"),
        (NotBookingGuestException, 403, "not_booking_guest"),
        (BookingNotFoundException, 404, "booking_not_found"),
        (InvalidStatusChangeException, 422, "invalid_status_change"),
    ],
)
def test_delete_maps_the_service_errors(
    client: TestClient,
    booking_service: Mock,
    error: type[Exception],
    status_code: int,
    code: str,
) -> None:
    booking_service.delete.side_effect = error

    response = client.delete("/api/bookings/3", headers=AUTH)

    assert response.status_code == status_code
    assert response.json()["code"] == code


@pytest.mark.parametrize("method", ["patch", "delete"])
@pytest.mark.parametrize("bad_id", ["abc", "0", "2147483648"])
def test_patch_or_delete_with_an_invalid_id_is_422(
    client: TestClient, booking_service: Mock, method: str, bad_id: str
) -> None:
    kwargs: dict[str, Any] = {"json": {"status": "cancelled"}} if method == "patch" else {}

    response = getattr(client, method)(f"/api/bookings/{bad_id}", headers=AUTH, **kwargs)

    assert response.status_code == 422
    assert set(response.json()["fieldErrors"]) == {"booking_id"}
    assert not booking_service.method_calls


@pytest.mark.parametrize("method", ["patch", "delete"])
def test_patch_or_delete_without_token_is_401(
    client: TestClient, booking_service: Mock, method: str
) -> None:
    kwargs: dict[str, Any] = {"json": {"status": "cancelled"}} if method == "patch" else {}

    response = getattr(client, method)("/api/bookings/3", **kwargs)

    assert response.status_code == 401
    assert response.json() == {"detail": "Authentication required", "code": "not_authenticated"}
    assert not booking_service.method_calls


# --- GET /api/bookings/popular-times ---

POPULAR = PopularTimesResponseSchema(
    days=PopularDaysSchema(
        mon=[0, 10, 22, 50, 0, 0, 0, 0, 0, 0, 0, 0, 0, 100],
        tue=None,
        wed=None,
        thu=None,
        fri=None,
        sat=None,
        sun=None,
    )
)


def test_popular_times_is_public_and_not_caught_by_the_booking_id_route(
    client: TestClient, booking_service: Mock
) -> None:
    booking_service.popular_times.return_value = POPULAR

    response = client.get("/api/bookings/popular-times?spaceId=7")

    assert response.status_code == 200
    body = response.json()
    assert body["firstHour"] == 8
    assert body["days"]["mon"] == [0, 10, 22, 50, 0, 0, 0, 0, 0, 0, 0, 0, 0, 100]
    assert set(body["days"]) == {"mon", "tue", "wed", "thu", "fri", "sat", "sun"}
    assert body["days"]["tue"] is None
    assert booking_service.popular_times.call_args.kwargs == {"space_id": 7, "current_user": None}
    booking_service.get.assert_not_called()


def test_popular_times_passes_the_signed_in_user(client: TestClient, booking_service: Mock) -> None:
    booking_service.popular_times.return_value = POPULAR

    response = client.get("/api/bookings/popular-times?spaceId=7", headers=AUTH)

    assert response.status_code == 200
    assert booking_service.popular_times.call_args.kwargs["current_user"].id == 1


def test_popular_times_without_enough_history_is_200_null(
    client: TestClient, booking_service: Mock
) -> None:
    booking_service.popular_times.return_value = None

    response = client.get("/api/bookings/popular-times?spaceId=7")

    assert response.status_code == 200
    assert response.content == b"null"


def test_popular_times_with_an_invalid_token_is_401(
    client: TestClient, booking_service: Mock, auth_service: Mock
) -> None:
    auth_service.get_current_user.side_effect = InvalidTokenException()

    response = client.get("/api/bookings/popular-times?spaceId=7", headers=AUTH)

    assert response.status_code == 401
    assert response.json() == {"detail": "Invalid or expired token", "code": "invalid_token"}
    booking_service.popular_times.assert_not_called()


# One exception today (an unknown space or someone else's draft); the next one goes in this list.
@pytest.mark.parametrize(
    ("error", "status_code", "body"),
    [(SpaceNotFoundException(), 404, {"detail": "Space not found", "code": "space_not_found"})],
)
def test_popular_times_maps_the_service_errors(
    client: TestClient,
    booking_service: Mock,
    error: Exception,
    status_code: int,
    body: dict[str, Any],
) -> None:
    booking_service.popular_times.side_effect = error

    response = client.get("/api/bookings/popular-times?spaceId=7")

    assert response.status_code == status_code
    assert response.json() == body


@pytest.mark.parametrize("query", ["", "?spaceId=abc", "?spaceId=0", "?spaceId=2147483648"])
def test_popular_times_without_a_valid_space_id_is_422(
    client: TestClient, booking_service: Mock, query: str
) -> None:
    response = client.get(f"/api/bookings/popular-times{query}")

    assert response.status_code == 422
    assert response.json()["code"] == "validation_error"
    assert set(response.json()["fieldErrors"]) == {"spaceId"}
    booking_service.popular_times.assert_not_called()


# --- GET /api/bookings/availability ---

FREE = AvailabilityResponseSchema(available=True, free_desks=2, message=None)


def test_availability_is_public_and_not_caught_by_the_booking_id_route(
    client: TestClient, booking_service: Mock
) -> None:
    booking_service.availability.return_value = FREE

    response = client.get("/api/bookings/availability", params=QUERY)

    assert response.status_code == 200
    assert response.json() == {"available": True, "freeDesks": 2, "message": None}
    kwargs = booking_service.availability.call_args.kwargs
    assert kwargs["current_user"] is None
    assert kwargs["data"].model_dump() == {
        "space_id": 7,
        "date": date(2026, 11, 4),
        "start_time": "10:00",
        "end_time": "12:00",
    }
    booking_service.get.assert_not_called()


def test_availability_returns_the_slot_full_message(
    client: TestClient, booking_service: Mock
) -> None:
    booking_service.availability.return_value = AvailabilityResponseSchema(
        available=False, free_desks=None, message="This space is already booked at 10:00"
    )

    response = client.get("/api/bookings/availability", params=QUERY)

    assert response.status_code == 200
    assert response.json() == {
        "available": False,
        "freeDesks": None,
        "message": "This space is already booked at 10:00",
    }


def test_availability_passes_the_signed_in_user(client: TestClient, booking_service: Mock) -> None:
    booking_service.availability.return_value = FREE

    response = client.get("/api/bookings/availability", params=QUERY, headers=AUTH)

    assert response.status_code == 200
    assert booking_service.availability.call_args.kwargs["current_user"].id == 1


def test_availability_with_an_invalid_token_is_401(
    client: TestClient, booking_service: Mock, auth_service: Mock
) -> None:
    auth_service.get_current_user.side_effect = InvalidTokenException()

    response = client.get("/api/bookings/availability", params=QUERY, headers=AUTH)

    assert response.status_code == 401
    assert response.json() == {"detail": "Invalid or expired token", "code": "invalid_token"}
    booking_service.availability.assert_not_called()


def test_availability_query_has_the_same_limits_as_the_post_body() -> None:
    # A limit added only to the schema would pass the Query check and then fail inside the
    # dependency's BookingCreateRequestSchema(...) as a 500, not a 422 with fieldErrors.
    def limits(base: Any, metadata: list[Any]) -> tuple[Any, list[str]]:
        return base, [repr(item) for item in metadata]

    query: dict[str, tuple[Any, list[str]]] = {}
    for parameter in inspect.signature(get_availability_slot, eval_str=True).parameters.values():
        base, *extras = get_args(parameter.annotation)
        (param,) = [extra for extra in extras if isinstance(extra, params.Query)]
        others = [extra for extra in extras if extra is not param]
        assert param.alias is not None
        query[param.alias] = limits(base, [*others, *param.metadata])
    body = {
        field.alias or name: limits(field.annotation, field.metadata)
        for name, field in BookingCreateRequestSchema.model_fields.items()
    }

    assert query == body


@pytest.mark.parametrize(
    ("error", "status_code", "body"),
    [
        (SpaceNotFoundException(), 404, {"detail": "Space not found", "code": "space_not_found"}),
        (
            InvalidSlotException.closed("Glass Room"),
            422,
            {
                "detail": "Glass Room is closed on that day",
                "code": "invalid_slot",
                "fieldErrors": {"date": "Glass Room is closed on that day"},
            },
        ),
        (
            BookingInPastException(),
            422,
            {
                "detail": _NOT_STARTED,
                "code": "booking_in_past",
                "fieldErrors": {"startTime": _NOT_STARTED},
            },
        ),
        (
            BookingTooFarAheadException(),
            422,
            {
                "detail": "Pick a date within the next 365 days",
                "code": "booking_too_far_ahead",
                "fieldErrors": {"date": "Pick a date within the next 365 days"},
            },
        ),
    ],
)
def test_availability_maps_the_service_errors(
    client: TestClient,
    booking_service: Mock,
    error: Exception,
    status_code: int,
    body: dict[str, Any],
) -> None:
    booking_service.availability.side_effect = error

    response = client.get("/api/bookings/availability", params=QUERY)

    assert response.status_code == status_code
    assert response.json() == body


@pytest.mark.parametrize(
    ("changes", "field"),
    [
        ({"spaceId": "abc"}, "spaceId"),
        ({"spaceId": "0"}, "spaceId"),
        ({"spaceId": "2147483648"}, "spaceId"),
        ({"startTime": "9:00"}, "startTime"),
        ({"startTime": "24:00"}, "startTime"),
        ({"endTime": "25:00"}, "endTime"),
        ({"endTime": "24:30"}, "endTime"),
    ],
)
def test_availability_with_an_invalid_query_is_422_with_camel_case_field_errors(
    client: TestClient, booking_service: Mock, changes: dict[str, str | int], field: str
) -> None:
    response = client.get("/api/bookings/availability", params=QUERY | changes)

    assert response.status_code == 422
    body = response.json()
    assert (body["detail"], body["code"]) == ("Validation failed", "validation_error")
    assert set(body["fieldErrors"]) == {field}
    booking_service.availability.assert_not_called()


@pytest.mark.parametrize("missing", ["spaceId", "date", "startTime", "endTime"])
def test_availability_without_a_parameter_is_422(
    client: TestClient, booking_service: Mock, missing: str
) -> None:
    params = {key: value for key, value in QUERY.items() if key != missing}

    response = client.get("/api/bookings/availability", params=params)

    assert response.status_code == 422
    assert response.json()["fieldErrors"] == {missing: "Field required"}
    booking_service.availability.assert_not_called()


def test_availability_with_a_time_off_the_whole_hour_reaches_the_service(
    client: TestClient, booking_service: Mock
) -> None:
    """10:30 has the `HH:mm` shape: the service answers it with `invalid_slot`, as on POST."""
    booking_service.availability.return_value = FREE

    response = client.get("/api/bookings/availability", params=QUERY | {"startTime": "10:30"})

    assert response.status_code == 200
    assert booking_service.availability.call_args.kwargs["data"].start_time == "10:30"
