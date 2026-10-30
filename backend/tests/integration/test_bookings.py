from __future__ import annotations

from collections.abc import Callable, Generator
from datetime import UTC, date, datetime
from typing import Any

import pytest
from fastapi.testclient import TestClient
from httpx import Response
from sqlalchemy import delete, event, func, select, update

from app.bookings.models.booking import Booking, BookingStatus
from app.bookings.repositories.booking import BookingRepository
from app.database.session_factory import ISessionFactory
from app.spaces.models.space import Space
from app.spaces.repositories.space import SpaceRepository
from app.users.models.user import User
from app.utils.clock import IClock
from app.utils.di import add_to_di_container, get_from_di_container, remove_from_di_container
from tests.integration.conftest import register, user_id
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


def change(client: TestClient, headers: dict[str, str], booking_id: int, status: str) -> Response:
    return client.patch(f"/api/bookings/{booking_id}", json={"status": status}, headers=headers)


def confirm(client: TestClient, host_headers: dict[str, str], booking_id: int) -> None:
    """The host confirms through the route, as the frontend does."""
    response = change(client, host_headers, booking_id, "confirmed")
    assert response.status_code == 200, response.text


def invalid_status_change(message: str) -> dict[str, str]:
    return {"detail": message, "code": "invalid_status_change"}


def stored_status(booking_id: int) -> str | None:
    with get_from_di_container(ISessionFactory)() as session:
        return session.scalar(select(Booking.status).where(Booking.id == booking_id))


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
    confirm(client, host_auth_headers, taken.json()["id"])

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
    confirm(client, host_auth_headers, taken.json()["id"])

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


# --- GET list -----------------------------------------------------------------------------------


def list_bookings(client: TestClient, headers: dict[str, str], query: str = "") -> Response:
    return client.get(f"/api/bookings{query}", headers=headers)


def ids(response: Response) -> list[int]:
    assert response.status_code == 200, response.text
    return [booking["id"] for booking in response.json()["items"]]


@pytest.fixture
def jovana_headers(client: TestClient) -> dict[str, str]:
    """A third user, neither the guest nor the host of the bookings above."""
    return register(client, "jovana@example.com")


def test_list_has_the_guests_and_the_hosts_bookings_earliest_first(
    client: TestClient,
    host_auth_headers: dict[str, str],
    other_auth_headers: dict[str, str],
    jovana_headers: dict[str, str],
    space_id: int,
) -> None:
    later = book(client, other_auth_headers, space_id, date="2026-11-05").json()["id"]
    afternoon = book(client, other_auth_headers, space_id, startTime="14:00", endTime="15:00")
    morning = book(client, other_auth_headers, space_id, startTime="09:00", endTime="10:00")
    same_slot = book(client, other_auth_headers, space_id, startTime="09:00", endTime="10:00")
    earliest_first = [
        morning.json()["id"],
        same_slot.json()["id"],
        afternoon.json()["id"],
        later,
    ]

    as_guest = list_bookings(client, other_auth_headers)
    as_host = list_bookings(client, host_auth_headers)

    assert ids(as_guest) == earliest_first
    assert ids(as_host) == earliest_first
    assert as_guest.json()["total"] == 4
    assert ids(list_bookings(client, jovana_headers)) == []


def test_list_item_has_the_same_shape_as_the_created_booking(
    client: TestClient, other_auth_headers: dict[str, str], booking_id: int
) -> None:
    created = client.get(f"/api/bookings/{booking_id}", headers=other_auth_headers).json()

    response = list_bookings(client, other_auth_headers)

    assert response.json() == {"total": 1, "items": [created], "pages": 1}


def test_list_with_guest_id_or_host_id_narrows_to_one_role(
    client: TestClient,
    host_auth_headers: dict[str, str],
    other_auth_headers: dict[str, str],
    space_id: int,
) -> None:
    ana_id = user_id(client, host_auth_headers)
    marko_id = user_id(client, other_auth_headers)
    marko_books_ana = book(client, other_auth_headers, space_id).json()["id"]
    marko_space = new_space(client, make_host(client, other_auth_headers))
    ana_books_marko = book(client, host_auth_headers, marko_space).json()["id"]

    assert ids(list_bookings(client, host_auth_headers)) == [marko_books_ana, ana_books_marko]
    assert ids(list_bookings(client, host_auth_headers, f"?guestId={ana_id}")) == [ana_books_marko]
    assert ids(list_bookings(client, host_auth_headers, f"?hostId={ana_id}")) == [marko_books_ana]
    assert ids(list_bookings(client, other_auth_headers, f"?hostId={marko_id}")) == [
        ana_books_marko
    ]


