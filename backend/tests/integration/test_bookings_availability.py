"""`GET /api/bookings/availability` against a real database.

Availability runs the checks of `POST` and the count of confirm (ADR-028), so the main test asks
both about the same slot and expects the same answer. Own file, next to `test_bookings.py` and
`test_bookings_popular_times.py`, with its own helpers.
"""

from __future__ import annotations

from collections.abc import Callable, Generator
from datetime import UTC, datetime
from typing import Any

import pytest
from fastapi.testclient import TestClient
from httpx import Response
from sqlalchemy import func, select

from app.bookings.models.booking import Booking
from app.database.session_factory import ISessionFactory
from app.utils.clock import IClock
from app.utils.di import add_to_di_container, get_from_di_container, remove_from_di_container
from tests.utils import FixedClock, space_body

# Wednesday 2026-10-28 10:00 in Podgorica (CET, UTC+1).
NOW = datetime(2026, 10, 28, 9, 0, tzinfo=UTC)
# A week later, a Wednesday: `space_body()` is open 08:00-20:00 Monday to Friday.
WEDNESDAY = "2026-11-04"
SLOT = {"date": WEDNESDAY, "startTime": "10:00", "endTime": "12:00"}
EVERY_DAY = {
    day: {"open": "00:00", "close": "24:00"}
    for day in ("mon", "tue", "wed", "thu", "fri", "sat", "sun")
}
INVALID_TOKEN = {"detail": "Invalid or expired token", "code": "invalid_token"}
SPACE_NOT_FOUND = {"detail": "Space not found", "code": "space_not_found"}
WHOLE = {"category": "meeting-room", "deskCount": None}


@pytest.fixture(autouse=True)
def set_now() -> Generator[Callable[[datetime], None]]:
    """Every test runs at `NOW`; a test can move the clock."""

    def _set(now: datetime) -> None:
        add_to_di_container(IClock, FixedClock(now))

    _set(NOW)
    yield _set
    remove_from_di_container(IClock)


def new_space(client: TestClient, headers: dict[str, str], **changes: Any) -> int:
    response = client.post("/api/spaces", json=space_body(**changes), headers=headers)
    assert response.status_code == 201, response.text
    return int(response.json()["id"])


def ask(
    client: TestClient, space_id: int, headers: dict[str, str] | None = None, **changes: str
) -> Response:
    params = {"spaceId": space_id} | SLOT | changes
    return client.get("/api/bookings/availability", params=params, headers=headers)


def book(client: TestClient, headers: dict[str, str], space_id: int, start: str, end: str) -> int:
    body = {"spaceId": space_id, "date": WEDNESDAY, "startTime": start, "endTime": end}
    response = client.post("/api/bookings", json=body, headers=headers)
    assert response.status_code == 201, response.text
    return int(response.json()["id"])


def confirm(client: TestClient, host_headers: dict[str, str], booking_id: int) -> Response:
    return client.patch(
        f"/api/bookings/{booking_id}", json={"status": "confirmed"}, headers=host_headers
    )


def bookings_in_db() -> int:
    with get_from_di_container(ISessionFactory)() as session:
        return int(session.scalar(select(func.count()).select_from(Booking)) or 0)


# --- the same answer as confirm (ADR-028) --------------------------------------------------------


@pytest.mark.parametrize(
    ("changes", "confirmed", "slot", "free_desks", "message"),
    [
        # Empty: every desk free.
        ({"deskCount": 2}, [], ("10:00", "12:00"), 2, None),
        # The example in docs/entities.md: no single hour has more than one desk taken.
        ({"deskCount": 2}, [("09:00", "10:00"), ("11:00", "12:00")], ("09:00", "12:00"), 1, None),
        (
            {"deskCount": 2},
            [("10:00", "12:00")] * 2,
            ("11:00", "13:00"),
            0,
            "No desks left at 11:00",
        ),
        (WHOLE, [("12:00", "14:00")], ("10:00", "12:00"), None, None),  # [start, end)
        (
            WHOLE,
            [("15:00", "16:00")],
            ("14:00", "16:00"),
            None,
            "This space is already booked at 15:00",
        ),
    ],
)
def test_availability_answers_what_a_confirm_of_the_slot_answers(
    client: TestClient,
    host_auth_headers: dict[str, str],
    other_auth_headers: dict[str, str],
    changes: dict[str, Any],
    confirmed: list[tuple[str, str]],
    slot: tuple[str, str],
    free_desks: int | None,
    message: str | None,
) -> None:
    space_id = new_space(client, host_auth_headers, **changes)
    # Pending first, while the slot is free: POST refuses a full slot as advice.
    candidate = book(client, other_auth_headers, space_id, *slot)
    for start, end in confirmed:
        taken = confirm(
            client, host_auth_headers, book(client, other_auth_headers, space_id, start, end)
        )
        assert taken.status_code == 200, taken.text

    asked = ask(client, space_id, startTime=slot[0], endTime=slot[1])
    confirmed_now = confirm(client, host_auth_headers, candidate)

    assert asked.status_code == 200, asked.text
    assert asked.json() == {
        "available": message is None,
        "freeDesks": free_desks,
        "message": message,
    }
    if message is None:
        assert confirmed_now.status_code == 200, confirmed_now.text
    else:
        assert confirmed_now.status_code == 409
        assert confirmed_now.json() == {"detail": message, "code": "slot_full"}


