from __future__ import annotations

from collections.abc import Callable, Generator
from datetime import UTC, datetime
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete

from app.database.session_factory import ISessionFactory
from app.spaces.models.space import Space
from app.spaces.repositories.space import SpaceRepository
from app.users.models.user import User
from app.utils.clock import IClock
from app.utils.di import add_to_di_container, get_from_di_container, remove_from_di_container
from tests.utils import FixedClock, space_body

# Wednesday 2026-10-28; Podgorica is on CET (UTC+1) after the clocks went back on 25 October.
WEDNESDAY_10_LOCAL = datetime(2026, 10, 28, 9, 0, tzinfo=UTC)
WEDNESDAY_2030_LOCAL = datetime(2026, 10, 28, 19, 30, tzinfo=UTC)
SUNDAY_10_LOCAL = datetime(2026, 11, 1, 9, 0, tzinfo=UTC)

NOT_AUTHENTICATED = {"detail": "Authentication required", "code": "not_authenticated"}
NOT_SPACE_OWNER = {"detail": "Only the host can change this space", "code": "not_space_owner"}
SPACE_NOT_FOUND = {"detail": "Space not found", "code": "space_not_found"}


@pytest.fixture
def set_now() -> Generator[Callable[[datetime], None]]:
    def _set(now: datetime) -> None:
        add_to_di_container(IClock, FixedClock(now))

    yield _set
    remove_from_di_container(IClock)


def create(client: TestClient, headers: dict[str, str], **changes: Any) -> dict[str, Any]:
    response = client.post("/api/spaces", json=space_body(**changes), headers=headers)
    assert response.status_code == 201, response.text
    body: dict[str, Any] = response.json()
    return body


# --- POST /api/spaces ---------------------------------------------------------------------------


def test_create_and_get(
    client: TestClient,
    host_auth_headers: dict[str, str],
    set_now: Callable[[datetime], None],
) -> None:
    # A fixed clock: availableDesks depends on the hour, and both requests must see the same one.
    set_now(WEDNESDAY_10_LOCAL)
    created = client.post("/api/spaces", json=space_body(), headers=host_auth_headers)

    assert created.status_code == 201
    body = created.json()
    assert body["name"] == "Hub Morača Coworking"
    assert body["description"] == ""
    assert body["pricePerHour"] == 3
    assert body["deskCount"] == 20
    assert body["availableDesks"] == 20
    assert body["host"]["name"] == "ana"
    assert body["createdAt"].endswith("Z")
    assert "bookingCounts" not in body

    fetched = client.get(f"/api/spaces/{body['id']}")
    assert fetched.status_code == 200
    assert fetched.json() == body


def test_create_takes_the_host_from_the_token(
    client: TestClient, host_auth_headers: dict[str, str], other_auth_headers: dict[str, str]
) -> None:
    other_id = client.get("/api/auth/me", headers=other_auth_headers).json()["id"]

    body = create(client, host_auth_headers, hostId=other_id, host={"id": other_id})

    me = client.get("/api/auth/me", headers=host_auth_headers).json()
    assert body["host"] == {"id": me["id"], "name": "ana"}


def test_create_drops_desk_count_for_other_categories(
    client: TestClient, host_auth_headers: dict[str, str]
) -> None:
    body = create(client, host_auth_headers, category="meeting-room", deskCount=5)

    assert "deskCount" not in body
    assert body["availableDesks"] is None


def test_create_without_token_is_401(client: TestClient) -> None:
    response = client.post("/api/spaces", json=space_body())

    assert response.status_code == 401
    assert response.json()["code"] == "not_authenticated"


def test_create_by_a_guest_is_403(client: TestClient, other_auth_headers: dict[str, str]) -> None:
    response = client.post("/api/spaces", json=space_body(), headers=other_auth_headers)

    assert response.status_code == 403
    assert response.json() == {"detail": "Only hosts can create spaces", "code": "not_a_host"}