def test_list_with_another_users_guest_id_is_403(
    client: TestClient, host_auth_headers: dict[str, str], other_auth_headers: dict[str, str]
) -> None:
    marko_id = user_id(client, other_auth_headers)

    response = list_bookings(client, host_auth_headers, f"?guestId={marko_id}")

    assert response.status_code == 403
    assert response.json() == {
        "detail": "You can only list your own bookings",
        "code": "not_own_bookings",
    }


def test_list_with_another_users_host_id_is_403(
    client: TestClient, host_auth_headers: dict[str, str], other_auth_headers: dict[str, str]
) -> None:
    ana_id = user_id(client, host_auth_headers)

    response = list_bookings(client, other_auth_headers, f"?hostId={ana_id}")

    assert response.status_code == 403
    assert response.json() == {
        "detail": "You can only list your own bookings",
        "code": "not_own_bookings",
    }


def test_list_with_space_id_and_date_narrows(
    client: TestClient,
    host_auth_headers: dict[str, str],
    other_auth_headers: dict[str, str],
    space_id: int,
) -> None:
    other_space = new_space(client, host_auth_headers)
    here = book(client, other_auth_headers, space_id).json()["id"]
    there = book(client, other_auth_headers, other_space).json()["id"]
    next_day = book(client, other_auth_headers, space_id, date="2026-11-05").json()["id"]

    assert ids(list_bookings(client, other_auth_headers, f"?spaceId={space_id}")) == [
        here,
        next_day,
    ]
    assert ids(list_bookings(client, other_auth_headers, f"?date={WEDNESDAY}")) == [here, there]
    assert (
        ids(list_bookings(client, other_auth_headers, f"?spaceId={other_space}&date=2026-11-05"))
        == []
    )


def test_list_with_status_matches_the_status_as_returned(
    client: TestClient,
    host_auth_headers: dict[str, str],
    other_auth_headers: dict[str, str],
    space_id: int,
    set_now: Callable[[datetime], None],
) -> None:
    pending = book(client, other_auth_headers, space_id, startTime="08:00", endTime="09:00")
    confirmed = book(client, other_auth_headers, space_id, startTime="09:00", endTime="10:00")
    future = book(client, other_auth_headers, space_id, startTime="12:00", endTime="13:00")
    confirm(client, host_auth_headers, confirmed.json()["id"])
    confirm(client, host_auth_headers, future.json()["id"])
    set_now(datetime(2026, 11, 4, 10, 0, tzinfo=UTC))  # Wednesday 11:00 in Podgorica

    def with_status(status: str) -> list[int]:
        return ids(list_bookings(client, other_auth_headers, f"?status={status}"))

    assert with_status("expired") == [pending.json()["id"]]
    assert with_status("finished") == [confirmed.json()["id"]]
    assert with_status("confirmed") == [future.json()["id"]]
    assert with_status("pending") == []
    statuses = [b["status"] for b in list_bookings(client, other_auth_headers).json()["items"]]
    assert statuses == ["expired", "finished", "confirmed"]


def test_list_pagination(
    client: TestClient, other_auth_headers: dict[str, str], space_id: int
) -> None:
    for start in ("09:00", "10:00", "11:00"):
        book(client, other_auth_headers, space_id, startTime=start, endTime="12:00")

    response = list_bookings(client, other_auth_headers, "?page=2&size=2")

    assert response.status_code == 200
    body = response.json()
    assert (body["total"], body["pages"], len(body["items"])) == (3, 2, 1)
    assert body["items"][0]["startTime"] == "11:00"


def test_list_without_token_is_401(client: TestClient) -> None:
    response = list_bookings(client, {})

    assert response.status_code == 401
    assert response.json() == NOT_AUTHENTICATED
    assert response.headers["WWW-Authenticate"] == "Bearer"


