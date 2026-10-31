"""DELETE /api/spaces under the space lock (ADR-025, ADR-026): no booking is lost to the CASCADE.

`DELETE` counts the active bookings and then deletes the space with every booking it has. A booking
created or confirmed between the count and the DELETE would be deleted with it, after its `POST`
answered `201`. `SpaceRepository.lock` is the first write of the `DELETE`, before the count, so a
parallel `POST` (its INSERT) or confirm (its `lock_for_booking`) waits in the database until the
`DELETE` has ended. As in `test_bookings_concurrency.py`, the real methods are wrapped: thread A
takes the lock and holds its transaction open until the test releases it; thread B sets an event
right before the call that must wait and another one right after it, and must not get through
within `BLOCKED_FOR`.

POST ↔ DELETE is where the rule is at stake: either `POST 404` + `DELETE 204`, or `POST 201` +
`DELETE 409` with the booking still there; never `201` + `204` with the booking gone. The control
test shows that pair without the lock. confirm ↔ DELETE ends the same with or without the lock (a
pending booking is already active, and confirming it does not change the count), so that test
proves only that the two share the lock.

The same file runs on SQLite (default) and on Postgres through `DATABASE_URL` (the command is in
`test_bookings_concurrency.py`). On Postgres the no-op UPDATE alone would not hold back a POST's
foreign-key check; `FOR UPDATE` does (ADR-025). That reasoning is not measured yet: Postgres was
not run (2026-10-31, `docs/follow-ups.md`).
"""

from __future__ import annotations

import threading
from collections.abc import Callable, Generator
from concurrent.futures import Future, ThreadPoolExecutor
from datetime import UTC, datetime
from typing import Any

import pytest
from fastapi.testclient import TestClient
from httpx import Response
from sqlalchemy import func, select

from app.bookings.models.booking import Booking
from app.bookings.repositories.booking import BookingRepository, IBookingRepository
from app.database.session_factory import ISessionFactory
from app.spaces.models.space import Space
from app.spaces.repositories.space import ISpaceRepository, SpaceRepository
from app.utils.clock import IClock
from app.utils.di import add_to_di_container, get_from_di_container, remove_from_di_container
from tests.integration.conftest import register
from tests.utils import FixedClock, space_body

# Wednesday 2026-10-28 10:00 in Podgorica; the bookings are a week later, 10:00-12:00.
NOW = datetime(2026, 10, 28, 9, 0, tzinfo=UTC)
WEDNESDAY = "2026-11-04"
# How long B gets to pass the lock if nothing holds it back: far below pysqlite's 5 s busy timeout.
BLOCKED_FOR = 0.3
# An upper bound for every other wait, so a broken lock fails the test instead of hanging it.
TIMEOUT = 5.0

SPACE_NOT_FOUND = {"detail": "Space not found", "code": "space_not_found"}
ONE_ACTIVE_BOOKING = {
    "detail": "This space has 1 active booking",
    "code": "space_has_active_bookings",
}


@pytest.fixture(autouse=True)
def fixed_clock() -> Generator[None]:
    add_to_di_container(IClock, FixedClock(NOW))
    yield
    remove_from_di_container(IClock)


def _nothing() -> None:
    pass


class GatedSpaceRepository(SpaceRepository):
    """The real repository; both locks run callbacks around the real lock, per space or booking."""

    def __init__(self, session_factory: ISessionFactory) -> None:
        super().__init__(session_factory)
        self.before_lock: dict[int, Callable[[], None]] = {}
        self.after_lock: dict[int, Callable[[], None]] = {}
        self.before_booking_lock: dict[int, Callable[[], None]] = {}
        self.after_booking_lock: dict[int, Callable[[], None]] = {}
        self.lock_calls = 0

    def lock(self, space_id: int) -> int | None:
        self.lock_calls += 1
        self.before_lock.get(space_id, _nothing)()
        locked_id = super().lock(space_id)
        self.after_lock.get(space_id, _nothing)()
        return locked_id

    def lock_for_booking(self, booking_id: int) -> int | None:
        self.before_booking_lock.get(booking_id, _nothing)()
        space_id = super().lock_for_booking(booking_id)
        self.after_booking_lock.get(booking_id, _nothing)()
        return space_id


