from __future__ import annotations

from collections.abc import Callable, Generator
from datetime import UTC, date, datetime
from typing import Any

import pytest
from fastapi.testclient import TestClient
from httpx import Response
from sqlalchemy import delete, func, select, update

from app.bookings.models.booking import Booking, BookingStatus
from app.bookings.repositories.booking import BookingRepository
from app.database.session_factory import ISessionFactory
from app.spaces.models.space import Space
from app.users.models.user import User
from app.utils.clock import IClock
from app.utils.di import add_to_di_container, get_from_di_container, remove_from_di_container
from tests.integration.conftest import user_id
from tests.utils import FixedClock, space_body

# Wednesday 2026-10-28 10:00 in Podgorica (CET, UTC+1, since the clocks went back on 25 October).
NOW = datetime(2026, 10, 28, 9, 0, tzinfo=UTC)
# A week later, a Wednesday: the space from `space_id` is open 08:00-20:00.
WEDNESDAY = "2026-11-04"
ALL_DAY = {"open": "00:00", "close": "24:00"}
# The message has an en dash (U+2013) between the hours, as in docs/entities.md.
OPEN_08_TO_20 = f"Hub Morača Coworking is open 08:00{chr(0x2013)}20:00 on that day"

NOT_AUTHENTICATED = {"detail": "Authentication required", "code": "not_authenticated"}
INVALID_TOKEN = {"detail": "Invalid or expired token", "code": "invalid_token"}
SPACE_NOT_FOUND = {"detail": "Space not found", "code": "space_not_found"}


@pytest.fixture(autouse=True)
def set_now() -> Generator[Callable[[datetime], None]]:
    """Every test runs at `NOW`; a test can move the clock."""

    def _set(now: datetime) -> None:
        add_to_di_container(IClock, FixedClock(now))

    _set(NOW)
    yield _set
    remove_from_di_container(IClock)


def book(client: TestClient, headers: dict[str, str], space_id: int, **changes: Any) -> Response:
    body = {"spaceId": space_id, "date": WEDNESDAY, "startTime": "10:00", "endTime": "12:00"}
    return client.post("/api/bookings", json=body | changes, headers=headers)


def new_space(client: TestClient, headers: dict[str, str], **changes: Any) -> int:
    response = client.post("/api/spaces", json=space_body(**changes), headers=headers)
    assert response.status_code == 201, response.text
    return int(response.json()["id"])


def open_every_day() -> dict[str, Any]:
    return dict.fromkeys(("mon", "tue", "wed", "thu", "fri", "sat", "sun"), ALL_DAY)


def booking_rows() -> list[Booking]:
    with get_from_di_container(ISessionFactory)() as session:
        return list(session.scalars(select(Booking).order_by(Booking.id)))


def bookings_in_db() -> int:
    with get_from_di_container(ISessionFactory)() as session:
        return int(session.scalar(select(func.count()).select_from(Booking)) or 0)


def on_second_connection(statement: Any) -> None:
    with get_from_di_container(ISessionFactory).engine.begin() as connection:
        connection.execute(statement)


def as_utc(value: datetime) -> datetime:
    # SQLite returns naive datetimes (stored as UTC), Postgres aware ones.
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


# --- POST: created ------------------------------------------------------------------------------


def test_create_is_201_pending_with_the_price_and_the_local_hours(
    client: TestClient, other_auth_headers: dict[str, str], space_id: int
) -> None:
    response = book(client, other_auth_headers, space_id)

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["spaceId"] == space_id
    assert (body["date"], body["startTime"], body["endTime"]) == (WEDNESDAY, "10:00", "12:00")
    assert body["totalPrice"] == 6  # 3 EUR per desk per hour x 2 hours
    assert body["status"] == "pending"