@pytest.mark.parametrize(
    ("changes", "field"),
    [
        ({"name": "  ab  "}, "name"),
        ({"description": "x" * 501}, "description"),
        ({"category": "garage"}, "category"),
        ({"city": "   "}, "city"),
        ({"address": "x" * 121}, "address"),
        ({"pricePerHour": 0}, "pricePerHour"),
        ({"pricePerHour": 1000.01}, "pricePerHour"),
        ({"pricePerHour": 3.333}, "pricePerHour"),
        ({"capacity": 0}, "capacity"),
        ({"capacity": 1001}, "capacity"),
        ({"deskCount": None}, "deskCount"),
        ({"deskCount": 0}, "deskCount"),
        ({"capacity": 4, "deskCount": 5}, "deskCount"),
        ({"images": []}, "images"),
        ({"images": [f"https://example.com/{i}.jpg" for i in range(9)]}, "images"),
        ({"images": ["ftp://example.com/a.jpg"]}, "images.0"),
        ({"status": "hidden"}, "status"),
    ],
)
def test_create_with_invalid_field_is_422(
    client: TestClient, host_auth_headers: dict[str, str], changes: dict[str, Any], field: str
) -> None:
    response = client.post("/api/spaces", json=space_body(**changes), headers=host_auth_headers)

    assert response.status_code == 422
    body = response.json()
    assert body["code"] == "validation_error"
    assert set(body["fieldErrors"]) == {field}


@pytest.mark.parametrize(
    ("monday", "field"),
    [
        ({"open": "18:00", "close": "09:00"}, "openingHours.mon"),
        ({"open": "09:00", "close": "09:00"}, "openingHours.mon"),
        ({"open": "09:30", "close": "17:00"}, "openingHours.mon.open"),
        ({"open": "09:00", "close": "25:00"}, "openingHours.mon.close"),
    ],
)
def test_create_with_invalid_opening_hours_is_422(
    client: TestClient, host_auth_headers: dict[str, str], monday: dict[str, str], field: str
) -> None:
    hours = space_body()["openingHours"] | {"mon": monday}

    response = client.post(
        "/api/spaces", json=space_body(openingHours=hours), headers=host_auth_headers
    )

    assert response.status_code == 422
    assert set(response.json()["fieldErrors"]) == {field}


def test_create_closed_every_day_is_422(
    client: TestClient, host_auth_headers: dict[str, str]
) -> None:
    closed = dict.fromkeys(["mon", "tue", "wed", "thu", "fri", "sat", "sun"])

    response = client.post(
        "/api/spaces", json=space_body(openingHours=closed), headers=host_auth_headers
    )

    assert response.status_code == 422
    assert set(response.json()["fieldErrors"]) == {"openingHours"}


def test_create_open_until_midnight(client: TestClient, host_auth_headers: dict[str, str]) -> None:
    hours = space_body()["openingHours"] | {"sat": {"open": "18:00", "close": "24:00"}}

    body = create(client, host_auth_headers, openingHours=hours)

    assert body["openingHours"]["sat"] == {"open": "18:00", "close": "24:00"}


# --- GET /api/spaces/:id ------------------------------------------------------------------------


def test_get_unknown_space_is_404(client: TestClient) -> None:
    response = client.get("/api/spaces/999")

    assert response.status_code == 404
    assert response.json() == {"detail": "Space not found", "code": "space_not_found"}


def test_draft_is_visible_only_to_its_host(
    client: TestClient, host_auth_headers: dict[str, str], other_auth_headers: dict[str, str]
) -> None:
    draft = create(client, host_auth_headers, status="draft")
    url = f"/api/spaces/{draft['id']}"

    assert client.get(url, headers=host_auth_headers).status_code == 200
    assert client.get(url).status_code == 404
    assert client.get(url, headers=other_auth_headers).json()["code"] == "space_not_found"