@pytest.mark.parametrize(
    ("query", "field"),
    [
        ("?spaceId=0", "spaceId"),
        ("?guestId=abc", "guestId"),
        ("?hostId=2147483648", "hostId"),
        ("?status=done", "status"),
        ("?date=2026-11-31", "date"),
        ("?size=0", "size"),
        ("?page=0", "page"),
    ],
)
def test_list_with_an_invalid_filter_is_422(
    client: TestClient, other_auth_headers: dict[str, str], query: str, field: str
) -> None:
    response = list_bookings(client, other_auth_headers, query)

    assert response.status_code == 422
    body = response.json()
    assert (body["detail"], body["code"]) == ("Validation failed", "validation_error")
    assert set(body["fieldErrors"]) == {field}


def test_list_reads_space_and_guest_in_the_same_queries_for_any_number_of_rows(
    client: TestClient,
    host_auth_headers: dict[str, str],
    other_auth_headers: dict[str, str],
    space_id: int,
) -> None:
    """No N+1: the host's list runs the same statements for one booking and for three."""
    engine = get_from_di_container(ISessionFactory).engine
    statements: list[str] = []

    def count(*args: Any) -> None:
        statements.append(args[2])

    def statements_for_list(headers: dict[str, str]) -> int:
        statements.clear()
        event.listen(engine, "before_cursor_execute", count)
        try:
            response = list_bookings(client, headers)
        finally:
            event.remove(engine, "before_cursor_execute", count)
        assert response.status_code == 200, response.text
        return len(statements)

    # Each row has its own guest and its own space: a lazy load could not be answered from the
    # identity map, so a missing eager load adds a statement per row.
    book(client, other_auth_headers, space_id)
    with_one = statements_for_list(host_auth_headers)
    for email in ("jovana@example.com", "petar@example.com"):
        guest = register(client, email)
        book(client, guest, new_space(client, host_auth_headers))

    assert statements_for_list(host_auth_headers) == with_one


# --- GET by id ----------------------------------------------------------------------------------


@pytest.fixture
def booking_id(client: TestClient, other_auth_headers: dict[str, str], space_id: int) -> int:
    """Marko's pending booking of Ana's desk space, Wednesday 10:00-12:00."""
    response = book(client, other_auth_headers, space_id)
    assert response.status_code == 201, response.text
    return int(response.json()["id"])


def make_host(client: TestClient, headers: dict[str, str]) -> dict[str, str]:
    response = client.patch(
        f"/api/users/{user_id(client, headers)}", json={"mode": "host"}, headers=headers
    )
    assert response.status_code == 200, response.text
    return headers


def test_get_by_the_guest_and_by_the_host_is_200(
    client: TestClient,
    host_auth_headers: dict[str, str],
    other_auth_headers: dict[str, str],
    booking_id: int,
) -> None:
    as_guest = client.get(f"/api/bookings/{booking_id}", headers=other_auth_headers)
    as_host = client.get(f"/api/bookings/{booking_id}", headers=host_auth_headers)

    assert as_guest.status_code == 200, as_guest.text
    assert as_guest.json() == as_host.json()
    body = as_guest.json()
    assert (body["id"], body["status"], body["startTime"]) == (booking_id, "pending", "10:00")
    assert body["guest"]["id"] == user_id(client, other_auth_headers)
    assert body["space"]["hostId"] == user_id(client, host_auth_headers)


def test_get_by_someone_else_is_403(
    client: TestClient, jovana_headers: dict[str, str], booking_id: int
) -> None:
    response = client.get(f"/api/bookings/{booking_id}", headers=jovana_headers)

    assert response.status_code == 403
    assert response.json() == {
        "detail": "Only the guest or the host can see this booking",
        "code": "not_booking_participant",
    }


def test_get_an_unknown_booking_is_404(
    client: TestClient, other_auth_headers: dict[str, str]
) -> None:
    response = client.get("/api/bookings/2000000", headers=other_auth_headers)

    assert response.status_code == 404
    assert response.json() == {"detail": "Booking not found", "code": "booking_not_found"}


def test_get_without_token_is_401(client: TestClient, booking_id: int) -> None:
    response = client.get(f"/api/bookings/{booking_id}")

    assert response.status_code == 401
    assert response.json() == NOT_AUTHENTICATED


@pytest.mark.parametrize("bad_id", ["abc", "0", "2147483648"])
def test_get_with_an_invalid_id_is_422(
    client: TestClient, other_auth_headers: dict[str, str], bad_id: str
) -> None:
    response = client.get(f"/api/bookings/{bad_id}", headers=other_auth_headers)

    assert response.status_code == 422
    body = response.json()
    assert (body["code"], set(body["fieldErrors"])) == ("validation_error", {"booking_id"})


