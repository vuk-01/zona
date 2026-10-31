"""`poetry run seed` on an empty database, twice, at a fixed "now"."""

from __future__ import annotations

from collections import Counter
from collections.abc import Generator
from datetime import UTC, datetime
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select

from app.bookings.models.booking import Booking, BookingStatus
from app.database.session_factory import ISessionFactory
from app.favorites.models.favorite import Favorite
from app.seed import seed
from app.spaces.models.space import Space
from app.users.models.user import User
from app.utils.clock import IClock
from app.utils.di import add_to_di_container, get_from_di_container, remove_from_di_container
from tests.utils import FixedClock

# Wednesday 2026-11-04 10:30 in Podgorica (UTC+1): Hub Morača is open (08:00-20:00).
NOW = datetime(2026, 11, 4, 9, 30, tzinfo=UTC)
GUESTS = ("demo@example.com", "ana", "jelena", "nikola", "luka", "teodora")


@pytest.fixture(autouse=True)
def fixed_clock() -> Generator[FixedClock]:
    clock = FixedClock(NOW)
    add_to_di_container(IClock, clock)
    yield clock
    remove_from_di_container(IClock)


def _count(model: type[Any]) -> int:
    with get_from_di_container(ISessionFactory)() as session:
        return session.scalar(select(func.count()).select_from(model)) or 0


def _login(client: TestClient, email: str) -> dict[str, str]:
    password = "demo1234" if email == "demo@example.com" else "zona1234"
    response = client.post("/api/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['token']}"}


def _returned_statuses(client: TestClient) -> Counter[str]:
    """Every booking once, by its guest, with the status as the API returns it."""
    statuses: Counter[str] = Counter()
    for guest in GUESTS:
        email = guest if "@" in guest else f"{guest}@zona.app"
        headers = _login(client, email)
        me = client.get("/api/auth/me", headers=headers).json()["id"]
        response = client.get("/api/bookings", params={"guestId": me, "size": 500}, headers=headers)
        assert response.status_code == 200, response.text
        statuses.update(booking["status"] for booking in response.json()["items"])
    return statuses


def _space_id(name: str) -> int:
    with get_from_di_container(ISessionFactory)() as session:
        space_id = session.scalar(select(Space.id).where(Space.name == name))
    assert space_id is not None
    return space_id


def test_seed_on_an_empty_database_creates_the_demo_data(client: TestClient) -> None:
    seed()

    assert _count(User) == 9
    assert _count(Space) == 6
    assert _count(Favorite) == 11
    with get_from_di_container(ISessionFactory)() as session:
        users = {user.email: (user.is_host, user.mode) for user in session.scalars(select(User))}
        spaces = list(session.scalars(select(Space)))
    assert users == {
        "demo@example.com": (False, "guest"),
        "ana@zona.app": (False, "guest"),
        "marko@zona.app": (True, "host"),
        "jelena@zona.app": (False, "guest"),
        "milica@zona.app": (True, "host"),
        "nikola@zona.app": (False, "guest"),
        "ivana@zona.app": (True, "host"),
        "luka@zona.app": (False, "guest"),
        "teodora@zona.app": (True, "guest"),
    }
    assert sorted(space.status for space in spaces) == [
        "draft",
        "listed",
        "listed",
        "listed",
        "listed",
        "listed",
    ]
    for space in spaces:
        age = NOW - space.created_at.replace(tzinfo=UTC)
        # Whole days: the seed puts the creation at 09:00 local time.
        assert 8 * 7 <= age.days <= 10 * 7, space.name

    assert _returned_statuses(client) == {
        "pending": 5,
        "confirmed": 5,
        "declined": 1,
        "cancelled": 2,
        # 338 from the popular-times patterns over the last 56 days, plus Jelena's at Hub Morača.
        "finished": 339,
        "expired": 1,
    }


def test_seed_shows_free_desks_and_popular_times(client: TestClient) -> None:
    seed()
    hub = _space_id("Hub Morača Coworking")

    response = client.get(f"/api/spaces/{hub}")
    assert response.status_code == 200, response.text
    assert response.json()["availableDesks"] == 23

    response = client.get("/api/bookings/popular-times", params={"spaceId": hub})
    assert response.status_code == 200, response.text
    assert response.json() is not None


def test_seed_twice_creates_nothing_new() -> None:
    seed()
    counts = [_count(model) for model in (User, Space, Favorite, Booking)]

    seed()

    assert [_count(model) for model in (User, Space, Favorite, Booking)] == counts


def test_seed_restores_the_clock_it_found(fixed_clock: FixedClock) -> None:
    seed()

    assert get_from_di_container(IClock) is fixed_clock


def test_no_hour_has_more_confirmed_bookings_than_the_space_has_room() -> None:
    seed()

    with get_from_di_container(ISessionFactory)() as session:
        rows = session.execute(
            select(Booking, Space.desk_count)
            .join(Space, Booking.space_id == Space.id)
            .where(Booking.status == BookingStatus.CONFIRMED)
        ).all()
    taken: Counter[tuple[int, object, int]] = Counter()
    units: dict[int, int] = {}
    for booking, desk_count in rows:
        units[booking.space_id] = desk_count or 1
        for hour in range(booking.start_hour, booking.end_hour):
            taken[(booking.space_id, booking.date, hour)] += 1
    assert taken
    assert all(count <= units[space_id] for (space_id, _, _), count in taken.items())
