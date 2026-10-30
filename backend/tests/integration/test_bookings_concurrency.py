"""Parallel confirms under the space lock (ADR-023): the second writer waits in the database.

A `threading.Barrier` would only show that two threads reached the same line of Python. Here the
real `SpaceRepository.lock_for_booking` is wrapped: thread A takes the lock and holds its
transaction open until the test releases it; thread B sets `b_calling` right before calling the
real lock and `b_returned` right after it. While A holds the lock, B must not return within
`BLOCKED_FOR`: it is waiting in the database (SQLite's busy handler on the write lock, a row lock
on Postgres). The control test replaces the lock with a plain read and must overbook.

The same file runs on SQLite (default) and on Postgres through `DATABASE_URL`:

    docker compose up -d db
    docker compose exec db createdb -U app app_test     # the `app` database stays untouched
    DATABASE_URL=postgresql+psycopg://app:app@localhost:5432/app_test \
        poetry run pytest tests/integration

SQLite: 3 passed, 15 runs in a row. Postgres: not verified yet (2026-10-30, Docker was not running).
"""

from __future__ import annotations

import threading
from collections.abc import Callable, Generator
from concurrent.futures import Future, ThreadPoolExecutor
from datetime import UTC, date, datetime
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.bookings.models.booking import Booking, BookingStatus
from app.bookings.repositories.booking import BookingRepository, IBookingRepository
from app.database.session_factory import ISessionFactory
from app.spaces.repositories.space import ISpaceRepository, SpaceRepository
from app.utils.clock import IClock
from app.utils.di import add_to_di_container, get_from_di_container, remove_from_di_container
from tests.utils import FixedClock, space_body

# Wednesday 2026-10-28 10:00 in Podgorica; the bookings are a week later, 10:00-12:00.
NOW = datetime(2026, 10, 28, 9, 0, tzinfo=UTC)
WEDNESDAY = "2026-11-04"
# How long B gets to pass the lock if nothing holds it back: far below pysqlite's 5 s busy timeout.
BLOCKED_FOR = 0.3
# An upper bound for every other wait, so a broken lock fails the test instead of hanging it.
TIMEOUT = 5.0


@pytest.fixture(autouse=True)
def fixed_clock() -> Generator[None]:
    add_to_di_container(IClock, FixedClock(NOW))
    yield
    remove_from_di_container(IClock)


class GatedSpaceRepository(SpaceRepository):
    """The real repository; `lock_for_booking` runs callbacks around the real lock, per booking."""

    def __init__(self, session_factory: ISessionFactory) -> None:
        super().__init__(session_factory)
        self.before: dict[int, Callable[[], None]] = {}
        self.after: dict[int, Callable[[], None]] = {}

    def lock_for_booking(self, booking_id: int) -> int | None:
        self.before.get(booking_id, _nothing)()
        space_id = super().lock_for_booking(booking_id)
        self.after.get(booking_id, _nothing)()
        return space_id


class NoLockSpaceRepository(SpaceRepository):
    """The control: finds the space like the lock does, but with a plain read that locks nothing."""

    def lock_for_booking(self, booking_id: int) -> int | None:
        db = self._session_factory()
        return db.scalar(select(Booking.space_id).where(Booking.id == booking_id))


class CountTogetherBookingRepository(BookingRepository):
    """The control: every confirm counts, then waits until the other one has counted too."""

    def __init__(self, session_factory: ISessionFactory, barrier: threading.Barrier) -> None:
        super().__init__(session_factory)
        self._barrier = barrier

    def confirmed_per_hour(
        self, space_id: int, day: date, exclude_id: int | None = None
    ) -> dict[int, int]:
        taken = super().confirmed_per_hour(space_id=space_id, day=day, exclude_id=exclude_id)
        self._barrier.wait()
        return taken


def _nothing() -> None:
    pass


@pytest.fixture
def gated() -> Generator[GatedSpaceRepository]:
    repository = GatedSpaceRepository(get_from_di_container(ISessionFactory))
    add_to_di_container(ISpaceRepository, repository)
    yield repository
    remove_from_di_container(ISpaceRepository)


def new_space(client: TestClient, headers: dict[str, str], **changes: Any) -> int:
    response = client.post("/api/spaces", json=space_body(**changes), headers=headers)
    assert response.status_code == 201, response.text
    return int(response.json()["id"])


def pending_bookings(
    client: TestClient, headers: dict[str, str], space_id: int, count: int
) -> list[int]:
    """`count` pending bookings of the same slot: a pending booking takes no room."""
    body = {"spaceId": space_id, "date": WEDNESDAY, "startTime": "10:00", "endTime": "12:00"}
    ids = []
    for _ in range(count):
        response = client.post("/api/bookings", json=body, headers=headers)
        assert response.status_code == 201, response.text
        ids.append(int(response.json()["id"]))
    return ids