@pytest.mark.parametrize(("confirmed", "returned"), [(False, "expired"), (True, "finished")])
def test_get_after_the_slot_ended_returns_expired_or_finished(
    client: TestClient,
    host_auth_headers: dict[str, str],
    other_auth_headers: dict[str, str],
    booking_id: int,
    set_now: Callable[[datetime], None],
    confirmed: bool,
    returned: str,
) -> None:
    if confirmed:
        confirm(client, host_auth_headers, booking_id)
    path = f"/api/bookings/{booking_id}"
    # The slot ends Wednesday 12:00 in Podgorica = 11:00 UTC.
    set_now(datetime(2026, 11, 4, 10, 59, tzinfo=UTC))
    before = client.get(path, headers=other_auth_headers).json()["status"]
    set_now(datetime(2026, 11, 4, 11, 0, tzinfo=UTC))
    after = client.get(path, headers=other_auth_headers).json()["status"]

    assert (before, after) == ("confirmed" if confirmed else "pending", returned)
    [row] = booking_rows()
    assert row.status == ("confirmed" if confirmed else "pending")  # the stored status stays


def test_guest_still_sees_the_booking_after_the_host_turns_the_space_into_a_draft(
    client: TestClient,
    host_auth_headers: dict[str, str],
    other_auth_headers: dict[str, str],
    space_id: int,
    booking_id: int,
) -> None:
    response = client.patch(
        f"/api/spaces/{space_id}", json={"status": "draft"}, headers=host_auth_headers
    )
    assert response.status_code == 200, response.text

    assert client.get(f"/api/spaces/{space_id}", headers=other_auth_headers).status_code == 404
    assert client.get(f"/api/bookings/{booking_id}", headers=other_auth_headers).status_code == 200
    assert ids(list_bookings(client, other_auth_headers)) == [booking_id]


# --- PATCH: decline and cancel ------------------------------------------------------------------


def test_host_declines_a_pending_booking(
    client: TestClient, host_auth_headers: dict[str, str], booking_id: int
) -> None:
    response = change(client, host_auth_headers, booking_id, "declined")

    assert response.status_code == 200, response.text
    assert (response.json()["id"], response.json()["status"]) == (booking_id, "declined")
    assert stored_status(booking_id) == "declined"


@pytest.mark.parametrize("confirmed", [False, True])
@pytest.mark.parametrize("who", ["guest", "host"])
def test_guest_or_host_cancels_a_pending_or_confirmed_booking(
    client: TestClient,
    host_auth_headers: dict[str, str],
    other_auth_headers: dict[str, str],
    booking_id: int,
    who: str,
    confirmed: bool,
) -> None:
    if confirmed:
        confirm(client, host_auth_headers, booking_id)
    headers = other_auth_headers if who == "guest" else host_auth_headers

    response = change(client, headers, booking_id, "cancelled")

    assert response.status_code == 200, response.text
    assert response.json()["status"] == "cancelled"
    assert stored_status(booking_id) == "cancelled"


def test_guest_declines_is_403_not_booking_host(
    client: TestClient, other_auth_headers: dict[str, str], booking_id: int
) -> None:
    response = change(client, other_auth_headers, booking_id, "declined")

    assert response.status_code == 403
    assert response.json() == {
        "detail": "Only the host can confirm or decline this booking",
        "code": "not_booking_host",
    }
    assert stored_status(booking_id) == "pending"


def test_patch_by_someone_else_is_403(
    client: TestClient, jovana_headers: dict[str, str], booking_id: int
) -> None:
    response = change(client, jovana_headers, booking_id, "cancelled")

    assert response.status_code == 403
    assert response.json()["code"] == "not_booking_participant"
    assert stored_status(booking_id) == "pending"