def test_create_response_has_created_at_and_nested_space_and_guest(
    client: TestClient,
    auth_headers: dict[str, str],
    other_auth_headers: dict[str, str],
    space_id: int,
) -> None:
    response = book(client, other_auth_headers, space_id)

    assert response.status_code == 201, response.text
    body = response.json()
    assert set(body) == {
        "id",
        "spaceId",
        "space",
        "guest",
        "date",
        "startTime",
        "endTime",
        "totalPrice",
        "status",
        "createdAt",
    }  # camelCase, and `endsAt` stays internal
    assert body["createdAt"].endswith("Z")
    [row] = booking_rows()
    assert datetime.fromisoformat(body["createdAt"]) == as_utc(row.created_at)
    assert body["space"] == {
        "id": space_id,
        "name": "Hub Morača Coworking",
        "address": "Bulevar Svetog Petra Cetinjskog 9",
        "hostId": user_id(client, auth_headers),
    }
    assert body["guest"] == {
        "id": user_id(client, other_auth_headers),
        "name": "marko",
        "avatarUrl": None,
    }


# --- POST: who may book -------------------------------------------------------------------------


def test_create_without_token_is_401_with_the_error_shape_and_header(
    client: TestClient, space_id: int
) -> None:
    response = book(client, {}, space_id)

    assert response.status_code == 401
    assert response.json() == NOT_AUTHENTICATED
    assert response.headers["WWW-Authenticate"] == "Bearer"
    assert bookings_in_db() == 0


def test_create_with_an_invalid_token_is_401_invalid_token(
    client: TestClient, space_id: int
) -> None:
    response = book(client, {"Authorization": "Bearer not-a-token"}, space_id)

    assert response.status_code == 401
    assert response.json() == INVALID_TOKEN


def test_create_for_own_space_is_403(
    client: TestClient, auth_headers: dict[str, str], space_id: int
) -> None:
    response = book(client, auth_headers, space_id)

    assert response.status_code == 403
    assert response.json() == {
        "detail": "You cannot book your own space",
        "code": "cannot_book_own_space",
    }
    assert bookings_in_db() == 0


def test_create_for_an_unknown_space_is_404(
    client: TestClient, other_auth_headers: dict[str, str]
) -> None:
    response = book(client, other_auth_headers, 2_000_000)

    assert response.status_code == 404
    assert response.json() == SPACE_NOT_FOUND


def test_create_for_someone_elses_draft_is_404(
    client: TestClient, host_auth_headers: dict[str, str], other_auth_headers: dict[str, str]
) -> None:
    draft_id = new_space(client, host_auth_headers, status="draft")

    response = book(client, other_auth_headers, draft_id)

    assert response.status_code == 404
    assert response.json() == SPACE_NOT_FOUND


# --- POST: input --------------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("changes", "field"),
    [
        ({"spaceId": 0}, "spaceId"),
        ({"date": "2026-02-30"}, "date"),
        ({"startTime": "10"}, "startTime"),
        ({"endTime": "25:00"}, "endTime"),
    ],
)
def test_create_with_invalid_body_is_422_validation_error(
    client: TestClient,
    other_auth_headers: dict[str, str],
    space_id: int,
    changes: dict[str, Any],
    field: str,
) -> None:
    response = book(client, other_auth_headers, space_id, **changes)

    assert response.status_code == 422
    body = response.json()
    assert (body["detail"], body["code"]) == ("Validation failed", "validation_error")
    assert set(body["fieldErrors"]) == {field}