def confirm(client: TestClient, headers: dict[str, str], booking_id: int) -> int:
    response = client.patch(
        f"/api/bookings/{booking_id}", json={"status": "confirmed"}, headers=headers
    )
    assert response.status_code in (200, 409), response.text
    return response.status_code


def confirmed_in_db(space_id: int) -> int:
    with get_from_di_container(ISessionFactory)() as session:
        rows = session.scalars(
            select(Booking.id).where(
                Booking.space_id == space_id, Booking.status == BookingStatus.CONFIRMED
            )
        )
        return len(list(rows))


def hold_after_lock(
    gated: GatedSpaceRepository, booking_id: int
) -> tuple[threading.Event, threading.Event]:
    """A takes the real lock, says so, and keeps its transaction open until released."""
    holds, release = threading.Event(), threading.Event()

    def _hold() -> None:
        holds.set()
        assert release.wait(TIMEOUT), "the test never released A"

    gated.after[booking_id] = _hold
    return holds, release


def watch_lock_call(
    gated: GatedSpaceRepository, booking_id: int
) -> tuple[threading.Event, threading.Event]:
    """`calling` right before the real lock, `returned` right after it."""
    calling, returned = threading.Event(), threading.Event()
    gated.before[booking_id] = calling.set
    gated.after[booking_id] = returned.set
    return calling, returned


@pytest.mark.parametrize(
    ("changes", "waiting", "outcome"),
    [
        ({"category": "meeting-room", "deskCount": None}, 1, [200, 409]),
        ({"deskCount": 2}, 2, [200, 200, 409]),
    ],
)
def test_parallel_confirms_wait_for_the_lock_and_never_overbook(
    client: TestClient,
    host_auth_headers: dict[str, str],
    other_auth_headers: dict[str, str],
    gated: GatedSpaceRepository,
    changes: dict[str, Any],
    waiting: int,
    outcome: list[int],
) -> None:
    space_id = new_space(client, host_auth_headers, **changes)
    first, *others = pending_bookings(client, other_auth_headers, space_id, 1 + waiting)
    a_holds, release_a = hold_after_lock(gated, first)
    watched = [watch_lock_call(gated, booking_id) for booking_id in others]

    with ThreadPoolExecutor(max_workers=1 + waiting) as pool:
        try:
            a: Future[int] = pool.submit(confirm, client, host_auth_headers, first)
            assert a_holds.wait(TIMEOUT), "A never took the lock"
            rest = [pool.submit(confirm, client, host_auth_headers, other) for other in others]
            for calling, _ in watched:
                assert calling.wait(TIMEOUT), "a waiting confirm never reached the lock"
            # Every waiting confirm had BLOCKED_FOR to get through the lock and did not: it
            # waits in the database while A holds the lock.
            assert not any(returned.wait(BLOCKED_FOR) for _, returned in watched)
        finally:
            release_a.set()  # also when an assert failed, so A does not hold on until TIMEOUT
        statuses = [a.result(TIMEOUT)] + [future.result(TIMEOUT) for future in rest]

    # A goes first; which of the others gets the lock next is not asserted, only the sum.
    assert statuses[0] == 200
    assert sorted(statuses) == outcome
    assert confirmed_in_db(space_id) == outcome.count(200)


def test_control_without_the_lock_two_confirms_overbook(
    client: TestClient, host_auth_headers: dict[str, str], other_auth_headers: dict[str, str]
) -> None:
    """Proves the test above can fail: read, count, write without the lock lets both through."""
    space_id = new_space(client, host_auth_headers, category="meeting-room", deskCount=None)
    first, second = pending_bookings(client, other_auth_headers, space_id, 2)
    session_factory = get_from_di_container(ISessionFactory)
    # Only the order of the reads matters here, so a Barrier is enough: both count before
    # either writes.
    barrier = threading.Barrier(2, timeout=TIMEOUT)
    add_to_di_container(ISpaceRepository, NoLockSpaceRepository(session_factory))
    add_to_di_container(
        IBookingRepository, CountTogetherBookingRepository(session_factory, barrier)
    )
    try:
        with ThreadPoolExecutor(max_workers=2) as pool:
            futures = [
                pool.submit(confirm, client, host_auth_headers, booking_id)
                for booking_id in (first, second)
            ]
            statuses = [future.result(TIMEOUT) for future in futures]
    finally:
        remove_from_di_container(IBookingRepository)
        remove_from_di_container(ISpaceRepository)

    assert statuses == [200, 200]
    assert confirmed_in_db(space_id) == 2  # two confirmed bookings in the same hour of one room