@pytest.mark.parametrize(
    ("first", "then", "message"),
    [
        ("confirmed", "confirmed", "Confirmed bookings cannot be confirmed again"),
        ("cancelled", "cancelled", "Cancelled bookings cannot be cancelled again"),
        ("declined", "declined", "Declined bookings cannot be declined again"),
        ("declined", "confirmed", "Only a pending booking can be confirmed"),
        ("declined", "cancelled", "Only a pending or confirmed booking can be cancelled"),
        ("cancelled", "confirmed", "Only a pending booking can be confirmed"),
        ("cancelled", "declined", "Only a pending booking can be declined"),
    ],
)
def test_a_change_the_flow_does_not_allow_is_422(
    client: TestClient,
    host_auth_headers: dict[str, str],
    booking_id: int,
    first: str,
    then: str,
    message: str,
) -> None:
    assert change(client, host_auth_headers, booking_id, first).status_code == 200

    response = change(client, host_auth_headers, booking_id, then)

    assert response.status_code == 422
    assert response.json() == invalid_status_change(message)
    assert stored_status(booking_id) == first


def test_declining_a_confirmed_booking_is_422(
    client: TestClient, host_auth_headers: dict[str, str], booking_id: int
) -> None:
    confirm(client, host_auth_headers, booking_id)

    response = change(client, host_auth_headers, booking_id, "declined")

    assert response.status_code == 422
    assert response.json() == invalid_status_change("Only a pending booking can be declined")


@pytest.mark.parametrize("confirmed", [False, True])
def test_cancelling_after_the_slot_ended_is_422(
    client: TestClient,
    host_auth_headers: dict[str, str],
    other_auth_headers: dict[str, str],
    booking_id: int,
    set_now: Callable[[datetime], None],
    confirmed: bool,
) -> None:
    """An expired or finished booking is final."""
    if confirmed:
        confirm(client, host_auth_headers, booking_id)
    set_now(datetime(2026, 11, 4, 11, 0, tzinfo=UTC))  # Wednesday 12:00 in Podgorica, the end

    response = change(client, other_auth_headers, booking_id, "cancelled")

    assert response.status_code == 422
    assert response.json() == invalid_status_change(
        "Only a pending or confirmed booking can be cancelled"
    )


def test_patch_an_unknown_booking_is_404(
    client: TestClient, other_auth_headers: dict[str, str]
) -> None:
    response = change(client, other_auth_headers, 2_000_000, "cancelled")

    assert response.status_code == 404
    assert response.json() == {"detail": "Booking not found", "code": "booking_not_found"}


@pytest.mark.parametrize(
    "body", [{}, {"status": "pending"}, {"status": "expired"}, {"status": "confirmed "}]
)
def test_patch_with_an_invalid_body_is_422(
    client: TestClient,
    other_auth_headers: dict[str, str],
    booking_id: int,
    body: dict[str, Any],
) -> None:
    response = client.patch(f"/api/bookings/{booking_id}", json=body, headers=other_auth_headers)

    assert response.status_code == 422
    body = response.json()
    assert (body["code"], set(body["fieldErrors"])) == ("validation_error", {"status"})


def test_patch_without_token_is_401(client: TestClient, booking_id: int) -> None:
    response = change(client, {}, booking_id, "cancelled")

    assert response.status_code == 401
    assert response.json() == NOT_AUTHENTICATED
    assert stored_status(booking_id) == "pending"


# --- PATCH: confirm under the space lock (ADR-023) ----------------------------------------------


def space_row(space_id: int) -> tuple[Any, ...]:
    """Every column of the space as the database has it."""
    with get_from_di_container(ISessionFactory)() as session:
        return tuple(session.execute(select(Space.__table__).where(Space.id == space_id)).one())


def test_host_confirms_a_pending_booking(
    client: TestClient, host_auth_headers: dict[str, str], booking_id: int
) -> None:
    response = change(client, host_auth_headers, booking_id, "confirmed")

    assert response.status_code == 200, response.text
    assert (response.json()["id"], response.json()["status"]) == (booking_id, "confirmed")
    assert stored_status(booking_id) == "confirmed"


def test_the_lock_leaves_the_space_row_unchanged(
    client: TestClient, host_auth_headers: dict[str, str], space_id: int, booking_id: int
) -> None:
    before = space_row(space_id)

    confirm(client, host_auth_headers, booking_id)

    assert space_row(space_id) == before


def test_guest_confirms_is_403_not_booking_host(
    client: TestClient, other_auth_headers: dict[str, str], booking_id: int
) -> None:
    response = change(client, other_auth_headers, booking_id, "confirmed")

    assert response.status_code == 403
    assert response.json() == {
        "detail": "Only the host can confirm or decline this booking",
        "code": "not_booking_host",
    }
    assert stored_status(booking_id) == "pending"