def test_public_reads_with_an_invalid_token_are_401(client: TestClient, space_id: int) -> None:
    # Public reads need no token, but a token that is sent must be valid (docs/entities.md).
    stale = {"Authorization": "Bearer not-a-real-token"}

    for url in ("/api/spaces", f"/api/spaces/{space_id}"):
        response = client.get(url, headers=stale)
        assert response.status_code == 401
        assert response.json()["code"] == "invalid_token"
        assert client.get(url).status_code == 200  # the same request without a token


# --- GET /api/spaces ----------------------------------------------------------------------------


def test_list_newest_first(client: TestClient, host_auth_headers: dict[str, str]) -> None:
    for name in ["First space", "Second space", "Third space"]:
        create(client, host_auth_headers, name=name)

    body = client.get("/api/spaces").json()

    assert body["total"] == 3
    assert [item["name"] for item in body["items"]] == [
        "Third space",
        "Second space",
        "First space",
    ]


def test_list_pagination(client: TestClient, host_auth_headers: dict[str, str]) -> None:
    for i in range(3):
        create(client, host_auth_headers, name=f"Space {i}")

    body = client.get("/api/spaces?page=2&size=2").json()

    assert (body["total"], body["pages"], len(body["items"])) == (3, 2, 1)


@pytest.mark.parametrize(
    ("query", "expected"),
    [
        ("search=glass", {"Glass Room"}),
        ("search=NIKSIC", {"Loft"}),
        ("category=desk", {"Hub"}),
        ("city=podgorica", {"Hub", "Glass Room"}),
        ("minPrice=18", {"Glass Room", "Loft"}),
        ("maxPrice=18", {"Hub", "Glass Room"}),
        ("minPrice=10&maxPrice=50", {"Glass Room"}),
        ("status=listed", {"Hub", "Glass Room", "Loft"}),
    ],
)
def test_list_filters(
    client: TestClient, host_auth_headers: dict[str, str], query: str, expected: set[str]
) -> None:
    create(client, host_auth_headers, name="Hub", pricePerHour=3)
    create(
        client,
        host_auth_headers,
        name="Glass Room",
        category="meeting-room",
        pricePerHour=18,
    )
    create(
        client,
        host_auth_headers,
        name="Loft",
        category="event-hall",
        city="Niksic",
        pricePerHour=85,
        capacity=120,
    )

    body = client.get(f"/api/spaces?{query}").json()

    assert {item["name"] for item in body["items"]} == expected


def test_list_hides_other_peoples_drafts(
    client: TestClient, host_auth_headers: dict[str, str], other_auth_headers: dict[str, str]
) -> None:
    create(client, host_auth_headers, name="Listed")
    create(client, host_auth_headers, name="Draft", status="draft")

    anonymous = client.get("/api/spaces").json()
    other = client.get("/api/spaces?status=draft", headers=other_auth_headers).json()
    own = client.get("/api/spaces", headers=host_auth_headers).json()

    assert [item["name"] for item in anonymous["items"]] == ["Listed"]
    assert other["total"] == 0
    assert {item["name"] for item in own["items"]} == {"Listed", "Draft"}


def test_own_host_list_has_drafts_and_booking_counts(
    client: TestClient, host_auth_headers: dict[str, str], other_auth_headers: dict[str, str]
) -> None:
    create(client, host_auth_headers, name="Listed")
    create(client, host_auth_headers, name="Draft", status="draft")
    host_id = client.get("/api/auth/me", headers=host_auth_headers).json()["id"]

    own = client.get(f"/api/spaces?hostId={host_id}", headers=host_auth_headers).json()
    seen_by_other = client.get(f"/api/spaces?hostId={host_id}", headers=other_auth_headers).json()

    assert own["total"] == 2
    assert all(item["bookingCounts"] == {"active": 0, "pending": 0} for item in own["items"])
    assert [item["name"] for item in seen_by_other["items"]] == ["Listed"]
    assert "bookingCounts" not in seen_by_other["items"][0]