class NoLockSpaceRepository(GatedSpaceRepository):
    """The control: `lock` finds the space with a plain read that locks nothing."""

    def lock(self, space_id: int) -> int | None:
        self.lock_calls += 1
        db = self._session_factory()
        locked_id = db.scalar(select(Space.id).where(Space.id == space_id))
        self.after_lock.get(space_id, _nothing)()
        return locked_id


class GatedBookingRepository(BookingRepository):
    """The real repository; `add` (the INSERT of a POST) and `booking_counts` run callbacks."""

    def __init__(self, session_factory: ISessionFactory) -> None:
        super().__init__(session_factory)
        self.before_add: Callable[[], None] = _nothing
        self.after_add: Callable[[], None] = _nothing
        self.after_count: Callable[[], None] = _nothing

    def add(self, booking: Booking) -> Booking:
        self.before_add()
        try:
            return super().add(booking)
        finally:
            # Also when the INSERT is refused: B got through the database either way.
            self.after_add()

    def booking_counts(self, space_ids: Any, now: datetime) -> dict[int, tuple[int, int]]:
        counts = super().booking_counts(space_ids=space_ids, now=now)
        self.after_count()
        return counts


@pytest.fixture
def repositories() -> Generator[tuple[GatedSpaceRepository, GatedBookingRepository]]:
    session_factory = get_from_di_container(ISessionFactory)
    spaces, bookings = GatedSpaceRepository(session_factory), GatedBookingRepository(
        session_factory
    )
    add_to_di_container(ISpaceRepository, spaces)
    add_to_di_container(IBookingRepository, bookings)
    yield spaces, bookings
    remove_from_di_container(IBookingRepository)
    remove_from_di_container(ISpaceRepository)


def new_space(client: TestClient, headers: dict[str, str], **changes: Any) -> int:
    response = client.post("/api/spaces", json=space_body(**changes), headers=headers)
    assert response.status_code == 201, response.text
    return int(response.json()["id"])


def post_booking(client: TestClient, headers: dict[str, str], space_id: int) -> Response:
    body = {"spaceId": space_id, "date": WEDNESDAY, "startTime": "10:00", "endTime": "12:00"}
    return client.post("/api/bookings", json=body, headers=headers)


def delete_space(client: TestClient, headers: dict[str, str], space_id: int) -> Response:
    return client.delete(f"/api/spaces/{space_id}", headers=headers)


def confirm(client: TestClient, headers: dict[str, str], booking_id: int) -> Response:
    return client.patch(
        f"/api/bookings/{booking_id}", json={"status": "confirmed"}, headers=headers
    )


def bookings_in_db(space_id: int) -> int:
    with get_from_di_container(ISessionFactory)() as session:
        query = select(func.count()).select_from(Booking).where(Booking.space_id == space_id)
        return int(session.scalar(query) or 0)


def holder() -> tuple[threading.Event, threading.Event, Callable[[], None]]:
    """A callback that says it holds and keeps its transaction open until released."""
    holds, release = threading.Event(), threading.Event()

    def _hold() -> None:
        holds.set()
        assert release.wait(TIMEOUT), "the test never released A"

    return holds, release, _hold


def test_delete_first_holds_the_lock_and_the_parallel_post_is_404(
    client: TestClient,
    host_auth_headers: dict[str, str],
    other_auth_headers: dict[str, str],
    repositories: tuple[GatedSpaceRepository, GatedBookingRepository],
) -> None:
    spaces, bookings = repositories
    space_id = new_space(client, host_auth_headers)
    a_holds, release_a, hold = holder()
    spaces.after_lock[space_id] = hold
    b_calling, b_returned = threading.Event(), threading.Event()
    bookings.before_add, bookings.after_add = b_calling.set, b_returned.set

    with ThreadPoolExecutor(max_workers=2) as pool:
        try:
            a: Future[Response] = pool.submit(delete_space, client, host_auth_headers, space_id)
            assert a_holds.wait(TIMEOUT), "DELETE never took the lock"
            b = pool.submit(post_booking, client, other_auth_headers, space_id)
            assert b_calling.wait(TIMEOUT), "POST never reached its INSERT"
            # The INSERT waits in the database while DELETE holds the lock.
            assert not b_returned.wait(BLOCKED_FOR)
        finally:
            release_a.set()  # also when an assert failed, so A does not hold on until TIMEOUT
        deleted, posted = a.result(TIMEOUT), b.result(TIMEOUT)

    assert deleted.status_code == 204, deleted.text
    # The space was gone by the time the INSERT ran: its foreign key refused it (ADR-019).
    assert (posted.status_code, posted.json()) == (404, SPACE_NOT_FOUND)
    assert bookings_in_db(space_id) == 0


