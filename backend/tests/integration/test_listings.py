from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete

from app.database.session_factory import ISessionFactory
from app.listings.models.listing import Listing
from app.listings.repositories.listing import ListingRepository
from app.users.models.user import User
from app.utils.di import get_from_di_container
from tests.integration.conftest import user_id


def test_create_and_get(client: TestClient, auth_headers: dict[str, str]) -> None:
    created = client.post(
        "/api/listings",
        json={
            "title": "Elden Ring",
            "price": 35,
            "category": "games",
            "city": "Nikšić",
            "imageUrl": "https://example.com/er.jpg",
        },
        headers=auth_headers,
    )

    assert created.status_code == 201
    body = created.json()
    assert body["description"] == ""
    assert body["imageUrl"] == "https://example.com/er.jpg"
    assert body["createdAt"].endswith("Z")

    fetched = client.get(f"/api/listings/{body['id']}")
    assert fetched.status_code == 200
    assert fetched.json() == body


def test_list_newest_first_with_search(client: TestClient, auth_headers: dict[str, str]) -> None:
    for title in ["PlayStation 5", "Xbox Series X", "PlayStation 4"]:
        client.post(
            "/api/listings",
            json={"title": title, "price": 100, "category": "consoles", "city": "Bar"},
            headers=auth_headers,
        )

    response = client.get("/api/listings?search=playstation")

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 2
    assert [item["title"] for item in body["items"]] == ["PlayStation 4", "PlayStation 5"]


def test_list_pagination(client: TestClient, auth_headers: dict[str, str]) -> None:
    for i in range(3):
        client.post(
            "/api/listings",
            json={"title": f"Game {i}", "price": 10, "category": "games", "city": "Bar"},
            headers=auth_headers,
        )

    response = client.get("/api/listings?page=2&size=2")

    body = response.json()
    assert (body["total"], body["pages"], len(body["items"])) == (3, 2, 1)


def test_owner_can_patch(client: TestClient, auth_headers: dict[str, str], listing_id: int) -> None:
    response = client.patch(
        f"/api/listings/{listing_id}", json={"price": 350}, headers=auth_headers
    )

    assert response.status_code == 200
    assert response.json()["price"] == 350
    assert response.json()["title"] == "PlayStation 5"  # untouched fields stay


def test_other_user_cannot_patch_or_delete(
    client: TestClient, other_auth_headers: dict[str, str], listing_id: int
) -> None:
    patched = client.patch(
        f"/api/listings/{listing_id}", json={"price": 1}, headers=other_auth_headers
    )
    assert patched.status_code == 403

    deleted = client.delete(f"/api/listings/{listing_id}", headers=other_auth_headers)
    assert deleted.status_code == 403
    assert client.get(f"/api/listings/{listing_id}").status_code == 200


def test_owner_can_delete(
    client: TestClient, auth_headers: dict[str, str], listing_id: int
) -> None:
    deleted = client.delete(f"/api/listings/{listing_id}", headers=auth_headers)

    assert deleted.status_code == 204
    assert client.get(f"/api/listings/{listing_id}").status_code == 404


def test_patch_unknown_listing_is_404(client: TestClient, auth_headers: dict[str, str]) -> None:
    response = client.patch("/api/listings/999", json={"price": 1}, headers=auth_headers)

    assert response.status_code == 404


def test_negative_price_is_rejected_by_the_database_too(
    client: TestClient, auth_headers: dict[str, str]
) -> None:
    # Pydantic answers 422 before the database is reached...
    response = client.post(
        "/api/listings",
        json={"title": "Free", "price": -5, "category": "games", "city": "Bar"},
        headers=auth_headers,
    )
    assert response.status_code == 422
    assert "price" in response.json()["fieldErrors"]


# --- listing deleted while the request runs -----------------------------------------------------


