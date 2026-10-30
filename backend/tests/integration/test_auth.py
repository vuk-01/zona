from __future__ import annotations

from datetime import timedelta

import pytest
from fastapi.testclient import TestClient

from app.database.session_factory import ISessionFactory
from app.users.models.user import User
from app.utils.di import get_from_di_container
from tests.integration.conftest import register, user_id


def test_register_then_me(client: TestClient) -> None:
    response = client.post(
        "/api/auth/register",
        json={"email": "Ana@Example.com", "password": "secret123", "name": "  Ana  "},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["user"]["email"] == "ana@example.com"  # stored lowercase
    assert "password" not in body["user"]
    assert "passwordHash" not in body["user"]

    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {body['token']}"})
    assert me.status_code == 200
    assert me.json() == {
        "id": body["user"]["id"],
        "email": "ana@example.com",
        "name": "Ana",  # trimmed
        "avatarUrl": None,
        "city": "",
        "bio": "",
        "isHost": False,
        "mode": "guest",
        "createdAt": body["user"]["createdAt"],
    }


@pytest.mark.parametrize("name", ["A", "A" * 61])
def test_register_with_a_name_out_of_range_is_422(client: TestClient, name: str) -> None:
    response = client.post(
        "/api/auth/register",
        json={"email": "ana@example.com", "password": "secret123", "name": name},
    )

    assert response.status_code == 422
    assert set(response.json()["fieldErrors"]) == {"name"}


@pytest.mark.usefixtures("auth_headers")
def test_register_twice_is_409(client: TestClient) -> None:
    response = client.post(
        "/api/auth/register",
        json={"email": "ana@example.com", "password": "secret123", "name": "Ana 2"},
    )

    assert response.status_code == 409
    assert response.json()["fieldErrors"] == {"email": "Email is already registered"}


@pytest.mark.usefixtures("auth_headers")
def test_login_ok_and_wrong_password(client: TestClient) -> None:
    ok = client.post("/api/auth/login", json={"email": "ana@example.com", "password": "secret123"})
    assert ok.status_code == 200
    assert ok.json()["token"]
    assert ok.json()["user"]["mode"] == "guest"

    wrong = client.post("/api/auth/login", json={"email": "ana@example.com", "password": "nope"})
    assert wrong.status_code == 401
    assert wrong.json() == {"detail": "Wrong email or password", "code": "invalid_credentials"}


def test_login_keeps_the_mode_used_last(client: TestClient, auth_headers: dict[str, str]) -> None:
    url = f"/api/users/{user_id(client, auth_headers)}"
    credentials = {"email": "ana@example.com", "password": "secret123"}

    client.patch(url, json={"mode": "host"}, headers=auth_headers)
    assert client.post("/api/auth/login", json=credentials).json()["user"]["mode"] == "host"

    client.patch(url, json={"mode": "guest"}, headers=auth_headers)
    after_guest = client.post("/api/auth/login", json=credentials).json()["user"]
    assert after_guest["mode"] == "guest"
    assert after_guest["isHost"] is True


def test_login_unknown_email_gives_the_same_401(client: TestClient) -> None:
    response = client.post(
        "/api/auth/login", json={"email": "nobody@example.com", "password": "secret123"}
    )

    assert response.status_code == 401
    assert response.json() == {"detail": "Wrong email or password", "code": "invalid_credentials"}


def test_me_with_garbage_token_is_401(client: TestClient) -> None:
    response = client.get("/api/auth/me", headers={"Authorization": "Bearer not-a-jwt"})

    assert response.status_code == 401
    assert response.json()["code"] == "invalid_token"


def test_a_fresh_token_works_on_me(client: TestClient) -> None:
    headers = register(client, "ana@example.com")

    me = client.get("/api/auth/me", headers=headers)

    assert me.status_code == 200
    assert me.json()["email"] == "ana@example.com"


def test_a_deleted_users_token_does_not_sign_in_as_the_user_who_got_their_id(
    client: TestClient,
) -> None:
    session_factory = get_from_di_container(ISessionFactory)
    ana_headers = register(client, "ana@example.com")
    ana_id = user_id(client, ana_headers)
    assert client.delete(f"/api/users/{ana_id}", headers=ana_headers).status_code == 204

    marko_headers = register(client, "marko@example.com")
    marko_id = user_id(client, marko_headers)
    if session_factory.engine.dialect.name == "sqlite":
        assert marko_id == ana_id  # SQLite hands a deleted row's id to the next insert
    # iat and created_at have whole seconds; Marko signing up a minute later stands in for the wait.
    with session_factory() as session:
        marko = session.get_one(User, marko_id)
        marko.created_at += timedelta(minutes=1)
        session.commit()

    me = client.get("/api/auth/me", headers=ana_headers)
    assert (me.status_code, me.json()["code"]) == (401, "invalid_token")