def test_post_first_and_the_parallel_delete_is_409_with_the_booking_kept(
    client: TestClient,
    host_auth_headers: dict[str, str],
    other_auth_headers: dict[str, str],
    repositories: tuple[GatedSpaceRepository, GatedBookingRepository],
) -> None:
    """POST has inserted and is still running when DELETE comes.

    On Postgres POST's transaction is open and its foreign-key check holds the space row: DELETE's
    `FOR UPDATE` waits until POST commits (ADR-025). On SQLite POST's booking is already committed
    when `add()` returns: the INSERT is the request's first write and runs in a SAVEPOINT, and in
    pysqlite's legacy mode the RELEASE of the outermost SAVEPOINT is a COMMIT
    (`docs/follow-ups.md`), so DELETE does not wait and finds the booking. Either way: 409.
    """
    spaces, bookings = repositories
    is_sqlite = get_from_di_container(ISessionFactory).engine.dialect.name == "sqlite"
    space_id = new_space(client, host_auth_headers)
    a_holds, release_a, hold = holder()
    bookings.after_add = hold
    b_calling, b_returned = threading.Event(), threading.Event()
    spaces.before_lock[space_id], spaces.after_lock[space_id] = b_calling.set, b_returned.set

    with ThreadPoolExecutor(max_workers=2) as pool:
        try:
            a: Future[Response] = pool.submit(post_booking, client, other_auth_headers, space_id)
            assert a_holds.wait(TIMEOUT), "POST never inserted"
            b = pool.submit(delete_space, client, host_auth_headers, space_id)
            assert b_calling.wait(TIMEOUT), "DELETE never reached the lock"
            delete_got_through = b_returned.wait(BLOCKED_FOR)
        finally:
            release_a.set()
        posted, deleted = a.result(TIMEOUT), b.result(TIMEOUT)

    assert delete_got_through is is_sqlite
    assert posted.status_code == 201, posted.text
    assert (deleted.status_code, deleted.json()) == (409, ONE_ACTIVE_BOOKING)
    assert bookings_in_db(space_id) == 1


def test_control_without_the_lock_a_parallel_post_is_201_and_its_booking_is_deleted(
    client: TestClient, host_auth_headers: dict[str, str], other_auth_headers: dict[str, str]
) -> None:
    """Proves the two tests above can fail: count, then a POST commits, then the DELETE runs."""
    space_id = new_space(client, host_auth_headers)
    session_factory = get_from_di_container(ISessionFactory)
    spaces, bookings = NoLockSpaceRepository(session_factory), GatedBookingRepository(
        session_factory
    )
    counted, posted_done = threading.Event(), threading.Event()

    def wait_for_the_post() -> None:
        counted.set()
        assert posted_done.wait(TIMEOUT), "the test never let DELETE go on"

    bookings.after_count = wait_for_the_post
    add_to_di_container(ISpaceRepository, spaces)
    add_to_di_container(IBookingRepository, bookings)
    try:
        with ThreadPoolExecutor(max_workers=1) as pool:
            try:
                a: Future[Response] = pool.submit(delete_space, client, host_auth_headers, space_id)
                assert counted.wait(TIMEOUT), "DELETE never counted"
                # DELETE has only read so far (pysqlite's legacy mode, ADR-023): nothing holds
                # the POST back.
                posted = post_booking(client, other_auth_headers, space_id)
            finally:
                posted_done.set()
            deleted = a.result(TIMEOUT)
    finally:
        remove_from_di_container(IBookingRepository)
        remove_from_di_container(ISpaceRepository)

    assert posted.status_code == 201, posted.text
    assert deleted.status_code == 204, deleted.text
    assert bookings_in_db(space_id) == 0  # the booking POST answered 201 for went with the space


