from __future__ import annotations

from typing import Any

import pytest
from fastapi.testclient import TestClient

from tests.integration.conftest import register, user_id
from tests.utils import space_body

PUBLIC_KEYS = {"id", "name", "avatarUrl", "city", "bio", "isHost", "createdAt"}


def patch_self(client: TestClient, headers: dict[str, str], **body: Any) -> dict[str, Any]:
    response = client.patch(f"/api/users/{user_id(client, headers)}", json=body, headers=headers)
    assert response.status_code == 200, response.text
    result: dict[str, Any] = response.json()
    return result


# --- list ---------------------------------------------------------------------------------------


@pytest.mark.usefixtures("auth_headers", "other_auth_headers")
def test_list_newest_first_without_private_fields(client: TestClient) -> None:
    response = client.get("/api/users")

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 2
    assert [user["name"] for user in body["items"]] == ["marko", "ana"]
    assert all(set(user) == PUBLIC_KEYS for user in body["items"])


@pytest.mark.usefixtures("other_auth_headers")
@pytest.mark.parametrize(
    ("query", "expected"),
    [
        ("search=AN", ["ana"]),  # any case
        ("search=ark", ["marko"]),
        ("isHost=true", ["ana"]),
        ("isHost=false", ["marko"]),
        ("search=zzz", []),
    ],
)
def test_list_filters(
    client: TestClient, host_auth_headers: dict[str, str], query: str, expected: list[str]
) -> None:
    response = client.get(f"/api/users?{query}", headers=host_auth_headers)

    assert response.status_code == 200
    assert [user["name"] for user in response.json()["items"]] == expected


def test_list_pagination(client: TestClient) -> None:
    for i in range(3):
        register(client, f"user{i}@example.com")

    response = client.get("/api/users?page=2&size=2")

    assert response.status_code == 200
    body = response.json()
    assert (body["total"], body["pages"]) == (3, 2)
    assert [user["name"] for user in body["items"]] == ["user0"]


def test_list_with_invalid_filter_is_422(client: TestClient) -> None:
    response = client.get("/api/users?isHost=maybe")

    assert response.status_code == 422
    assert set(response.json()["fieldErrors"]) == {"isHost"}


@pytest.mark.parametrize("path", ["/api/users", "/api/users/1"])
def test_public_reads_with_an_invalid_token_are_401(client: TestClient, path: str) -> None:
    response = client.get(path, headers={"Authorization": "Bearer not-a-jwt"})

    assert response.status_code == 401
    assert response.json()["code"] == "invalid_token"


# --- get ----------------------------------------------------------------------------------------


def test_get_returns_the_public_profile(client: TestClient, auth_headers: dict[str, str]) -> None:
    ana_id = user_id(client, auth_headers)

    response = client.get(f"/api/users/{ana_id}")

    assert response.status_code == 200
    assert set(response.json()) == PUBLIC_KEYS
    assert response.json()["name"] == "ana"


def test_get_unknown_user_is_404(client: TestClient) -> None:
    response = client.get("/api/users/999")

    assert response.status_code == 404
    assert response.json() == {"detail": "User not found", "code": "user_not_found"}


def test_get_with_invalid_id_is_422(client: TestClient) -> None:
    response = client.get("/api/users/abc")

    assert response.status_code == 422
    assert set(response.json()["fieldErrors"]) == {"user_id"}


# --- patch --------------------------------------------------------------------------------------


def test_patch_every_profile_field(client: TestClient, auth_headers: dict[str, str]) -> None:
    body = patch_self(
        client,
        auth_headers,
        name="  Ana Petrović ",
        avatarUrl="https://example.com/ana.jpg",
        city=" Podgorica ",
        bio="Designer, works from coworkings.",
    )

    assert body["name"] == "Ana Petrović"
    assert body["avatarUrl"] == "https://example.com/ana.jpg"
    assert body["city"] == "Podgorica"
    assert body["bio"] == "Designer, works from coworkings."
    assert body["email"] == "ana@example.com"  # the full user, to the user themselves
    assert client.get("/api/auth/me", headers=auth_headers).json() == body


def test_patch_null_avatar_removes_the_photo(
    client: TestClient, auth_headers: dict[str, str]
) -> None:
    patch_self(client, auth_headers, avatarUrl="https://example.com/ana.jpg")

    assert patch_self(client, auth_headers, avatarUrl=None)["avatarUrl"] is None


