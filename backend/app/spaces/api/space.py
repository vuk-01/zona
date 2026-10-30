from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Path, Query, status

from app.auth.exceptions.auth import NotAuthenticatedException
from app.auth.schemas.auth import CurrentUser
from app.database.session_handler import DBAPIRouter
from app.deps import (
    CURRENT_USER_ERRORS,
    OPTIONAL_USER_ERRORS,
    get_current_user,
    get_di_entity,
    get_optional_user,
)
from app.spaces.exceptions.space import (
    NotAHostException,
    NotOwnFavoritesException,
    NotSpaceOwnerException,
    SpaceNotFoundException,
)
from app.spaces.models.space import SpaceCategory, SpaceStatus
from app.spaces.schemas.space import (
    SpaceCreateRequestSchema,
    SpaceListFilters,
    SpaceResponseSchema,
    SpaceUpdateRequestSchema,
)
from app.spaces.services.space import ISpaceService
from app.utils.exceptions import ValidationFailedException
from app.utils.openapi import error_responses
from app.utils.pagination import Page, PaginationParams, get_pagination_params

router = DBAPIRouter(prefix="/spaces")

# Ids above this overflow SQLite's 64-bit integer as a 500; bounded here they are a 422.
_MAX_ID = 2**31 - 1

SpaceId = Annotated[int, Path(ge=1, le=_MAX_ID)]

# Examples for /docs, copied from real responses.
_INVALID_FILTER = ValidationFailedException({"size": "Input should be greater than or equal to 1"})
_INVALID_ID = ValidationFailedException(
    {"space_id": "Input should be a valid integer, unable to parse string as an integer"}
)
_INVALID_BODY = ValidationFailedException({"name": "String should have at least 3 characters"})


def get_space_filters(
    search: Annotated[str, Query(max_length=80, description="Matches the name or the city")] = "",
    category: SpaceCategory | None = None,
    city: Annotated[str | None, Query(max_length=80, description="Exact, any case")] = None,
    host_id: Annotated[int | None, Query(alias="hostId", ge=1, le=_MAX_ID)] = None,
    space_status: Annotated[SpaceStatus | None, Query(alias="status")] = None,
    min_price: Annotated[
        float | None, Query(alias="minPrice", ge=0, le=1000, allow_inf_nan=False)
    ] = None,
    max_price: Annotated[
        float | None, Query(alias="maxPrice", ge=0, le=1000, allow_inf_nan=False)
    ] = None,
    favorite_of: Annotated[
        int | None, Query(alias="favoriteOf", ge=1, le=_MAX_ID, description="Own id only")
    ] = None,
) -> SpaceListFilters:
    return SpaceListFilters(
        search=search,
        category=category,
        city=city,
        host_id=host_id,
        status=space_status,
        min_price=min_price,
        max_price=max_price,
        favorite_of=favorite_of,
    )


@router.get(
    path="",
    summary="List spaces",
    description=(
        "Newest first. Listed spaces for everyone, plus the signed-in user's own drafts. "
        "`hostId` = own id adds `bookingCounts` to every space. `favoriteOf` = own id lists the "
        "spaces the user saved, newest saved first (needs a token)."
    ),
    responses=error_responses(
        *OPTIONAL_USER_ERRORS,
        NotAuthenticatedException(),
        NotOwnFavoritesException(),
        _INVALID_FILTER,
    ),
)
def get_spaces(
    space_service: Annotated[ISpaceService, Depends(get_di_entity(ISpaceService))],
    filters: Annotated[SpaceListFilters, Depends(get_space_filters)],
    pagination_params: Annotated[PaginationParams, Depends(get_pagination_params)],
    current_user: Annotated[CurrentUser | None, Depends(get_optional_user)],
) -> Page[SpaceResponseSchema]:
    return space_service.list(
        filters=filters, pagination_params=pagination_params, current_user=current_user
    )


@router.get(
    path="/{space_id}",
    summary="Get space",
    description="404 for someone else's draft.",
    responses=error_responses(*OPTIONAL_USER_ERRORS, SpaceNotFoundException(), _INVALID_ID),
)
def get_space(
    space_id: SpaceId,
    space_service: Annotated[ISpaceService, Depends(get_di_entity(ISpaceService))],
    current_user: Annotated[CurrentUser | None, Depends(get_optional_user)],
) -> SpaceResponseSchema:
    return space_service.get(space_id=space_id, current_user=current_user)


@router.post(
    path="",
    status_code=status.HTTP_201_CREATED,
    summary="Create space (hosts only)",
    responses=error_responses(*CURRENT_USER_ERRORS, NotAHostException(), _INVALID_BODY),
)
def create_space(
    data: SpaceCreateRequestSchema,
    space_service: Annotated[ISpaceService, Depends(get_di_entity(ISpaceService))],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> SpaceResponseSchema:
    return space_service.create(data=data, current_user=current_user)


@router.patch(
    path="/{space_id}",
    summary="Update space (host only)",
    description="The space after the change is validated as a whole.",
    responses=error_responses(
        *CURRENT_USER_ERRORS,
        NotSpaceOwnerException(),
        SpaceNotFoundException(),
        _INVALID_BODY,
    ),
)
def update_space(
    space_id: SpaceId,
    data: SpaceUpdateRequestSchema,
    space_service: Annotated[ISpaceService, Depends(get_di_entity(ISpaceService))],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> SpaceResponseSchema:
    return space_service.update(space_id=space_id, data=data, current_user=current_user)


@router.delete(
    path="/{space_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
    summary="Delete space (host only)",
    responses=error_responses(
        *CURRENT_USER_ERRORS, NotSpaceOwnerException(), SpaceNotFoundException(), _INVALID_ID
    ),
)
def delete_space(
    space_id: SpaceId,
    space_service: Annotated[ISpaceService, Depends(get_di_entity(ISpaceService))],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> None:
    space_service.delete(space_id=space_id, current_user=current_user)