def test_confirm_by_someone_else_is_403(
    client: TestClient, jovana_headers: dict[str, str], booking_id: int
) -> None:
    response = change(client, make_host(client, jovana_headers), booking_id, "confirmed")

    assert response.status_code == 403
    assert response.json()["code"] == "not_booking_participant"
    assert stored_status(booking_id) == "pending"


def test_confirm_an_unknown_booking_is_404(
    client: TestClient, host_auth_headers: dict[str, str]
) -> None:
    response = change(client, host_auth_headers, 2_000_000, "confirmed")

    assert response.status_code == 404
    assert response.json() == {"detail": "Booking not found", "code": "booking_not_found"}


def test_confirm_without_token_is_401(client: TestClient, booking_id: int) -> None:
    response = change(client, {}, booking_id, "confirmed")

    assert response.status_code == 401
    assert response.json() == NOT_AUTHENTICATED
    assert stored_status(booking_id) == "pending"


@pytest.mark.parametrize("bad_id", ["abc", "0", "2147483648"])
def test_confirm_with_an_invalid_id_is_422(
    client: TestClient, host_auth_headers: dict[str, str], bad_id: str
) -> None:
    response = client.patch(
        f"/api/bookings/{bad_id}", json={"status": "confirmed"}, headers=host_auth_headers
    )

    assert response.status_code == 422
    assert set(response.json()["fieldErrors"]) == {"booking_id"}


@pytest.mark.parametrize(
    ("changes", "confirmed", "message"),
    [
        ({"deskCount": 2}, [("10:00", "12:00"), ("11:00", "12:00")], "No desks left at 11:00"),
        (
            {"category": "meeting-room", "deskCount": None},
            [("10:00", "12:00")],
            "This space is already booked at 11:00",
        ),
    ],
)
def test_confirm_into_a_full_hour_is_409_slot_full_with_the_first_full_hour(
    client: TestClient,
    host_auth_headers: dict[str, str],
    other_auth_headers: dict[str, str],
    changes: dict[str, Any],
    confirmed: list[tuple[str, str]],
    message: str,
) -> None:
    space_id = new_space(client, host_auth_headers, **changes)
    # Booked while the slot is free (POST only advises), confirmed after the others took it.
    later = book(client, other_auth_headers, space_id, startTime="11:00", endTime="13:00")
    for start, end in confirmed:
        booked = book(client, other_auth_headers, space_id, startTime=start, endTime=end)
        confirm(client, host_auth_headers, booked.json()["id"])

    response = change(client, host_auth_headers, later.json()["id"], "confirmed")

    assert response.status_code == 409
    assert response.json() == {"detail": message, "code": "slot_full"}
    assert stored_status(later.json()["id"]) == "pending"


def test_confirm_counts_hour_by_hour(
    client: TestClient, host_auth_headers: dict[str, str], other_auth_headers: dict[str, str]
) -> None:
    """docs/entities.md: 2 desks, confirmed 09-10 and 11-12; a new 09-12 is allowed."""
    space_id = new_space(client, host_auth_headers, deskCount=2)
    for start, end in (("09:00", "10:00"), ("11:00", "12:00")):
        booked = book(client, other_auth_headers, space_id, startTime=start, endTime=end)
        confirm(client, host_auth_headers, booked.json()["id"])
    wide = book(client, other_auth_headers, space_id, startTime="09:00", endTime="12:00")

    response = change(client, host_auth_headers, wide.json()["id"], "confirmed")

    assert response.status_code == 200, response.text
    # Now 09:00 and 11:00 are full, 10:00 still has a desk.
    full = book(client, other_auth_headers, space_id, startTime="10:00", endTime="12:00")
    assert full.json() == {"detail": "No desks left at 11:00", "code": "slot_full"}
    assert (
        book(client, other_auth_headers, space_id, startTime="10:00", endTime="11:00").status_code
        == 201
    )


def test_confirm_after_the_slot_ended_is_422(
    client: TestClient,
    host_auth_headers: dict[str, str],
    booking_id: int,
    set_now: Callable[[datetime], None],
) -> None:
    """An expired booking cannot be confirmed."""
    set_now(datetime(2026, 11, 4, 11, 0, tzinfo=UTC))  # Wednesday 12:00 in Podgorica, the end

    response = change(client, host_auth_headers, booking_id, "confirmed")

    assert response.status_code == 422
    assert response.json() == invalid_status_change("Only a pending booking can be confirmed")
    assert stored_status(booking_id) == "pending"


