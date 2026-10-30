from __future__ import annotations

from typing import Protocol

from sqlalchemy import delete, select

from app.database.session_factory import ISessionFactory
from app.listings.models.listing import Listing
from app.utils.di import inject
from app.utils.pagination import Page, PaginationParams, paginate


class IListingRepository(Protocol):
    def get_all(self, search: str, pagination_params: PaginationParams) -> Page[Listing]: ...

    def get_by_id(self, listing_id: int) -> Listing | None: ...

    def add(self, listing: Listing) -> Listing: ...

    def save(self, listing: Listing) -> Listing: ...

    def delete(self, listing_id: int) -> bool: ...


@inject(alias=IListingRepository)
class ListingRepository(IListingRepository):
    def __init__(self, session_factory: ISessionFactory) -> None:
        self._session_factory = session_factory

    def get_all(self, search: str, pagination_params: PaginationParams) -> Page[Listing]:
        db = self._session_factory()
        query = select(Listing).order_by(Listing.created_at.desc(), Listing.id.desc())
        if search:
            query = query.where(Listing.title.ilike(f"%{search}%"))  # a bound parameter, not SQL
        return paginate(query=query, pagination_params=pagination_params, db=db)

    def get_by_id(self, listing_id: int) -> Listing | None:
        db = self._session_factory()
        return db.get(Listing, listing_id)

    def add(self, listing: Listing) -> Listing:
        db = self._session_factory()
        # A SAVEPOINT: when the database refuses the row, only the savepoint rolls back and the
        # session stays usable, so the service can still look up the owner.
        with db.begin_nested():
            db.add(listing)
            db.flush()  # assigns id and created_at; the endpoint's session handler commits (ADR-009)
        return listing

    def save(self, listing: Listing) -> Listing:
        db = self._session_factory()
        # Flush now, so a vanished row (StaleDataError) raises here, where the service can name it,
        # and not later inside the session handler's commit as a 500.
        db.flush()
        return listing

    def delete(self, listing_id: int) -> bool:
        """False when the row was already gone (deleted by a parallel request)."""
        db = self._session_factory()
        # A DELETE statement, not db.delete(listing): without a version column the ORM only warns
        # when the row is already gone, so the returned id is the only way to tell.
        deleted_id = db.execute(
            delete(Listing).where(Listing.id == listing_id).returning(Listing.id)
        ).scalar_one_or_none()
        return deleted_id is not None
