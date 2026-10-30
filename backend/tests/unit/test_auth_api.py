"""API layer only: the auth service is a mock."""

from __future__ import annotations

from typing import Any
from unittest.mock import Mock

import pytest
from fastapi.testclient import TestClient

from app.auth.exceptions.auth import EmailAlreadyRegisteredException, InvalidCredentialsException
from app.auth.schemas.auth import AuthenticationResponseSchema
from app.users.models.user import UserMode
from app.users.schemas.user import UserResponseSchema
from tests.utils import create_current_user

pytestmark = pytest.mark.unit

REGISTER_BODY = {"email": "ana@example.com", "password": "secret123", "name": "Ana"}

USER_JSON = {
    "id": 1,
    "email": "ana@example.com",
    "name": "Test User",
    "avatarUrl": None,
    "city": "",
    "bio": "",
    "isHost": False,
    "mode": "guest",
    "createdAt": "2026-01-01T00:00:00Z",
}


def _auth_response(mode: UserMode = UserMode.GUEST) -> AuthenticationResponseSchema:
    user = create_current_user(1, "ana@example.com", is_host=mode == UserMode.HOST, mode=mode)
    return AuthenticationResponseSchema(
        token="jwt", user=UserResponseSchema.model_validate(user, from_attributes=True)
    )


def test_register_returns_201_with_token_and_user(client: TestClient, auth_service: Mock) -> None:
    auth_service.register.return_value = _auth_response()

    response = client.post("/api/auth/register", json=REGISTER_BODY)

    assert response.status_code == 201
    assert response.json() == {"token": "jwt", "user": USER_JSON}


def test_register_trims_the_name_before_the_service(client: TestClient, auth_service: Mock) -> None:
    auth_service.register.return_value = _auth_response()

    client.post("/api/auth/register", json={**REGISTER_BODY, "name": "  Ana  "})

    assert auth_service.register.call_args.args[0].name == "Ana"


def test_register_duplicate_email_is_409_with_field_error(
    client: TestClient, auth_service: Mock
) -> None:
    auth_service.register.side_effect = EmailAlreadyRegisteredException()

    response = client.post("/api/auth/register", json=REGISTER_BODY)

    assert response.status_code == 409
    assert response.json() == {
        "detail": "Email is already registered",
        "code": "email_already_registered",
        "fieldErrors": {"email": "Email is already registered"},
    }


@pytest.mark.parametrize(
    ("changes", "field"),
    [
        ({"password": "short"}, "password"),
        ({"name": "A"}, "name"),
        ({"name": "   A   "}, "name"),  # trimmed first, then too short
        ({"name": "A" * 61}, "name"),
        ({"displayName": "Ana", "name": None}, "name"),  # the old field is not accepted
    ],
)
def test_register_with_invalid_field_is_422(
    client: TestClient, auth_service: Mock, changes: dict[str, Any], field: str
) -> None:
    body = {key: value for key, value in (REGISTER_BODY | changes).items() if value is not None}

    response = client.post("/api/auth/register", json=body)

    assert response.status_code == 422
    assert response.json()["code"] == "validation_error"
    assert set(response.json()["fieldErrors"]) == {field}
    auth_service.register.assert_not_called()


def test_login_wrong_password_is_401(client: TestClient, auth_service: Mock) -> None:
    auth_service.login.side_effect = InvalidCredentialsException()

    response = client.post(
        "/api/auth/login", json={"email": "ana@example.com", "password": "wrong"}
    )

    assert response.status_code == 401
    assert response.json() == {"detail": "Wrong email or password", "code": "invalid_credentials"}


def test_login_returns_the_mode_from_the_service(client: TestClient, auth_service: Mock) -> None:
    auth_service.login.return_value = _auth_response(UserMode.HOST)

    response = client.post(
        "/api/auth/login", json={"email": "ana@example.com", "password": "secret123"}
    )

    assert response.status_code == 200
    assert response.json()["user"]["mode"] == "host"


def test_me_returns_the_full_user_behind_the_token(client: TestClient) -> None:
    response = client.get("/api/auth/me", headers={"Authorization": "Bearer token"})

    assert response.status_code == 200
    assert response.json() == USER_JSON | {"email": "test@example.com"}
