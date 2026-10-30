from __future__ import annotations

from typing import Protocol

from sqlalchemy import Select, delete, func, or_, select
from sqlalchemy.orm import joinedload

from app.database.session_factory import ISessionFactory
from app.spaces.models.space import Space, SpaceStatus
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


@inject(alias=ISpaceRepository)
class SpaceRepository(ISpaceRepository):
    def __init__(self, session_factory: ISessionFactory) -> None:
        self._session_factory = session_factory

    def get_all(
        self, filters: SpaceListFilters, viewer_id: int | None, pagination_params: PaginationParams
    ) -> Page[Space]:
        db = self._session_factory()
        # The host is on every card: load it in the same query, not one query per row (N+1).
        query = (
            select(Space)
            .options(joinedload(Space.host))
            .order_by(Space.created_at.desc(), Space.id.desc())
        )
        query = _visible_to(query, viewer_id)
        query = _filtered(query, filters)
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


def _visible_to(query: Select[Space], viewer_id: int | None) -> Select[Space]:
    """Listed spaces for everyone, plus the viewer's own drafts; other people's drafts never."""
    if viewer_id is None:
        return query.where(Space.status == SpaceStatus.LISTED)
    return query.where(or_(Space.status == SpaceStatus.LISTED, Space.host_id == viewer_id))


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