def test_patch_empty_body_changes_nothing(client: TestClient, auth_headers: dict[str, str]) -> None:
    before = client.get("/api/auth/me", headers=auth_headers).json()

    assert patch_self(client, auth_headers) == before


def test_switching_to_host_turns_hosting_on_and_back_to_guest_keeps_it(
    client: TestClient, auth_headers: dict[str, str]
) -> None:
    host = patch_self(client, auth_headers, mode="host")
    assert (host["mode"], host["isHost"]) == ("host", True)

    guest = patch_self(client, auth_headers, mode="guest")
    assert (guest["mode"], guest["isHost"]) == ("guest", True)


def test_a_new_host_can_create_a_space(client: TestClient, auth_headers: dict[str, str]) -> None:
    assert client.post("/api/spaces", json=space_body(), headers=auth_headers).status_code == 403

    patch_self(client, auth_headers, mode="host")

    assert client.post("/api/spaces", json=space_body(), headers=auth_headers).status_code == 201


def test_patch_without_token_is_401(client: TestClient, auth_headers: dict[str, str]) -> None:
    response = client.patch(f"/api/users/{user_id(client, auth_headers)}", json={"name": "Ana"})

    assert response.status_code == 401
    assert response.json()["code"] == "not_authenticated"


def test_patch_another_user_is_403(
    client: TestClient, auth_headers: dict[str, str], other_auth_headers: dict[str, str]
) -> None:
    ana_id = user_id(client, auth_headers)

    response = client.patch(
        f"/api/users/{ana_id}", json={"name": "Hacked"}, headers=other_auth_headers
    )

    assert response.status_code == 403
    assert response.json() == {
        "detail": "Only the account owner can change this account",
        "code": "not_account_owner",
    }
    assert client.get(f"/api/users/{ana_id}").json()["name"] == "ana"


def test_patch_unknown_user_is_404(client: TestClient, auth_headers: dict[str, str]) -> None:
    response = client.patch("/api/users/999", json={"name": "Ana"}, headers=auth_headers)

    assert response.status_code == 404
    assert response.json()["code"] == "user_not_found"


@pytest.mark.parametrize(
    ("body", "field"),
    [
        ({"name": "A"}, "name"),
        ({"name": None}, "name"),
        ({"avatarUrl": "not-a-url"}, "avatarUrl"),
        ({"bio": "a" * 201}, "bio"),
        ({"mode": "admin"}, "mode"),
    ],
)
def test_patch_with_invalid_field_is_422(
    client: TestClient, auth_headers: dict[str, str], body: dict[str, Any], field: str
) -> None:
    response = client.patch(
        f"/api/users/{user_id(client, auth_headers)}", json=body, headers=auth_headers
    )

    assert response.status_code == 422
    assert set(response.json()["fieldErrors"]) == {field}


# --- delete -------------------------------------------------------------------------------------


def test_delete_removes_the_account_and_its_spaces(
    client: TestClient, host_auth_headers: dict[str, str], space_id: int
) -> None:
    ana_id = user_id(client, host_auth_headers)

    response = client.delete(f"/api/users/{ana_id}", headers=host_auth_headers)

    assert response.status_code == 204
    assert response.content == b""
    assert client.get(f"/api/users/{ana_id}").status_code == 404
    assert client.get(f"/api/spaces/{space_id}").status_code == 404
    # The token outlives the account, but no longer works.
    me = client.get("/api/auth/me", headers=host_auth_headers)
    assert (me.status_code, me.json()["code"]) == (401, "invalid_token")


def test_delete_without_token_is_401(client: TestClient, auth_headers: dict[str, str]) -> None:
    response = client.delete(f"/api/users/{user_id(client, auth_headers)}")

    assert response.status_code == 401
    assert response.json()["code"] == "not_authenticated"


def test_delete_another_user_is_403(
    client: TestClient, auth_headers: dict[str, str], other_auth_headers: dict[str, str]
) -> None:
    ana_id = user_id(client, auth_headers)

    response = client.delete(f"/api/users/{ana_id}", headers=other_auth_headers)

    assert response.status_code == 403
    assert response.json()["code"] == "not_account_owner"
    assert client.get(f"/api/users/{ana_id}").status_code == 200


def test_delete_unknown_user_is_404(client: TestClient, auth_headers: dict[str, str]) -> None:
    response = client.delete("/api/users/999", headers=auth_headers)

    assert response.status_code == 404
    assert response.json()["code"] == "user_not_found"