@pytest.mark.parametrize(
    ("changes", "field", "message"),
    [
        ({"startTime": "10:30"}, "startTime", "Pick a whole hour"),
        ({"endTime": "11:15"}, "endTime", "Pick a whole hour"),
        ({"endTime": "10:00"}, "endTime", "End must be after the start"),
        ({"startTime": "12:00", "endTime": "11:00"}, "endTime", "End must be after the start"),
        ({"date": "2026-11-07"}, "date", "Hub Morača Coworking is closed on that day"),
        ({"startTime": "07:00"}, "startTime", OPEN_08_TO_20),
        ({"endTime": "21:00"}, "endTime", OPEN_08_TO_20),
    ],
)
def test_create_with_a_slot_that_breaks_the_rules_is_422_invalid_slot(
    client: TestClient,
    other_auth_headers: dict[str, str],
    space_id: int,
    changes: dict[str, Any],
    field: str,
    message: str,
) -> None:
    response = book(client, other_auth_headers, space_id, **changes)

    assert response.status_code == 422
    assert response.json() == {
        "detail": message,
        "code": "invalid_slot",
        "fieldErrors": {field: message},
    }
    assert bookings_in_db() == 0


@pytest.mark.parametrize(
    ("start", "end", "error_field"),
    [("01:00", "02:00", None), ("01:00", "03:00", "endTime"), ("02:00", "03:00", "startTime")],
)
def test_create_on_the_day_the_clocks_go_forward(
    client: TestClient,
    host_auth_headers: dict[str, str],
    other_auth_headers: dict[str, str],
    set_now: Callable[[datetime], None],
    start: str,
    end: str,
    error_field: str | None,
) -> None:
    """Sunday 2027-03-28: 02:00-03:00 does not exist in Podgorica (ADR-022)."""
    set_now(datetime(2027, 3, 20, 9, 0, tzinfo=UTC))
    space_id = new_space(client, host_auth_headers, openingHours=open_every_day())

    response = book(
        client, other_auth_headers, space_id, date="2027-03-28", startTime=start, endTime=end
    )

    if error_field is None:
        assert response.status_code == 201, response.text
        return
    message = "02:00 does not exist on that day"
    assert response.status_code == 422
    assert response.json() == {
        "detail": message,
        "code": "invalid_slot",
        "fieldErrors": {error_field: message},
    }


@pytest.mark.parametrize(("start", "status_code"), [("09:00", 422), ("10:00", 422), ("11:00", 201)])
def test_create_that_starts_now_or_earlier_is_422_booking_in_past(
    client: TestClient,
    other_auth_headers: dict[str, str],
    space_id: int,
    set_now: Callable[[datetime], None],
    start: str,
    status_code: int,
) -> None:
    set_now(datetime(2026, 11, 4, 9, 0, tzinfo=UTC))  # Wednesday 10:00 in Podgorica, exactly

    response = book(client, other_auth_headers, space_id, startTime=start, endTime="12:00")

    assert response.status_code == status_code, response.text
    if status_code == 422:
        message = "Pick a time that has not started yet"
        assert response.json() == {
            "detail": message,
            "code": "booking_in_past",
            "fieldErrors": {"startTime": message},
        }


def test_ends_at_on_the_day_the_clocks_go_back_takes_the_first_02_00(
    client: TestClient,
    host_auth_headers: dict[str, str],
    other_auth_headers: dict[str, str],
    set_now: Callable[[datetime], None],
) -> None:
    """Sunday 2026-10-25: 02:00 happens twice; the slot uses the first one, still CEST (ADR-022)."""
    set_now(datetime(2026, 10, 20, 9, 0, tzinfo=UTC))
    space_id = new_space(client, host_auth_headers, openingHours=open_every_day())

    for start, end in (("01:00", "02:00"), ("02:00", "03:00")):
        response = book(
            client, other_auth_headers, space_id, date="2026-10-25", startTime=start, endTime=end
        )
        assert response.status_code == 201, response.text

    first, second = booking_rows()
    assert as_utc(first.ends_at) == datetime(2026, 10, 25, 0, 0, tzinfo=UTC)  # 02:00 CEST
    assert as_utc(second.ends_at) == datetime(2026, 10, 25, 2, 0, tzinfo=UTC)  # 03:00 CET
    assert (first.date, first.start_hour, first.end_hour) == (date(2026, 10, 25), 1, 2)