def vanish_after_read(monkeypatch: pytest.MonkeyPatch) -> None:
    """The next read of a listing deletes its row over a second connection, as a parallel request would."""
    read = ListingRepository.get_by_id

    def read_then_vanish(self: ListingRepository, listing_id: int) -> Listing | None:
        listing = read(self, listing_id)
        with get_from_di_container(ISessionFactory).engine.begin() as connection:
            connection.execute(delete(Listing).where(Listing.id == listing_id))
        return listing

    monkeypatch.setattr(ListingRepository, "get_by_id", read_then_vanish)


@pytest.mark.parametrize(
    ("method", "body"), [("PATCH", {"price": 30}), ("DELETE", None)], ids=["patch", "delete"]
)
def test_a_listing_deleted_meanwhile_is_404(
    client: TestClient,
    auth_headers: dict[str, str],
    listing_id: int,
    monkeypatch: pytest.MonkeyPatch,
    method: str,
    body: dict[str, int] | None,
) -> None:
    vanish_after_read(monkeypatch)

    response = client.request(
        method, f"/api/listings/{listing_id}", json=body, headers=auth_headers
    )

    assert response.status_code == 404
    assert response.json() == {"detail": "Listing not found", "code": "listing_not_found"}
    # The failed transaction was rolled back, so the next request on the same thread works.
    assert client.get("/api/listings").status_code == 200


# --- rules the database holds that the input checks must hold too ---------------------------------


@pytest.mark.parametrize("field", ["title", "description", "price", "category", "city"])
def test_patch_null_for_a_required_field_is_422(
    client: TestClient, auth_headers: dict[str, str], listing_id: int, field: str
) -> None:
    response = client.patch(f"/api/listings/{listing_id}", json={field: None}, headers=auth_headers)

    assert response.status_code == 422
    assert response.json()["fieldErrors"] == {field: "Must not be null"}


def test_patch_null_image_removes_it(
    client: TestClient, auth_headers: dict[str, str], listing_id: int
) -> None:
    response = client.patch(
        f"/api/listings/{listing_id}", json={"imageUrl": None}, headers=auth_headers
    )

    assert response.status_code == 200
    assert response.json()["imageUrl"] is None


def test_price_above_what_the_column_holds_is_422(
    client: TestClient, auth_headers: dict[str, str], listing_id: int
) -> None:
    created = client.post(
        "/api/listings",
        json={"title": "Gold PS5", "price": 100_000_000, "category": "consoles", "city": "Bar"},
        headers=auth_headers,
    )
    patched = client.patch(
        f"/api/listings/{listing_id}", json={"price": 100_000_000}, headers=auth_headers
    )

    assert (created.status_code, set(created.json()["fieldErrors"])) == (422, {"price"})
    assert (patched.status_code, set(patched.json()["fieldErrors"])) == (422, {"price"})


def test_create_by_an_owner_deleted_meanwhile_is_401(
    client: TestClient, auth_headers: dict[str, str], monkeypatch: pytest.MonkeyPatch
) -> None:
    owner_id = user_id(client, auth_headers)
    add = ListingRepository.add

    # The owner's account is deleted over a second connection after the token was checked,
    # right before the INSERT, as a parallel DELETE /api/users/{id} would.
    def delete_owner_then_add(self: ListingRepository, listing: Listing) -> Listing:
        with get_from_di_container(ISessionFactory).engine.begin() as connection:
            connection.execute(delete(User).where(User.id == owner_id))
        return add(self, listing)

    monkeypatch.setattr(ListingRepository, "add", delete_owner_then_add)

    response = client.post(
        "/api/listings",
        json={"title": "Elden Ring", "price": 35, "category": "games", "city": "Nikšić"},
        headers=auth_headers,
    )

    assert response.status_code == 401
    assert response.json() == {"detail": "Invalid or expired token", "code": "invalid_token"}
    assert response.headers["WWW-Authenticate"] == "Bearer"
    # Nothing was created, and the next request on the same thread works.
    listed = client.get("/api/listings")
    assert (listed.status_code, listed.json()["total"]) == (200, 0)
