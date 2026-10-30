"""`GET /api/bookings/popular-times` against a real database.

Bookings go through `POST` and `PATCH` with the clock moved back (`add_booking`), because the API
refuses one that has already started. Only the space's `created_at` is written straight into the
table: the database sets it (`server_default`), and the 14-day rule must not depend on the date the
tests run. Own file, next to `test_bookings.py`, because bookings PR 2 changes that one meanwhile.
"""

from __future__ import annotations

from collections.abc import Callable, Generator
from datetime import UTC, date, datetime, time, timedelta
from typing import Any

import pytest
from fastapi.testclient import TestClient
from httpx import Response
from sqlalchemy import update

from app.database.session_factory import ISessionFactory
from app.spaces.models.space import Space
from app.utils.clock import IClock
from app.utils.di import add_to_di_container, get_from_di_container, remove_from_di_container
from tests.integration.conftest import register
from tests.utils import FixedClock, space_body

# Wednesday 2026-10-28 10:00 in Podgorica: the window is 2026-09-02 to 2026-10-27, 8 of each weekday.
NOW = datetime(2026, 10, 28, 9, 0, tzinfo=UTC)
OLD = datetime(2026, 1, 1, tzinfo=UTC)
MONDAYS = [date(2026, 9, 7) + timedelta(weeks=week) for week in range(8)]
EVERY_DAY = {
    day: {"open": "08:00", "close": "22:00"}
    for day in ("mon", "tue", "wed", "thu", "fri", "sat", "sun")
}
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


def new_space(
    client: TestClient, headers: dict[str, str], created_at: datetime = OLD, **changes: Any
) -> int:
    response = client.post("/api/spaces", json=space_body(**changes), headers=headers)
    assert response.status_code == 201, response.text
    space_id = int(response.json()["id"])
    with get_from_di_container(ISessionFactory)() as session:
        session.execute(update(Space).where(Space.id == space_id).values(created_at=created_at))
        session.commit()
    return space_id


@pytest.fixture
def add_booking(
    client: TestClient,
    host_auth_headers: dict[str, str],
    other_auth_headers: dict[str, str],
    set_now: Callable[[datetime], None],
) -> Callable[..., None]:
    """Books through the API the day before `day`, sets `status` through the API, then goes back to `NOW`.

    The API refuses a booking that has already started, so the clock goes back to make history.
    """

    def _add(
        space_id: int,
        day: date,
        start_hour: int,
        end_hour: int,
        status: str = "confirmed",
    ) -> None:
        set_now(datetime.combine(day - timedelta(days=1), time(12), tzinfo=UTC))
        body = {
            "spaceId": space_id,
            "date": day.isoformat(),
            "startTime": f"{start_hour:02d}:00",
            "endTime": f"{end_hour:02d}:00",
        }
        booked = client.post("/api/bookings", json=body, headers=other_auth_headers)
        assert booked.status_code == 201, booked.text
        if status != "pending":
            # The guest cancels, the host confirms or declines.
            headers = other_auth_headers if status == "cancelled" else host_auth_headers
            changed = client.patch(
                f"/api/bookings/{booked.json()['id']}", json={"status": status}, headers=headers
            )
            assert changed.status_code == 200, changed.text
        set_now(NOW)

    return _add


def popular_times(
    client: TestClient, space_id: int | str, headers: dict[str, str] | None = None
) -> Response:
    return client.get(f"/api/bookings/popular-times?spaceId={space_id}", headers=headers)


def at(hour: int) -> int:
    """The index of `hour` in a day's values."""
    return hour - 8


def test_popular_times_average_the_confirmed_bookings_per_weekday_and_hour(
    client: TestClient, host_auth_headers: dict[str, str], add_booking: Callable[..., None]
) -> None:
    space_id = new_space(client, host_auth_headers, deskCount=2, capacity=2)
    add_booking(space_id, MONDAYS[0], 10, 12)
    add_booking(space_id, MONDAYS[0], 10, 12)
    add_booking(space_id, MONDAYS[5], 10, 11)

    response = popular_times(client, space_id)

    assert response.status_code == 200
    body = response.json()
    assert body["firstHour"] == 8
    assert set(body["days"]) == {"mon", "tue", "wed", "thu", "fri", "sat", "sun"}
    monday = body["days"]["mon"]
    assert len(monday) == 14
    # 10:00: 2 + 1 desks of 2 over 8 Mondays = 18.75 %; 11:00: 2 / 16 = 12.5 %, rounded half up.
    assert monday[at(10)] == 19
    assert monday[at(11)] == 13
    assert sum(monday) == 32
    assert body["days"]["tue"] == [0] * 14
    # space_body is closed at the weekend.
    assert body["days"]["sat"] is None
    assert body["days"]["sun"] is None


