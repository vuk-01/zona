from __future__ import annotations

from dataclasses import dataclass
from typing import Annotated

from pydantic import EmailStr, StringConstraints, field_validator
from pydantic_core import PydanticCustomError

from app.users.models.user import UserMode
from app.utils.schemas import CamelCaseModel, CamelCaseResponseModel, UtcDatetime

UserName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=60)]
AvatarUrl = Annotated[
    str, StringConstraints(strip_whitespace=True, max_length=500, pattern=r"^https?://\S+$")
]
UserCity = Annotated[str, StringConstraints(strip_whitespace=True, max_length=80)]
Bio = Annotated[str, StringConstraints(strip_whitespace=True, max_length=200)]


class UserUpdateRequestSchema(CamelCaseModel):
    """Every field optional: PATCH changes only what the client sends (`exclude_unset`).

    Only `avatarUrl` may be sent as `null` (it removes the photo); `null` for any other field is 422.
    """

    name: UserName | None = None
    avatar_url: AvatarUrl | None = None
    city: UserCity | None = None
    bio: Bio | None = None
    mode: UserMode | None = None

    # Runs only for fields the client sent: defaults are not validated.
    @field_validator("name", "city", "bio", "mode")
    @classmethod
    def _not_null(cls, value: object) -> object:
        if value is None:
            raise PydanticCustomError("not_null", "Must not be null")
        return value


@dataclass
class UserListFilters:
    search: str = ""
    is_host: bool | None = None


class PublicUserResponseSchema(CamelCaseResponseModel):
    """What other people see of a user: no `email`, no `mode`."""

    id: int
    name: str
    avatar_url: str | None
    city: str
    bio: str
    is_host: bool
    created_at: UtcDatetime


class UserResponseSchema(PublicUserResponseSchema):
    """The full user, only ever returned to the user themselves."""

    email: EmailStr
    mode: UserMode