@pytest.mark.parametrize(
    ("now", "expected"),
    [
        (WEDNESDAY_10_LOCAL, 20),  # open 08:00-20:00 on Wednesday
        (WEDNESDAY_2030_LOCAL, None),  # after closing time
        (SUNDAY_10_LOCAL, None),  # closed on Sunday
    ],
)
def test_available_desks_follow_opening_hours_in_podgorica(
    client: TestClient,
    host_auth_headers: dict[str, str],
    set_now: Callable[[datetime], None],
    now: datetime,
    expected: int | None,
) -> None:
    set_now(now)
    space = create(client, host_auth_headers)

    listed = client.get("/api/spaces").json()["items"][0]

    assert space["availableDesks"] == expected
    assert listed["availableDesks"] == expected


# --- PATCH /api/spaces/:id ----------------------------------------------------------------------


def test_host_can_patch(
    client: TestClient, host_auth_headers: dict[str, str], space_id: int
) -> None:
    response = client.patch(
        f"/api/spaces/{space_id}", json={"pricePerHour": 4.5}, headers=host_auth_headers
    )

    assert response.status_code == 200
    assert response.json()["pricePerHour"] == 4.5
    assert response.json()["name"] == "Hub Morača Coworking"  # untouched fields stay


def test_patch_away_from_desk_drops_the_desk_count(
    client: TestClient, host_auth_headers: dict[str, str], space_id: int
) -> None:
    response = client.patch(
        f"/api/spaces/{space_id}", json={"category": "meeting-room"}, headers=host_auth_headers
    )

    assert response.status_code == 200
    assert "deskCount" not in response.json()


def test_patch_to_desk_needs_a_desk_count(
    client: TestClient, host_auth_headers: dict[str, str]
) -> None:
    room = create(client, host_auth_headers, category="meeting-room", capacity=8)
    url = f"/api/spaces/{room['id']}"

    missing = client.patch(url, json={"category": "desk"}, headers=host_auth_headers)
    too_many = client.patch(
        url, json={"category": "desk", "deskCount": 9}, headers=host_auth_headers
    )
    ok = client.patch(url, json={"category": "desk", "deskCount": 8}, headers=host_auth_headers)

    assert missing.status_code == 422
    assert missing.json()["code"] == "validation_error"
    assert set(missing.json()["fieldErrors"]) == {"deskCount"}
    assert set(too_many.json()["fieldErrors"]) == {"deskCount"}
    assert ok.status_code == 200
    assert ok.json()["deskCount"] == 8


def test_patch_with_invalid_field_is_422(
    client: TestClient, host_auth_headers: dict[str, str], space_id: int
) -> None:
    response = client.patch(
        f"/api/spaces/{space_id}", json={"images": []}, headers=host_auth_headers
    )

    assert response.status_code == 422
    assert set(response.json()["fieldErrors"]) == {"images"}


def test_patch_with_null_required_field_is_422(
    client: TestClient, host_auth_headers: dict[str, str], space_id: int
) -> None:
    response = client.patch(
        f"/api/spaces/{space_id}", json={"name": None}, headers=host_auth_headers
    )

    assert response.status_code == 422
    assert set(response.json()["fieldErrors"]) == {"name"}


def test_patch_without_token_is_401(client: TestClient, space_id: int) -> None:
    response = client.patch(f"/api/spaces/{space_id}", json={"pricePerHour": 1})

    assert response.status_code == 401
    assert response.json() == NOT_AUTHENTICATED


def test_other_user_cannot_patch_or_delete(
    client: TestClient, other_auth_headers: dict[str, str], space_id: int
) -> None:
    patched = client.patch(
        f"/api/spaces/{space_id}", json={"pricePerHour": 1}, headers=other_auth_headers
    )
    deleted = client.delete(f"/api/spaces/{space_id}", headers=other_auth_headers)

    assert patched.status_code == 403
    assert patched.json() == NOT_SPACE_OWNER
    assert deleted.status_code == 403
    assert deleted.json() == NOT_SPACE_OWNER
    assert client.get(f"/api/spaces/{space_id}").json()["pricePerHour"] == 3


