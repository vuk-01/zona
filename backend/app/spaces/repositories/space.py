from __future__ import annotations

from typing import Protocol

from sqlalchemy import Select, delete, func, or_, select, update
from sqlalchemy.orm import joinedload

from app.bookings.models.booking import Booking
from app.database.session_factory import ISessionFactory
from app.favorites.models.favorite import Favorite
from app.spaces.models.space import Space, space_visible_to
from app.spaces.schemas.space import SpaceListFilters
from app.utils.di import inject
from app.utils.pagination import Page, PaginationParams, paginate


class ISpaceRepository(Protocol):
    def get_all(
        self, filters: SpaceListFilters, viewer_id: int | None, pagination_params: PaginationParams
    ) -> Page[Space]: ...

    def get_by_id(self, space_id: int) -> Space | None: ...

    def exists(self, space_id: int) -> bool: ...

    def add(self, space: Space) -> Space: ...

    def save(self, space: Space) -> Space: ...

    def delete(self, space_id: int) -> bool: ...

    def lock_for_booking(self, booking_id: int) -> int | None: ...


@inject(alias=ISpaceRepository)
class SpaceRepository(ISpaceRepository):
    def __init__(self, session_factory: ISessionFactory) -> None:
        self._session_factory = session_factory

    def get_all(
        self, filters: SpaceListFilters, viewer_id: int | None, pagination_params: PaginationParams
    ) -> Page[Space]:
        db = self._session_factory()
        # The host is on every card: load it in the same query, not one query per row (N+1).
        query = select(Space).options(joinedload(Space.host))
        query = query.where(space_visible_to(viewer_id))
        query = _filtered(query, filters)
        if filters.favorite_of is not None:
            # Another domain's table in the same query (ADR-020): only the spaces this user saved,
            # newest saved first; the other filters and the visibility rule still apply.
            query = query.join(
                Favorite,
                (Favorite.space_id == Space.id) & (Favorite.user_id == filters.favorite_of),
            ).order_by(Favorite.created_at.desc(), Favorite.id.desc())
        else:
            query = query.order_by(Space.created_at.desc(), Space.id.desc())
        return paginate(query=query, pagination_params=pagination_params, db=db)

    def get_by_id(self, space_id: int) -> Space | None:
        db = self._session_factory()
        return db.get(Space, space_id, options=[joinedload(Space.host)])

    def exists(self, space_id: int) -> bool:
        db = self._session_factory()
        # Always a query to the database. db.get() may answer from the session's identity map when
        # the space is loaded and not expired, and this check is about rows other requests changed.
        return db.scalar(select(Space.id).where(Space.id == space_id)) is not None

    def add(self, space: Space) -> Space:
        db = self._session_factory()
        # A SAVEPOINT: when the database refuses the row, only the savepoint rolls back and the
        # session stays usable, so the service can still look up the host.
        with db.begin_nested():
            db.add(space)
            db.flush()  # assigns id and created_at; the endpoint's session handler commits (ADR-009)
        return space

    def save(self, space: Space) -> Space:
        db = self._session_factory()
        # Flush now, so a constraint violation or a vanished row (StaleDataError) raises here,
        # where the service can name it, and not later inside the session handler's commit as a 500.
        db.flush()
        return space

    def delete(self, space_id: int) -> bool:
        """False when the row was already gone (deleted by a parallel request)."""
        db = self._session_factory()
        # A DELETE statement, not db.delete(space): without a version column the ORM only warns
        # when the row is already gone, so the returned id is the only way to tell.
        deleted_id = db.execute(
            delete(Space).where(Space.id == space_id).returning(Space.id)
        ).scalar_one_or_none()
        return deleted_id is not None

    def lock_for_booking(self, booking_id: int) -> int | None:
        """Locks the space of a booking until the transaction ends; None when the booking is gone.

        The first write of the transaction (ADR-023): the space is found through the booking
        inside the same statement, so nothing the rule depends on is read before the lock; only
        the booking's participants are, and they never change (ADR-024).
        """
        db = self._session_factory()
        # Another domain's table in the same query (ADR-020). A no-op UPDATE is a write on both
        # engines (ADR-003): a row lock on Postgres, the database's write lock on SQLite. The
        # values do not change, so there is nothing to synchronize in the session.
        space_id = select(Booking.space_id).where(Booking.id == booking_id).scalar_subquery()
        return db.execute(
            update(Space)
            .where(Space.id == space_id)
            .values(id=Space.id)
            .returning(Space.id)
            .execution_options(synchronize_session=False)
        ).scalar_one_or_none()


def _filtered(query: Select[Space], filters: SpaceListFilters) -> Select[Space]:
    if filters.search:
        pattern = f"%{filters.search}%"  # a bound parameter, not SQL (ADR-012)
        query = query.where(or_(Space.name.ilike(pattern), Space.city.ilike(pattern)))
    if filters.category is not None:
        query = query.where(Space.category == filters.category)
    if filters.city:
        query = query.where(func.lower(Space.city) == func.lower(filters.city))
    if filters.host_id is not None:
        query = query.where(Space.host_id == filters.host_id)
    if filters.status is not None:
        query = query.where(Space.status == filters.status)
    if filters.min_price is not None:
        query = query.where(Space.price_per_hour >= filters.min_price)
    if filters.max_price is not None:
        query = query.where(Space.price_per_hour <= filters.max_price)
    return query
