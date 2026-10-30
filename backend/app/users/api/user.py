from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Path, Query, status

from app.auth.schemas.auth import CurrentUser
from app.database.session_handler import DBAPIRouter
from app.deps import (
    CURRENT_USER_ERRORS,
    OPTIONAL_USER_ERRORS,
    get_current_user,
    get_di_entity,
    get_optional_user,
)
from app.users.exceptions.user import NotAccountOwnerException, UserNotFoundException
from app.users.schemas.user import (
    PublicUserResponseSchema,
    UserListFilters,
    UserResponseSchema,
    UserUpdateRequestSchema,
)
from app.users.services.user import IUserService
from app.utils.exceptions import ValidationFailedException
from app.utils.openapi import error_responses
from app.utils.pagination import Page, PaginationParams, get_pagination_params

router = DBAPIRouter(prefix="/users")

# Ids above this overflow SQLite's 64-bit integer as a 500; bounded here they are a 422.
_MAX_ID = 2**31 - 1

UserId = Annotated[int, Path(ge=1, le=_MAX_ID)]

# Examples for /docs, copied from real responses.
_INVALID_FILTER = ValidationFailedException({"isHost": "Input should be a valid boolean"})
_INVALID_ID = ValidationFailedException(
    {"user_id": "Input should be a valid integer, unable to parse string as an integer"}
)
_INVALID_BODY = ValidationFailedException({"name": "String should have at least 2 characters"})


def get_user_filters(
    search: Annotated[str, Query(max_length=80, description="Matches the name, any case")] = "",
    is_host: Annotated[bool | None, Query(alias="isHost")] = None,
) -> UserListFilters:
    return UserListFilters(search=search, is_host=is_host)


@router.get(
    path="",
    summary="List users",
    description="Public profiles, newest first. No `email` or `mode`.",
    responses=error_responses(*OPTIONAL_USER_ERRORS, _INVALID_FILTER),
    # Public, but a token that is sent must be valid (docs/entities.md).
    dependencies=[Depends(get_optional_user)],
)
def get_users(
    user_service: Annotated[IUserService, Depends(get_di_entity(IUserService))],
    filters: Annotated[UserListFilters, Depends(get_user_filters)],
    pagination_params: Annotated[PaginationParams, Depends(get_pagination_params)],
) -> Page[PublicUserResponseSchema]:
    return user_service.list(filters=filters, pagination_params=pagination_params)


@router.get(
    path="/{user_id}",
    summary="Get user",
    description="The public profile. The full user (with `email` and `mode`) is `/api/auth/me`.",
    responses=error_responses(*OPTIONAL_USER_ERRORS, UserNotFoundException(), _INVALID_ID),
    dependencies=[Depends(get_optional_user)],
)
def get_user(
    user_id: UserId,
    user_service: Annotated[IUserService, Depends(get_di_entity(IUserService))],
) -> PublicUserResponseSchema:
    return user_service.get(user_id=user_id)


@router.patch(
    path="/{user_id}",
    summary="Update own account",
    description="`mode: host` also turns hosting on (`isHost: true`) for good.",
    responses=error_responses(
        *CURRENT_USER_ERRORS,
        NotAccountOwnerException(),
        UserNotFoundException(),
        _INVALID_BODY,
    ),
)
def update_user(
    user_id: UserId,
    data: UserUpdateRequestSchema,
    user_service: Annotated[IUserService, Depends(get_di_entity(IUserService))],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> UserResponseSchema:
    return user_service.update(user_id=user_id, data=data, current_user=current_user)


@router.delete(
    path="/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
    summary="Delete own account",
    description="Also deletes the user's spaces.",
    responses=error_responses(
        *CURRENT_USER_ERRORS, NotAccountOwnerException(), UserNotFoundException(), _INVALID_ID
    ),
)
def delete_user(
    user_id: UserId,
    user_service: Annotated[IUserService, Depends(get_di_entity(IUserService))],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> None:
    user_service.delete(user_id=user_id, current_user=current_user)