def test_other_peoples_draft_is_404_for_patch_and_delete(
    client: TestClient, host_auth_headers: dict[str, str], other_auth_headers: dict[str, str]
) -> None:
    draft = create(client, host_auth_headers, status="draft")
    url = f"/api/spaces/{draft['id']}"

    patched = client.patch(url, json={"pricePerHour": 1}, headers=other_auth_headers)
    deleted = client.delete(url, headers=other_auth_headers)

    assert patched.status_code == 404
    assert patched.json() == SPACE_NOT_FOUND
    assert deleted.status_code == 404
    assert deleted.json() == SPACE_NOT_FOUND


def test_patch_unknown_space_is_404(client: TestClient, host_auth_headers: dict[str, str]) -> None:
    response = client.patch("/api/spaces/999", json={"pricePerHour": 1}, headers=host_auth_headers)

    assert response.status_code == 404
    assert response.json() == SPACE_NOT_FOUND


# --- DELETE /api/spaces/:id ---------------------------------------------------------------------


def test_host_can_delete(
    client: TestClient, host_auth_headers: dict[str, str], space_id: int
) -> None:
    deleted = client.delete(f"/api/spaces/{space_id}", headers=host_auth_headers)

    assert deleted.status_code == 204
    assert deleted.content == b""
    assert client.get(f"/api/spaces/{space_id}").status_code == 404


def test_delete_without_token_is_401(client: TestClient, space_id: int) -> None:
    response = client.delete(f"/api/spaces/{space_id}")

    assert response.status_code == 401
    assert response.json() == NOT_AUTHENTICATED


def test_delete_unknown_space_is_404(client: TestClient, host_auth_headers: dict[str, str]) -> None:
    response = client.delete("/api/spaces/999", headers=host_auth_headers)

    assert response.status_code == 404
    assert response.json() == SPACE_NOT_FOUND


# --- Database guarantees ------------------------------------------------------------------------


def test_deleting_the_host_deletes_their_spaces(client: TestClient, space_id: int) -> None:
    # There is no delete-account route yet (users feature); the foreign key is what is under test.
    session_factory = get_from_di_container(ISessionFactory)
    with session_factory() as session:
        session.execute(delete(User).where(User.email == "ana@example.com"))
        session.commit()

    assert client.get(f"/api/spaces/{space_id}").status_code == 404


# --- space deleted while the request runs -------------------------------------------------------


def vanish_after_read(monkeypatch: pytest.MonkeyPatch) -> None:
    """The next read of a space deletes its row over a second connection, as a parallel request would."""
    read = SpaceRepository.get_by_id

    def read_then_vanish(self: SpaceRepository, space_id: int) -> Space | None:
        space = read(self, space_id)
        with get_from_di_container(ISessionFactory).engine.begin() as connection:
            connection.execute(delete(Space).where(Space.id == space_id))
        return space

    monkeypatch.setattr(SpaceRepository, "get_by_id", read_then_vanish)


@pytest.mark.parametrize(
    ("method", "body"),
    [("PATCH", {"name": "Hub Morača"}), ("DELETE", None)],
    ids=["patch", "delete"],
)
def test_a_space_deleted_meanwhile_is_404(
    client: TestClient,
    host_auth_headers: dict[str, str],
    space_id: int,
    monkeypatch: pytest.MonkeyPatch,
    method: str,
    body: dict[str, str] | None,
) -> None:
    vanish_after_read(monkeypatch)

    response = client.request(
        method, f"/api/spaces/{space_id}", json=body, headers=host_auth_headers
    )

    assert response.status_code == 404
    assert response.json() == {"detail": "Space not found", "code": "space_not_found"}
    # The failed transaction was rolled back, so the next request on the same thread works.
    assert client.get("/api/spaces").status_code == 200
