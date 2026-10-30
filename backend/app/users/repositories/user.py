from __future__ import annotations

from typing import Protocol

from sqlalchemy import select

from app.database.session_factory import ISessionFactory
from app.users.models.user import User
from app.users.schemas.user import UserListFilters
from app.utils.di import inject
from app.utils.pagination import Page, PaginationParams, paginate


class IUserRepository(Protocol):
    def get_all(
        self, filters: UserListFilters, pagination_params: PaginationParams
    ) -> Page[User]: ...

    def get_by_id(self, user_id: int) -> User | None: ...

    def save(self, user: User) -> User: ...

    def delete(self, user: User) -> None: ...


@inject(alias=IUserRepository)
class UserRepository(IUserRepository):
    def __init__(self, session_factory: ISessionFactory) -> None:
        self._session_factory = session_factory

    def get_all(self, filters: UserListFilters, pagination_params: PaginationParams) -> Page[User]:
        db = self._session_factory()
        query = select(User).order_by(User.created_at.desc(), User.id.desc())
        if filters.search:
            # A bound parameter, not SQL (ADR-012).
            query = query.where(User.name.ilike(f"%{filters.search}%"))
        if filters.is_host is not None:
            query = query.where(User.is_host == filters.is_host)
        return paginate(query=query, pagination_params=pagination_params, db=db)

    def get_by_id(self, user_id: int) -> User | None:
        db = self._session_factory()
        return db.get(User, user_id)

    def save(self, user: User) -> User:
        db = self._session_factory()
        # Flush now, so a constraint violation raises here, where the service can name it,
        # and not later inside the session handler's commit as a bare 500 (ADR-007).
        db.flush()
        return user

    def delete(self, user: User) -> None:
        db = self._session_factory()
        # Spaces and listings go with the user through ON DELETE CASCADE (passive_deletes).
        db.delete(user)
        db.flush()