def test_popular_times_count_only_confirmed_bookings_of_this_space_before_today(
    client: TestClient, host_auth_headers: dict[str, str], add_booking: Callable[..., None]
) -> None:
    space_id = new_space(client, host_auth_headers, deskCount=1, capacity=1)
    other_space_id = new_space(client, host_auth_headers, deskCount=1, capacity=1)
    for status in ("pending", "declined", "cancelled"):
        add_booking(space_id, MONDAYS[0], 10, 11, status=status)
    add_booking(other_space_id, MONDAYS[0], 10, 11)
    # Today (08:00 has passed) and next Wednesday are not history yet.
    add_booking(space_id, date(2026, 10, 28), 8, 9)
    add_booking(space_id, date(2026, 11, 4), 10, 11)
    # 2026-09-01 is one day before the window.
    add_booking(space_id, date(2026, 9, 1), 10, 11)

    response = popular_times(client, space_id)

    assert response.status_code == 200
    days = response.json()["days"]
    assert days["mon"] == [0] * 14
    assert days["tue"] == [0] * 14
    assert days["wed"] == [0] * 14
    assert popular_times(client, other_space_id).json()["days"]["mon"][at(10)] == 13


def test_popular_times_of_a_younger_space_average_from_the_day_after_it_was_created(
    client: TestClient, host_auth_headers: dict[str, str], add_booking: Callable[..., None]
) -> None:
    # Exactly 14 days old, created on 2026-10-14: two Mondays in the window (10-19 and 10-26).
    space_id = new_space(
        client, host_auth_headers, created_at=NOW - timedelta(days=14), deskCount=2, capacity=2
    )
    add_booking(space_id, date(2026, 10, 14), 10, 11)  # Wednesday, the creation day
    add_booking(space_id, date(2026, 10, 19), 10, 11)

    response = popular_times(client, space_id)

    assert response.status_code == 200
    days = response.json()["days"]
    assert days["mon"][at(10)] == 25
    assert days["wed"] == [0] * 14


def test_popular_times_of_a_space_younger_than_14_days_is_200_null(
    client: TestClient, host_auth_headers: dict[str, str], add_booking: Callable[..., None]
) -> None:
    space_id = new_space(client, host_auth_headers, created_at=NOW - timedelta(days=13, hours=23))
    add_booking(space_id, date(2026, 10, 19), 10, 11)

    response = popular_times(client, space_id)

    assert response.status_code == 200
    assert response.content == b"null"


@pytest.mark.parametrize(
    ("today", "sunday"),
    [
        (datetime(2026, 10, 28, 9, 0, tzinfo=UTC), date(2026, 10, 25)),  # the clocks go back
        (datetime(2027, 3, 31, 8, 0, tzinfo=UTC), date(2027, 3, 28)),  # the clocks go forward
    ],
)
def test_popular_times_on_the_days_the_clocks_change_count_like_any_other_day(
    client: TestClient,
    host_auth_headers: dict[str, str],
    add_booking: Callable[..., None],
    set_now: Callable[[datetime], None],
    today: datetime,
    sunday: date,
) -> None:
    space_id = new_space(client, host_auth_headers, category="meeting-room", openingHours=EVERY_DAY)
    add_booking(space_id, sunday, 8, 10)
    set_now(today)

    response = popular_times(client, space_id)

    assert response.status_code == 200
    # One whole space on one of 8 Sundays: 12.5 % at 08:00 and 09:00, nothing else.
    assert response.json()["days"]["sun"] == [13, 13] + [0] * 12


def test_popular_times_of_a_draft_only_for_its_host(
    client: TestClient, host_auth_headers: dict[str, str], other_auth_headers: dict[str, str]
) -> None:
    space_id = new_space(client, host_auth_headers, status="draft")

    assert popular_times(client, space_id, host_auth_headers).status_code == 200
    for headers in (other_auth_headers, None):
        response = popular_times(client, space_id, headers)
        assert response.status_code == 404
        assert response.json() == SPACE_NOT_FOUND


def test_popular_times_of_an_unknown_space_is_404(client: TestClient) -> None:
    response = popular_times(client, 999)

    assert response.status_code == 404
    assert response.json() == SPACE_NOT_FOUND


def test_popular_times_with_an_invalid_token_is_401(client: TestClient, space_id: int) -> None:
    response = popular_times(client, space_id, {"Authorization": "Bearer not-a-token"})

    assert response.status_code == 401
    assert response.json() == INVALID_TOKEN
    assert response.headers["WWW-Authenticate"] == "Bearer"


@pytest.mark.parametrize("bad_id", ["abc", "0", "2147483648"])
def test_popular_times_with_an_invalid_space_id_is_422(client: TestClient, bad_id: str) -> None:
    response = popular_times(client, bad_id)

    assert response.status_code == 422
    assert response.json()["code"] == "validation_error"
    assert set(response.json()["fieldErrors"]) == {"spaceId"}


def test_popular_times_without_space_id_is_422(client: TestClient) -> None:
    response = client.get("/api/bookings/popular-times")

    assert response.status_code == 422
    assert set(response.json()["fieldErrors"]) == {"spaceId"}


def test_popular_times_is_open_to_a_user_who_takes_no_part(
    client: TestClient, space_id: int
) -> None:
    stranger = register(client, "jovana@example.com")

    assert popular_times(client, space_id, stranger).status_code == 200
