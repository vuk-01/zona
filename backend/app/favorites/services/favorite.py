from __future__ import annotations

from typing import Protocol

from sqlalchemy.exc import IntegrityError

from app.auth.exceptions.auth import InvalidTokenException
from app.auth.schemas.auth import CurrentUser
from app.favorites.models.favorite import Favorite
from app.favorites.repositories.favorite import IFavoriteRepository
from app.favorites.schemas.favorite import (
    FavoriteCreateRequestSchema,
    FavoriteResponseSchema,
    FavoriteSaved,
)
from app.spaces.exceptions.space import SpaceNotFoundException
from app.spaces.repositories.space import ISpaceRepository
from app.spaces.services.space import ISpaceService
from app.users.repositories.user import IUserRepository
from app.utils.di import inject
from app.utils.pagination import Page, PaginationParams


class IFavoriteService(Protocol):
    def list(
        self, pagination_params: PaginationParams, current_user: CurrentUser
    ) -> Page[FavoriteResponseSchema]: ...

    def create(
        self, data: FavoriteCreateRequestSchema, current_user: CurrentUser
    ) -> FavoriteSaved: ...

    def delete(self, space_id: int, current_user: CurrentUser) -> None: ...


@inject(alias=IFavoriteService)
class FavoriteService(IFavoriteService):
    def __init__(
        self,
        favorite_repository: IFavoriteRepository,
        space_service: ISpaceService,
        space_repository: ISpaceRepository,
        user_repository: IUserRepository,
    ) -> None:
        self._favorite_repository = favorite_repository
        self._space_service = space_service
        self._space_repository = space_repository
        self._user_repository = user_repository

    def list(
        self, pagination_params: PaginationParams, current_user: CurrentUser
    ) -> Page[FavoriteResponseSchema]:
        # Favorites are private: always the signed-in user's own (ADR-006).
        favorites = self._favorite_repository.get_all(
            user_id=current_user.id, pagination_params=pagination_params
        )
        return Page(
            total=favorites.total,
            items=[FavoriteResponseSchema.model_validate(favorite) for favorite in favorites.items],
            pages=favorites.pages,
        )

    def create(self, data: FavoriteCreateRequestSchema, current_user: CurrentUser) -> FavoriteSaved:
        # Only a space the user can view: 404 for an unknown id or someone else's draft.
        self._space_service.get(space_id=data.space_id, current_user=current_user)
        # The user is always the signed-in one, never an id from the request body (ADR-006).
        favorite = Favorite(user_id=current_user.id, space_id=data.space_id)
        try:
            favorite = self._favorite_repository.add(favorite)
        except IntegrityError as e:
            # No SELECT for the pair before the INSERT (ADR-007): the refusal says which rule held.
            if self._user_repository.get_by_id(current_user.id) is None:
                raise InvalidTokenException from e  # the account was deleted meanwhile (ADR-019)
            if not self._space_repository.exists(data.space_id):
                raise SpaceNotFoundException from e  # the space was deleted meanwhile (ADR-019)
            existing = self._favorite_repository.get(
                user_id=current_user.id, space_id=data.space_id
            )
            if existing is None:
                # The pair refused the INSERT and a parallel DELETE removed it before the read
                # (READ COMMITTED): insert once more. A second refusal is a bug and re-raises.
                favorite = self._favorite_repository.add(
                    Favorite(user_id=current_user.id, space_id=data.space_id)
                )
                return FavoriteSaved(
                    favorite=FavoriteResponseSchema.model_validate(favorite), created=True
                )
            # Saved already (a second click, or a parallel request): not an error (ADR-021).
            return FavoriteSaved(
                favorite=FavoriteResponseSchema.model_validate(existing), created=False
            )
        return FavoriteSaved(favorite=FavoriteResponseSchema.model_validate(favorite), created=True)

    def delete(self, space_id: int, current_user: CurrentUser) -> None:
        # Only the user's own pair; removing one that is not saved is not an error (ADR-021).
        self._favorite_repository.delete(user_id=current_user.id, space_id=space_id)