def test_a_pending_booking_takes_no_room(
    client: TestClient, host_auth_headers: dict[str, str], other_auth_headers: dict[str, str]
) -> None:
    space_id = new_space(client, host_auth_headers, **WHOLE)
    book(client, other_auth_headers, space_id, "10:00", "12:00")

    response = ask(client, space_id)

    assert response.json() == {"available": True, "freeDesks": None, "message": None}


def test_availability_writes_nothing(
    client: TestClient, host_auth_headers: dict[str, str], other_auth_headers: dict[str, str]
) -> None:
    space_id = new_space(client, host_auth_headers)

    assert ask(client, space_id, other_auth_headers).status_code == 200
    assert bookings_in_db() == 0


# --- who may ask ---------------------------------------------------------------------------------


def test_availability_is_public(client: TestClient, space_id: int) -> None:
    response = ask(client, space_id)

    assert response.status_code == 200
    assert response.json() == {"available": True, "freeDesks": 20, "message": None}


def test_availability_with_an_invalid_token_is_401(client: TestClient, space_id: int) -> None:
    response = ask(client, space_id, {"Authorization": "Bearer not-a-token"})

    assert response.status_code == 401
    assert response.json() == INVALID_TOKEN
    assert response.headers["WWW-Authenticate"] == "Bearer"


def test_availability_of_an_unknown_space_is_404(client: TestClient) -> None:
    response = ask(client, 2_000_000)

    assert response.status_code == 404
    assert response.json() == SPACE_NOT_FOUND


def test_a_draft_is_404_for_others_and_200_for_its_host(
    client: TestClient, host_auth_headers: dict[str, str], other_auth_headers: dict[str, str]
) -> None:
    draft_id = new_space(client, host_auth_headers, status="draft")

    for headers in (None, other_auth_headers):
        response = ask(client, draft_id, headers)
        assert response.status_code == 404
        assert response.json() == SPACE_NOT_FOUND
    # POST refuses the host's own space (403); availability is only a question.
    assert ask(client, draft_id, host_auth_headers).status_code == 200


# --- the checks of POST --------------------------------------------------------------------------


def test_a_date_more_than_365_days_ahead_is_422_booking_too_far_ahead(
    client: TestClient, space_id: int
) -> None:
    too_far = ask(client, space_id, date="2027-10-29")
    last_day = ask(client, space_id, date="2027-10-28")  # a Thursday, today + 365 days

    assert too_far.status_code == 422
    assert too_far.json() == {
        "detail": "Pick a date within the next 365 days",
        "code": "booking_too_far_ahead",
        "fieldErrors": {"date": "Pick a date within the next 365 days"},
    }
    assert last_day.status_code == 200, last_day.text


@pytest.mark.parametrize(
    "changes",
    [
        {"date": "2026-10-28", "startTime": "10:00", "endTime": "11:00"},  # starts exactly now
        {"date": "2026-10-25"},  # yesterday's Sunday: closed, but the date goes first
    ],
)
def test_a_start_that_is_not_after_now_is_422_booking_in_past(
    client: TestClient, space_id: int, changes: dict[str, str]
) -> None:
    response = ask(client, space_id, None, **changes)

    assert response.status_code == 422
    assert response.json() == {
        "detail": "Pick a time that has not started yet",
        "code": "booking_in_past",
        "fieldErrors": {"startTime": "Pick a time that has not started yet"},
    }


def test_a_closed_day_is_422_invalid_slot(client: TestClient, space_id: int) -> None:
    response = ask(client, space_id, date="2026-11-07")  # a Saturday

    assert response.status_code == 422
    message = "Hub Morača Coworking is closed on that day"
    assert response.json() == {
        "detail": message,
        "code": "invalid_slot",
        "fieldErrors": {"date": message},
    }


@pytest.mark.parametrize(
    ("start", "end", "field"),
    [("02:00", "03:00", "startTime"), ("01:00", "03:00", "endTime"), ("01:00", "02:00", None)],
)
def test_on_the_day_the_clocks_go_forward_the_missing_hour_is_invalid_slot(
    client: TestClient,
    host_auth_headers: dict[str, str],
    start: str,
    end: str,
    field: str | None,
) -> None:
    space_id = new_space(client, host_auth_headers, openingHours=EVERY_DAY)

    response = ask(client, space_id, date="2027-03-28", startTime=start, endTime=end)

    if field is None:
        assert response.status_code == 200, response.text
        return
    message = "02:00 does not exist on that day"
    assert response.status_code == 422
    assert response.json() == {
        "detail": message,
        "code": "invalid_slot",
        "fieldErrors": {field: message},
    }


@pytest.mark.parametrize("value", ["2026-11-04T00:00:00", "1793836800", "2026-11-04\n"])
def test_a_date_that_is_not_yyyy_mm_dd_is_422_with_the_format(
    client: TestClient, space_id: int, value: str
) -> None:
    response = ask(client, space_id, date=value)

    assert response.status_code == 422
    assert response.json() == {
        "detail": "Validation failed",
        "code": "validation_error",
        "fieldErrors": {"date": "Use the format YYYY-MM-DD"},
    }


# --- routing -------------------------------------------------------------------------------------


@pytest.mark.parametrize("signed_in", [False, True])
def test_availability_is_not_read_as_a_booking_id(
    client: TestClient, other_auth_headers: dict[str, str], signed_in: bool
) -> None:
    """Below `/{booking_id}` the path would be an invalid id: 401 without a token, `booking_id` with one."""
    headers = other_auth_headers if signed_in else None

    response = client.get("/api/bookings/availability", headers=headers)

    assert response.status_code == 422
    assert set(response.json()["fieldErrors"]) == {"spaceId", "date", "startTime", "endTime"}
