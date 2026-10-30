from __future__ import annotations

from typing import Annotated, Any

from fastapi import Depends, Path, Response, status

from app.auth.schemas.auth import CurrentUser
from app.database.session_handler import DBAPIRouter
from app.deps import CURRENT_USER_ERRORS, get_current_user, get_di_entity
from app.favorites.schemas.favorite import (
    MAX_ID,
    FavoriteCreateRequestSchema,
    FavoriteResponseSchema,
)
from app.favorites.services.favorite import IFavoriteService
from app.spaces.exceptions.space import SpaceNotFoundException
from app.utils.exceptions import ValidationFailedException
from app.utils.openapi import error_responses
from app.utils.pagination import Page, PaginationParams, get_pagination_params

router = DBAPIRouter(prefix="/favorites")

SpaceId = Annotated[int, Path(ge=1, le=MAX_ID)]

# Examples for /docs, copied from real responses.
_INVALID_FILTER = ValidationFailedException({"size": "Input should be greater than or equal to 1"})
_INVALID_ID = ValidationFailedException(
    {"space_id": "Input should be a valid integer, unable to parse string as an integer"}
)
_INVALID_BODY = ValidationFailedException({"spaceId": "Field required"})

_ALREADY_SAVED: dict[int | str, dict[str, Any]] = {
    status.HTTP_200_OK: {
        "model": FavoriteResponseSchema,
        "description": "Already saved: the existing favorite, unchanged",
    }
}


@router.get(
    path="",
    summary="List own favorites",
    description="Newest saved first. Favorites are private: only the signed-in user's own.",
    responses=error_responses(*CURRENT_USER_ERRORS, _INVALID_FILTER),
)
def get_favorites(
    favorite_service: Annotated[IFavoriteService, Depends(get_di_entity(IFavoriteService))],
    pagination_params: Annotated[PaginationParams, Depends(get_pagination_params)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> Page[FavoriteResponseSchema]:
    return favorite_service.list(pagination_params=pagination_params, current_user=current_user)


@router.post(
    path="",
    status_code=status.HTTP_201_CREATED,
    summary="Save a space",
    description="Saving a space twice is not an error: `200` with the existing favorite.",
    responses=_ALREADY_SAVED
    | error_responses(*CURRENT_USER_ERRORS, SpaceNotFoundException(), _INVALID_BODY),
)
def create_favorite(
    data: FavoriteCreateRequestSchema,
    response: Response,
    favorite_service: Annotated[IFavoriteService, Depends(get_di_entity(IFavoriteService))],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> FavoriteResponseSchema:
    saved = favorite_service.create(data=data, current_user=current_user)
    if not saved.created:
        # The status code is HTTP's business, so it is set here, not in the service (ADR-021).
        response.status_code = status.HTTP_200_OK
    return saved.favorite


@router.delete(
    path="/{space_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
    summary="Remove a saved space",
    description="Also `204` when the space was not saved.",
    responses=error_responses(*CURRENT_USER_ERRORS, _INVALID_ID),
)
def delete_favorite(
    space_id: SpaceId,
    favorite_service: Annotated[IFavoriteService, Depends(get_di_entity(IFavoriteService))],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> None:
    favorite_service.delete(space_id=space_id, current_user=current_user)
