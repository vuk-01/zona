from __future__ import annotations

from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, func, insert, select

from app.database.session_factory import ISessionFactory
from app.favorites.models.favorite import Favorite
from app.favorites.repositories.favorite import FavoriteRepository
from app.spaces.models.space import Space
from app.users.models.user import User
from app.utils.di import get_from_di_container
from tests.integration.conftest import user_id
from tests.utils import space_body


def save(client: TestClient, headers: dict[str, str], space_id: int) -> Any:
    return client.post("/api/favorites", json={"spaceId": space_id}, headers=headers)


def new_space(client: TestClient, headers: dict[str, str], **changes: Any) -> int:
    response = client.post("/api/spaces", json=space_body(**changes), headers=headers)
    assert response.status_code == 201, response.text
    return int(response.json()["id"])


def favorites_in_db() -> int:
    with get_from_di_container(ISessionFactory)() as session:
        return int(session.scalar(select(func.count()).select_from(Favorite)) or 0)


def on_second_connection(statement: Any) -> None:
    with get_from_di_container(ISessionFactory).engine.begin() as connection:
        connection.execute(statement)


# --- POST ---------------------------------------------------------------------------------------


def test_save_then_save_again_is_201_then_200_with_the_same_favorite(
    client: TestClient, other_auth_headers: dict[str, str], space_id: int
) -> None:
    created = save(client, other_auth_headers, space_id)
    again = save(client, other_auth_headers, space_id)

    assert created.status_code == 201
    body = created.json()
    assert set(body) == {"userId", "spaceId", "createdAt"}  # camelCase, no internal id
    assert (body["userId"], body["spaceId"]) == (user_id(client, other_auth_headers), space_id)
    assert body["createdAt"].endswith("Z")
    assert (again.status_code, again.json()) == (200, body)
    assert favorites_in_db() == 1


def test_save_an_unknown_space_is_404(client: TestClient, auth_headers: dict[str, str]) -> None:
    response = save(client, auth_headers, 999)

    assert response.status_code == 404
    assert response.json() == {"detail": "Space not found", "code": "space_not_found"}


def test_save_someone_elses_draft_is_404_and_own_draft_is_201(
    client: TestClient, host_auth_headers: dict[str, str], other_auth_headers: dict[str, str]
) -> None:
    draft_id = new_space(client, host_auth_headers, status="draft")

    assert save(client, other_auth_headers, draft_id).status_code == 404
    assert save(client, host_auth_headers, draft_id).status_code == 201


def test_save_without_token_is_401(client: TestClient, space_id: int) -> None:
    response = client.post("/api/favorites", json={"spaceId": space_id})

    assert response.status_code == 401
    assert response.json()["code"] == "not_authenticated"


@pytest.mark.parametrize("body", [{}, {"spaceId": 0}, {"spaceId": "abc"}])
def test_save_with_invalid_space_id_is_422(
    client: TestClient, auth_headers: dict[str, str], body: dict[str, Any]
) -> None:
    response = client.post("/api/favorites", json=body, headers=auth_headers)

    assert response.status_code == 422
    assert set(response.json()["fieldErrors"]) == {"spaceId"}


# --- GET ----------------------------------------------------------------------------------------


def test_list_is_own_only_newest_saved_first(
    client: TestClient,
    host_auth_headers: dict[str, str],
    other_auth_headers: dict[str, str],
    space_id: int,
) -> None:
    second_id = new_space(client, host_auth_headers, name="Second space")
    save(client, other_auth_headers, space_id)
    save(client, other_auth_headers, second_id)
    save(client, host_auth_headers, space_id)

    response = client.get("/api/favorites", headers=other_auth_headers)

    assert response.status_code == 200
    body = response.json()
    assert (body["total"], body["pages"]) == (2, 1)
    assert [item["spaceId"] for item in body["items"]] == [second_id, space_id]


def test_list_pagination(
    client: TestClient,
    host_auth_headers: dict[str, str],
    other_auth_headers: dict[str, str],
    space_id: int,
) -> None:
    second_id = new_space(client, host_auth_headers, name="Second space")
    save(client, other_auth_headers, space_id)
    save(client, other_auth_headers, second_id)

    response = client.get("/api/favorites?page=2&size=1", headers=other_auth_headers)

    body = response.json()
    assert (body["total"], body["pages"]) == (2, 2)
    assert [item["spaceId"] for item in body["items"]] == [space_id]


def test_list_without_token_is_401(client: TestClient) -> None:
    assert client.get("/api/favorites").status_code == 401


# --- DELETE -------------------------------------------------------------------------------------


def test_remove_is_204_also_when_not_saved_and_leaves_other_users_alone(
    client: TestClient,
    host_auth_headers: dict[str, str],
    other_auth_headers: dict[str, str],
    space_id: int,
) -> None:
    save(client, other_auth_headers, space_id)
    save(client, host_auth_headers, space_id)

    removed = client.delete(f"/api/favorites/{space_id}", headers=other_auth_headers)
    again = client.delete(f"/api/favorites/{space_id}", headers=other_auth_headers)

    assert (removed.status_code, removed.content) == (204, b"")
    assert again.status_code == 204
    assert client.get("/api/favorites", headers=other_auth_headers).json()["total"] == 0
    assert client.get("/api/favorites", headers=host_auth_headers).json()["total"] == 1