# --- POST: room (advice only, ADR-023) ----------------------------------------------------------


def confirm_in_db(booking_id: int) -> None:
    """Confirms a booking straight in the database: the confirm route comes with the space lock."""
    on_second_connection(
        update(Booking).where(Booking.id == booking_id).values(status=BookingStatus.CONFIRMED)
    )


@pytest.mark.parametrize(
    ("changes", "message"),
    [
        ({"deskCount": 1}, "No desks left at 11:00"),
        (
            {"category": "meeting-room", "deskCount": None},
            "This space is already booked at 11:00",
        ),
    ],
)
def test_create_into_a_full_hour_is_409_slot_full(
    client: TestClient,
    host_auth_headers: dict[str, str],
    other_auth_headers: dict[str, str],
    changes: dict[str, Any],
    message: str,
) -> None:
    space_id = new_space(client, host_auth_headers, **changes)
    taken = book(client, other_auth_headers, space_id, startTime="11:00", endTime="12:00")
    assert taken.status_code == 201, taken.text
    confirm_in_db(taken.json()["id"])

    response = book(client, other_auth_headers, space_id, startTime="10:00", endTime="12:00")

    assert response.status_code == 409
    assert response.json() == {"detail": message, "code": "slot_full"}
    # 12:00-13:00 touches the confirmed slot but does not overlap it: [start, end).
    assert (
        book(client, other_auth_headers, space_id, startTime="12:00", endTime="13:00").status_code
        == 201
    )


def test_a_pending_booking_takes_no_room(
    client: TestClient,
    host_auth_headers: dict[str, str],
    other_auth_headers: dict[str, str],
) -> None:
    space_id = new_space(client, host_auth_headers, category="meeting-room", deskCount=None)

    first = book(client, other_auth_headers, space_id)
    second = book(client, other_auth_headers, space_id)

    assert (first.status_code, second.status_code) == (201, 201)
    assert first.json()["id"] != second.json()["id"]


def test_a_confirmed_booking_takes_no_room_on_another_space_or_day(
    client: TestClient, host_auth_headers: dict[str, str], other_auth_headers: dict[str, str]
) -> None:
    one_desk = new_space(client, host_auth_headers, deskCount=1)
    another_one_desk = new_space(client, host_auth_headers, deskCount=1)
    taken = book(client, other_auth_headers, one_desk)
    confirm_in_db(taken.json()["id"])

    assert book(client, other_auth_headers, another_one_desk).status_code == 201
    assert book(client, other_auth_headers, one_desk, date="2026-11-05").status_code == 201


# --- POST: a row deleted during the request (ADR-019) --------------------------------------------


@pytest.mark.parametrize(
    ("what", "status_code", "error"),
    [("space", 404, SPACE_NOT_FOUND), ("user", 401, INVALID_TOKEN)],
)
def test_create_after_the_space_or_guest_was_deleted_meanwhile(
    client: TestClient,
    other_auth_headers: dict[str, str],
    space_id: int,
    monkeypatch: pytest.MonkeyPatch,
    what: str,
    status_code: int,
    error: dict[str, str],
) -> None:
    marko_id = user_id(client, other_auth_headers)
    gone = (
        delete(Space).where(Space.id == space_id)
        if what == "space"
        else delete(User).where(User.id == marko_id)
    )
    add = BookingRepository.add

    def delete_then_add(self: BookingRepository, booking: Booking) -> Booking:
        on_second_connection(gone)
        return add(self, booking)

    monkeypatch.setattr(BookingRepository, "add", delete_then_add)

    response = book(client, other_auth_headers, space_id)

    assert response.status_code == status_code
    assert response.json() == error
    if status_code == 401:
        assert response.headers["WWW-Authenticate"] == "Bearer"
    assert bookings_in_db() == 0
    # The failed transaction was rolled back, so the next request on the same thread works.
    assert client.get("/api/spaces").status_code == 200