@pytest.mark.parametrize("lock", ["real", "control"])
def test_confirm_waits_while_delete_holds_the_space_lock(
    client: TestClient,
    host_auth_headers: dict[str, str],
    other_auth_headers: dict[str, str],
    lock: str,
) -> None:
    """Both take the same space lock. The answers are the same without it ("control"): a pending
    booking is already active, so DELETE is 409 either way; only the wait tells them apart."""
    space_id = new_space(client, host_auth_headers)
    created = post_booking(client, other_auth_headers, space_id)
    assert created.status_code == 201, created.text
    booking_id = int(created.json()["id"])
    session_factory = get_from_di_container(ISessionFactory)
    spaces = (GatedSpaceRepository if lock == "real" else NoLockSpaceRepository)(session_factory)
    a_holds, release_a, hold = holder()
    spaces.after_lock[space_id] = hold
    b_calling, b_returned = threading.Event(), threading.Event()
    spaces.before_booking_lock[booking_id] = b_calling.set
    spaces.after_booking_lock[booking_id] = b_returned.set
    add_to_di_container(ISpaceRepository, spaces)
    try:
        with ThreadPoolExecutor(max_workers=2) as pool:
            try:
                a: Future[Response] = pool.submit(delete_space, client, host_auth_headers, space_id)
                assert a_holds.wait(TIMEOUT), "DELETE never reached its lock"
                b = pool.submit(confirm, client, host_auth_headers, booking_id)
                assert b_calling.wait(TIMEOUT), "confirm never reached its lock"
                confirm_got_through = b_returned.wait(BLOCKED_FOR)
            finally:
                release_a.set()
            deleted, confirmed = a.result(TIMEOUT), b.result(TIMEOUT)
    finally:
        remove_from_di_container(ISpaceRepository)

    # With the real lock the confirm waits in the database; with a plain read it does not.
    assert confirm_got_through is (lock == "control")
    assert (deleted.status_code, deleted.json()) == (409, ONE_ACTIVE_BOOKING)
    assert confirmed.status_code == 200, confirmed.text
    assert bookings_in_db(space_id) == 1


@pytest.mark.parametrize(
    ("space_status", "status_code", "body"),
    [
        (
            "listed",
            403,
            {"detail": "Only the host can change this space", "code": "not_space_owner"},
        ),
        ("draft", 404, SPACE_NOT_FOUND),
    ],
)
def test_delete_by_anyone_but_the_host_is_refused_while_the_space_is_locked_and_never_waits(
    client: TestClient,
    host_auth_headers: dict[str, str],
    repositories: tuple[GatedSpaceRepository, GatedBookingRepository],
    space_status: str,
    status_code: int,
    body: dict[str, str],
) -> None:
    """Only the host may delete; anyone else is refused before the lock (ADR-026)."""
    spaces, _ = repositories
    stranger_headers = register(client, "jovana@example.com")
    space_id = new_space(client, host_auth_headers, status=space_status)
    a_holds, release_a, hold = holder()
    spaces.after_lock[space_id] = hold

    with ThreadPoolExecutor(max_workers=2) as pool:
        try:
            a: Future[Response] = pool.submit(delete_space, client, host_auth_headers, space_id)
            assert a_holds.wait(TIMEOUT), "DELETE never took the lock"
            # Answered while A still holds the lock: the request never waited for it.
            response = pool.submit(delete_space, client, stranger_headers, space_id).result(TIMEOUT)
            lock_calls_while_held = spaces.lock_calls
        finally:
            release_a.set()
        assert a.result(TIMEOUT).status_code == 204

    assert (response.status_code, response.json()) == (status_code, body)
    assert lock_calls_while_held == 1, "a DELETE by someone else reached the space lock"
