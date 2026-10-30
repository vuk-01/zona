from __future__ import annotations

from typing import Protocol

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm.exc import StaleDataError

from app.auth.exceptions.auth import InvalidTokenException
from app.auth.schemas.auth import CurrentUser
from app.listings.exceptions.listing import ListingNotFoundException, NotListingOwnerException
from app.listings.models.listing import Listing
from app.listings.repositories.listing import IListingRepository
from app.listings.schemas.listing import (
    ListingCreateRequestSchema,
    ListingResponseSchema,
    ListingUpdateRequestSchema,
)
from app.users.repositories.user import IUserRepository
from app.utils.di import inject
from app.utils.pagination import Page, PaginationParams


class IListingService(Protocol):
    def list(
        self, search: str, pagination_params: PaginationParams
    ) -> Page[ListingResponseSchema]: ...

    def get(self, listing_id: int) -> ListingResponseSchema: ...

    def create(
        self, data: ListingCreateRequestSchema, current_user: CurrentUser
    ) -> ListingResponseSchema: ...

    def update(
        self, listing_id: int, data: ListingUpdateRequestSchema, current_user: CurrentUser
    ) -> ListingResponseSchema: ...

    def delete(self, listing_id: int, current_user: CurrentUser) -> None: ...


@inject(alias=IListingService)
class ListingService(IListingService):
    def __init__(
        self, listing_repository: IListingRepository, user_repository: IUserRepository
    ) -> None:
        self._listing_repository = listing_repository
        self._user_repository = user_repository

    def list(self, search: str, pagination_params: PaginationParams) -> Page[ListingResponseSchema]:
        listings = self._listing_repository.get_all(
            search=search, pagination_params=pagination_params
        )
        return Page(
            total=listings.total,
            items=[ListingResponseSchema.model_validate(listing) for listing in listings.items],
            pages=listings.pages,
        )

    def get(self, listing_id: int) -> ListingResponseSchema:
        return ListingResponseSchema.model_validate(self._get_or_raise(listing_id))

    def create(
        self, data: ListingCreateRequestSchema, current_user: CurrentUser
    ) -> ListingResponseSchema:
        # The owner is always the signed-in user, never an id from the request body (ADR-006).
        listing = Listing(**data.model_dump(), owner_id=current_user.id)
        try:
            listing = self._listing_repository.add(listing)
        except IntegrityError as e:
            # Every CHECK and NOT NULL has a Pydantic twin; what is left is the owner_id foreign key,
            # refused when the owner's account was deleted during the request. Their token is then invalid.
            if not self._user_repository.exists(current_user.id):
                raise InvalidTokenException from e
            raise  # the owner exists: a rule Pydantic lets through, a bug, not a client error
        return ListingResponseSchema.model_validate(listing)

    def update(
        self, listing_id: int, data: ListingUpdateRequestSchema, current_user: CurrentUser
    ) -> ListingResponseSchema:
        listing = self._get_or_raise(listing_id)
        self._ensure_owner(listing, current_user)
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(listing, field, value)
        try:
            listing = self._listing_repository.save(listing)
        except StaleDataError as e:
            # The row vanished after it was read (deleted by its owner or with the owner's account).
            raise ListingNotFoundException from e
        return ListingResponseSchema.model_validate(listing)

    def delete(self, listing_id: int, current_user: CurrentUser) -> None:
        listing = self._get_or_raise(listing_id)
        self._ensure_owner(listing, current_user)
        if not self._listing_repository.delete(listing.id):
            # Deleted by a parallel request after it was read.
            raise ListingNotFoundException

    def _get_or_raise(self, listing_id: int) -> Listing:
        listing = self._listing_repository.get_by_id(listing_id)
        if listing is None:
            raise ListingNotFoundException
        return listing

    @staticmethod
    def _ensure_owner(listing: Listing, current_user: CurrentUser) -> None:
        if listing.owner_id != current_user.id:
            raise NotListingOwnerException
