from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Query, status

from app.auth.schemas.auth import CurrentUser
from app.database.session_handler import DBAPIRouter
from app.deps import CURRENT_USER_ERRORS, get_current_user, get_di_entity
from app.listings.exceptions.listing import ListingNotFoundException, NotListingOwnerException
from app.listings.schemas.listing import (
    ListingCreateRequestSchema,
    ListingResponseSchema,
    ListingUpdateRequestSchema,
)
from app.listings.services.listing import IListingService
from app.utils.exceptions import ValidationFailedException
from app.utils.openapi import error_responses
from app.utils.pagination import Page, PaginationParams, get_pagination_params

router = DBAPIRouter(prefix="/listings")

# Examples for /docs, copied from real responses.
_INVALID_FILTER = ValidationFailedException({"size": "Input should be greater than or equal to 1"})
_INVALID_ID = ValidationFailedException(
    {"listing_id": "Input should be a valid integer, unable to parse string as an integer"}
)
_INVALID_BODY = ValidationFailedException({"title": "String should have at least 3 characters"})


@router.get(
    path="",
    summary="List listings",
    description="Newest first; `search` matches the title.",
    responses=error_responses(_INVALID_FILTER),
)
def get_listings(
    listing_service: Annotated[IListingService, Depends(get_di_entity(IListingService))],
    pagination_params: Annotated[PaginationParams, Depends(get_pagination_params)],
    search: Annotated[str, Query(max_length=80)] = "",
) -> Page[ListingResponseSchema]:
    return listing_service.list(search=search, pagination_params=pagination_params)


@router.get(
    path="/{listing_id}",
    summary="Get listing",
    responses=error_responses(ListingNotFoundException(), _INVALID_ID),
)
def get_listing(
    listing_id: int,
    listing_service: Annotated[IListingService, Depends(get_di_entity(IListingService))],
) -> ListingResponseSchema:
    return listing_service.get(listing_id=listing_id)


@router.post(
    path="",
    status_code=status.HTTP_201_CREATED,
    summary="Create listing",
    responses=error_responses(*CURRENT_USER_ERRORS, _INVALID_BODY),
)
def create_listing(
    data: ListingCreateRequestSchema,
    listing_service: Annotated[IListingService, Depends(get_di_entity(IListingService))],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> ListingResponseSchema:
    return listing_service.create(data=data, current_user=current_user)


@router.patch(
    path="/{listing_id}",
    summary="Update listing (owner only)",
    responses=error_responses(
        *CURRENT_USER_ERRORS, NotListingOwnerException(), ListingNotFoundException(), _INVALID_BODY
    ),
)
def update_listing(
    listing_id: int,
    data: ListingUpdateRequestSchema,
    listing_service: Annotated[IListingService, Depends(get_di_entity(IListingService))],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> ListingResponseSchema:
    return listing_service.update(listing_id=listing_id, data=data, current_user=current_user)


@router.delete(
    path="/{listing_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
    summary="Delete listing (owner only)",
    responses=error_responses(
        *CURRENT_USER_ERRORS, NotListingOwnerException(), ListingNotFoundException(), _INVALID_ID
    ),
)
def delete_listing(
    listing_id: int,
    listing_service: Annotated[IListingService, Depends(get_di_entity(IListingService))],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> None:
    listing_service.delete(listing_id=listing_id, current_user=current_user)