def test_remove_without_token_is_401(client: TestClient, space_id: int) -> None:
    assert client.delete(f"/api/favorites/{space_id}").status_code == 401


def test_remove_with_invalid_id_is_422(client: TestClient, auth_headers: dict[str, str]) -> None:
    response = client.delete("/api/favorites/abc", headers=auth_headers)

    assert response.status_code == 422
    assert set(response.json()["fieldErrors"]) == {"space_id"}


# --- cascades -----------------------------------------------------------------------------------


def test_deleting_the_space_or_the_user_deletes_their_favorites(
    client: TestClient,
    host_auth_headers: dict[str, str],
    other_auth_headers: dict[str, str],
    space_id: int,
) -> None:
    second_id = new_space(client, host_auth_headers, name="Second space")
    save(client, other_auth_headers, space_id)
    save(client, other_auth_headers, second_id)

    assert client.delete(f"/api/spaces/{space_id}", headers=host_auth_headers).status_code == 204
    assert favorites_in_db() == 1
    marko_id = user_id(client, other_auth_headers)
    assert client.delete(f"/api/users/{marko_id}", headers=other_auth_headers).status_code == 204
    assert favorites_in_db() == 0


# --- a parallel request changes the rows mid-request (over a second connection) ----------------


@pytest.mark.parametrize(
    ("what", "status_code", "code"),
    [("space", 404, "space_not_found"), ("user", 401, "invalid_token")],
)
def test_save_after_the_space_or_user_was_deleted_meanwhile(
    client: TestClient,
    other_auth_headers: dict[str, str],
    space_id: int,
    monkeypatch: pytest.MonkeyPatch,
    what: str,
    status_code: int,
    code: str,
) -> None:
    marko_id = user_id(client, other_auth_headers)
    gone = (
        delete(Space).where(Space.id == space_id)
        if what == "space"
        else delete(User).where(User.id == marko_id)
    )
    add = FavoriteRepository.add

    def delete_then_add(self: FavoriteRepository, favorite: Favorite) -> Favorite:
        on_second_connection(gone)
        return add(self, favorite)

    monkeypatch.setattr(FavoriteRepository, "add", delete_then_add)

    response = save(client, other_auth_headers, space_id)

    assert response.status_code == status_code
    assert response.json()["code"] == code
    assert favorites_in_db() == 0
    # The failed transaction was rolled back, so the next request on the same thread works.
    assert client.get("/api/spaces").status_code == 200


def test_save_while_a_parallel_request_saves_the_same_space_is_200(
    client: TestClient,
    other_auth_headers: dict[str, str],
    space_id: int,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    marko_id = user_id(client, other_auth_headers)
    add = FavoriteRepository.add

    def parallel_save_then_add(self: FavoriteRepository, favorite: Favorite) -> Favorite:
        on_second_connection(insert(Favorite).values(user_id=marko_id, space_id=space_id))
        return add(self, favorite)

    monkeypatch.setattr(FavoriteRepository, "add", parallel_save_then_add)

    response = save(client, other_auth_headers, space_id)

    assert response.status_code == 200
    assert (response.json()["userId"], response.json()["spaceId"]) == (marko_id, space_id)
    assert favorites_in_db() == 1


def test_save_while_a_parallel_request_saves_then_removes_it_is_201(
    client: TestClient,
    other_auth_headers: dict[str, str],
    space_id: int,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    marko_id = user_id(client, other_auth_headers)
    add = FavoriteRepository.add
    get = FavoriteRepository.get
    calls: list[None] = []

    def parallel_save_then_add(self: FavoriteRepository, favorite: Favorite) -> Favorite:
        if not calls:  # only the first INSERT is refused; the retry finds the pair gone
            on_second_connection(insert(Favorite).values(user_id=marko_id, space_id=space_id))
        calls.append(None)
        return add(self, favorite)

    def parallel_remove_then_get(
        self: FavoriteRepository, user_id: int, space_id: int
    ) -> Favorite | None:
        # On Postgres a parallel DELETE commits here and READ COMMITTED no longer sees the pair.
        # SQLite keeps the write lock from the refused INSERT, so a second connection cannot
        # delete; removing it in the request's own session gives get() the same view.
        self._session_factory().execute(delete(Favorite))
        return get(self, user_id=user_id, space_id=space_id)

    monkeypatch.setattr(FavoriteRepository, "add", parallel_save_then_add)
    monkeypatch.setattr(FavoriteRepository, "get", parallel_remove_then_get)

    response = save(client, other_auth_headers, space_id)

    assert response.status_code == 201
    assert (response.json()["userId"], response.json()["spaceId"]) == (marko_id, space_id)
    assert len(calls) == 2
    assert favorites_in_db() == 1


def test_remove_while_a_parallel_request_removed_it_is_still_204(
    client: TestClient,
    other_auth_headers: dict[str, str],
    space_id: int,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    save(client, other_auth_headers, space_id)
    remove = FavoriteRepository.delete

    def parallel_remove_then_remove(self: FavoriteRepository, user_id: int, space_id: int) -> None:
        on_second_connection(delete(Favorite))
        remove(self, user_id=user_id, space_id=space_id)

    monkeypatch.setattr(FavoriteRepository, "delete", parallel_remove_then_remove)

    response = client.delete(f"/api/favorites/{space_id}", headers=other_auth_headers)

    assert response.status_code == 204