def test_confirm_after_the_space_became_a_draft_is_200_today(
    client: TestClient,
    host_auth_headers: dict[str, str],
    other_auth_headers: dict[str, str],
    space_id: int,
    booking_id: int,
) -> None:
    """The current behaviour, not a decision of the contract.

    docs/entities.md filters bookings by who takes part, not by whether the space is listed, and
    says nothing about confirming on a draft; the question is in docs/follow-ups.md.
    """
    response = client.patch(
        f"/api/spaces/{space_id}", json={"status": "draft"}, headers=host_auth_headers
    )
    assert response.status_code == 200, response.text

    confirmed = change(client, host_auth_headers, booking_id, "confirmed")

    assert confirmed.status_code == 200, confirmed.text
    assert confirmed.json()["status"] == "confirmed"
    seen = client.get(f"/api/bookings/{booking_id}", headers=other_auth_headers)
    assert seen.json()["status"] == "confirmed"


# --- DELETE -------------------------------------------------------------------------------------


def test_guest_deletes_a_pending_booking(
    client: TestClient, other_auth_headers: dict[str, str], booking_id: int
) -> None:
    response = client.delete(f"/api/bookings/{booking_id}", headers=other_auth_headers)

    assert response.status_code == 204
    assert response.content == b""
    assert stored_status(booking_id) is None


def test_host_deletes_is_403_not_booking_guest(
    client: TestClient, host_auth_headers: dict[str, str], booking_id: int
) -> None:
    response = client.delete(f"/api/bookings/{booking_id}", headers=host_auth_headers)

    assert response.status_code == 403
    assert response.json() == {
        "detail": "Only the guest can delete this booking",
        "code": "not_booking_guest",
    }
    assert stored_status(booking_id) == "pending"


def test_delete_by_someone_else_is_403(
    client: TestClient, jovana_headers: dict[str, str], booking_id: int
) -> None:
    response = client.delete(f"/api/bookings/{booking_id}", headers=jovana_headers)

    assert response.status_code == 403
    assert response.json()["code"] == "not_booking_participant"


@pytest.mark.parametrize("state", ["confirmed", "cancelled", "expired"])
def test_delete_when_not_pending_is_422(
    client: TestClient,
    host_auth_headers: dict[str, str],
    other_auth_headers: dict[str, str],
    booking_id: int,
    set_now: Callable[[datetime], None],
    state: str,
) -> None:
    if state == "confirmed":
        confirm(client, host_auth_headers, booking_id)
    elif state == "cancelled":
        assert change(client, other_auth_headers, booking_id, "cancelled").status_code == 200
    else:
        set_now(datetime(2026, 11, 4, 11, 0, tzinfo=UTC))

    response = client.delete(f"/api/bookings/{booking_id}", headers=other_auth_headers)

    assert response.status_code == 422
    assert response.json() == invalid_status_change("Only a pending booking can be deleted")
    assert stored_status(booking_id) is not None


def test_delete_an_unknown_booking_is_404(
    client: TestClient, other_auth_headers: dict[str, str]
) -> None:
    response = client.delete("/api/bookings/2000000", headers=other_auth_headers)

    assert response.status_code == 404
    assert response.json()["code"] == "booking_not_found"


@pytest.mark.parametrize("bad_id", ["abc", "0", "2147483648"])
def test_patch_or_delete_with_an_invalid_id_is_422(
    client: TestClient, other_auth_headers: dict[str, str], bad_id: str
) -> None:
    patched = client.patch(
        f"/api/bookings/{bad_id}", json={"status": "cancelled"}, headers=other_auth_headers
    )
    deleted = client.delete(f"/api/bookings/{bad_id}", headers=other_auth_headers)

    for response in (patched, deleted):
        assert response.status_code == 422
        assert set(response.json()["fieldErrors"]) == {"booking_id"}


def test_delete_without_token_is_401(client: TestClient, booking_id: int) -> None:
    response = client.delete(f"/api/bookings/{booking_id}")

    assert response.status_code == 401
    assert response.json() == NOT_AUTHENTICATED
    assert stored_status(booking_id) == "pending"


# --- PATCH and DELETE: the row changes between the read and the compare-and-set ----------------


