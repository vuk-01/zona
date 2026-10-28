from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Path, Query, status

from app.auth.schemas.auth import CurrentUser
from app.database.session_handler import DBAPIRouter
from app.deps import get_current_user, get_di_entity, get_optional_user
from app.spaces.models.space import SpaceCategory, SpaceStatus
from app.spaces.schemas.space import (
    SpaceCreateRequestSchema,
    SpaceListFilters,
    SpaceResponseSchema,
    SpaceUpdateRequestSchema,
)
from app.spaces.services.space import ISpaceService
from app.utils.pagination import Page, PaginationParams, get_pagination_params

router = DBAPIRouter(prefix="/spaces")

# Ids above this overflow SQLite's 64-bit integer as a 500; bounded here they are a 422.
_MAX_ID = 2**31 - 1

SpaceId = Annotated[int, Path(ge=1, le=_MAX_ID)]


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
) -> SpaceListFilters:
    return SpaceListFilters(
        search=search,
        category=category,
        city=city,
        host_id=host_id,
        status=space_status,
        min_price=min_price,
        max_price=max_price,
    )


@router.get(
    path="",
    summary="List spaces",
    description=(
        "Newest first. Listed spaces for everyone, plus the signed-in user's own drafts. "
        "`hostId` = own id adds `bookingCounts` to every space."
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


@router.get(path="/{space_id}", summary="Get space", description="404 for someone else's draft.")
def get_space(
    space_id: SpaceId,
    space_service: Annotated[ISpaceService, Depends(get_di_entity(ISpaceService))],
    current_user: Annotated[CurrentUser | None, Depends(get_optional_user)],
) -> SpaceResponseSchema:
    return space_service.get(space_id=space_id, current_user=current_user)


@router.post(path="", status_code=status.HTTP_201_CREATED, summary="Create space (hosts only)")
def create_space(
    data: SpaceCreateRequestSchema,
    space_service: Annotated[ISpaceService, Depends(get_di_entity(ISpaceService))],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> SpaceResponseSchema:
    return space_service.create(data=data, current_user=current_user)


@router.patch(path="/{space_id}", summary="Update space (host only)")
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
)
def delete_space(
    space_id: SpaceId,
    space_service: Annotated[ISpaceService, Depends(get_di_entity(ISpaceService))],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> None:
    space_service.delete(space_id=space_id, current_user=current_user)
