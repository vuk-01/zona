from __future__ import annotations

from typing import Protocol

from sqlalchemy import delete, select

from app.database.session_factory import ISessionFactory
from app.favorites.models.favorite import Favorite
from app.utils.di import inject
from app.utils.pagination import Page, PaginationParams, paginate


class IFavoriteRepository(Protocol):
    def get_all(self, user_id: int, pagination_params: PaginationParams) -> Page[Favorite]: ...

    def get(self, user_id: int, space_id: int) -> Favorite | None: ...

    def add(self, favorite: Favorite) -> Favorite: ...

    def delete(self, user_id: int, space_id: int) -> None: ...


@inject(alias=IFavoriteRepository)
class FavoriteRepository(IFavoriteRepository):
    def __init__(self, session_factory: ISessionFactory) -> None:
        self._session_factory = session_factory

    def get_all(self, user_id: int, pagination_params: PaginationParams) -> Page[Favorite]:
        db = self._session_factory()
        # Newest saved first; `id` breaks the tie between two rows saved in the same second.
        query = (
            select(Favorite)
            .where(Favorite.user_id == user_id)
            .order_by(Favorite.created_at.desc(), Favorite.id.desc())
        )
        return paginate(query=query, pagination_params=pagination_params, db=db)

    def get(self, user_id: int, space_id: int) -> Favorite | None:
        db = self._session_factory()
        return db.scalar(
            select(Favorite).where(Favorite.user_id == user_id, Favorite.space_id == space_id)
        )

    def add(self, favorite: Favorite) -> Favorite:
        db = self._session_factory()
        # A SAVEPOINT: when the database refuses the row, only the savepoint rolls back and the
        # session stays usable, so the service can still find out which rule refused it.
        with db.begin_nested():
            db.add(favorite)
            db.flush()  # assigns created_at; the endpoint's session handler commits (ADR-009)
        return favorite

    def delete(self, user_id: int, space_id: int) -> None:
        db = self._session_factory()
        # Idempotent (ADR-021): no row, or a row a parallel request removed first, is not an error,
        # so the count is not read.
        db.execute(
            delete(Favorite).where(Favorite.user_id == user_id, Favorite.space_id == space_id)
        )