def run_first(monkeypatch: pytest.MonkeyPatch, method: str, statement: Any) -> None:
    """Runs `statement` on a second connection right before `BookingRepository.<method>`."""
    original = getattr(BookingRepository, method)

    def parallel_then_original(self: BookingRepository, *args: Any, **kwargs: Any) -> Any:
        on_second_connection(statement)
        return original(self, *args, **kwargs)

    monkeypatch.setattr(BookingRepository, method, parallel_then_original)


def test_patch_of_a_booking_deleted_meanwhile_is_404(
    client: TestClient,
    host_auth_headers: dict[str, str],
    booking_id: int,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    run_first(monkeypatch, "set_status", delete(Booking).where(Booking.id == booking_id))

    response = change(client, host_auth_headers, booking_id, "declined")

    assert response.status_code == 404
    assert response.json() == {"detail": "Booking not found", "code": "booking_not_found"}
    assert stored_status(booking_id) is None


def test_patch_of_a_booking_changed_meanwhile_is_422(
    client: TestClient,
    host_auth_headers: dict[str, str],
    booking_id: int,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The host declines while the guest's parallel request cancels: the cancel stays."""
    run_first(
        monkeypatch,
        "set_status",
        update(Booking).where(Booking.id == booking_id).values(status=BookingStatus.CANCELLED),
    )

    response = change(client, host_auth_headers, booking_id, "declined")

    assert response.status_code == 422
    assert response.json() == invalid_status_change("Only a pending booking can be declined")
    assert stored_status(booking_id) == "cancelled"


@pytest.mark.parametrize(
    ("statement_for", "status_code", "body", "left"),
    [
        ("delete", 404, {"detail": "Booking not found", "code": "booking_not_found"}, None),
        (
            "confirm",
            422,
            invalid_status_change("Only a pending booking can be deleted"),
            "confirmed",
        ),
    ],
)
def test_delete_of_a_booking_deleted_or_changed_meanwhile(
    client: TestClient,
    other_auth_headers: dict[str, str],
    booking_id: int,
    monkeypatch: pytest.MonkeyPatch,
    statement_for: str,
    status_code: int,
    body: dict[str, str],
    left: str | None,
) -> None:
    statement = (
        delete(Booking).where(Booking.id == booking_id)
        if statement_for == "delete"
        else update(Booking).where(Booking.id == booking_id).values(status=BookingStatus.CONFIRMED)
    )
    run_first(monkeypatch, "delete_pending", statement)

    response = client.delete(f"/api/bookings/{booking_id}", headers=other_auth_headers)

    assert response.status_code == status_code
    assert response.json() == body
    assert stored_status(booking_id) == left


def test_confirm_of_a_booking_deleted_after_the_lock_is_404(
    client: TestClient,
    host_auth_headers: dict[str, str],
    booking_id: int,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The row goes between the read and the compare-and-set: the re-read finds no row.

    On SQLite the space lock already holds the database's write lock, so a second connection
    cannot delete here; the DELETE runs in the request's own session, as in `test_favorites.py`.
    """
    set_status = BookingRepository.set_status

    def deleted_then_set_status(self: BookingRepository, *args: Any, **kwargs: Any) -> bool:
        self._session_factory().execute(delete(Booking).where(Booking.id == booking_id))
        return set_status(self, *args, **kwargs)

    monkeypatch.setattr(BookingRepository, "set_status", deleted_then_set_status)

    response = change(client, host_auth_headers, booking_id, "confirmed")

    assert response.status_code == 404
    assert response.json() == {"detail": "Booking not found", "code": "booking_not_found"}


def test_confirm_of_a_booking_deleted_between_the_participant_check_and_the_lock_is_404(
    client: TestClient,
    host_auth_headers: dict[str, str],
    booking_id: int,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Only reads ran before the lock, so a second connection can still delete the row."""
    lock_for_booking = SpaceRepository.lock_for_booking

    def deleted_then_lock(self: SpaceRepository, *args: Any, **kwargs: Any) -> int | None:
        on_second_connection(delete(Booking).where(Booking.id == booking_id))
        return lock_for_booking(self, *args, **kwargs)

    monkeypatch.setattr(SpaceRepository, "lock_for_booking", deleted_then_lock)

    response = change(client, host_auth_headers, booking_id, "confirmed")

    assert response.status_code == 404
    assert response.json() == {"detail": "Booking not found", "code": "booking_not_found"}
    assert stored_status(booking_id) is None
