from __future__ import annotations

from typing import Protocol

from sqlalchemy.orm.exc import StaleDataError

from app.auth.schemas.auth import CurrentUser
from app.users.exceptions.user import NotAccountOwnerException, UserNotFoundException
from app.users.models.user import User, UserMode
from app.users.repositories.user import IUserRepository
from app.users.schemas.user import (
    PublicUserResponseSchema,
    UserListFilters,
    UserResponseSchema,
    UserUpdateRequestSchema,
)
from app.utils.di import inject
from app.utils.pagination import Page, PaginationParams


class IUserService(Protocol):
    def list(
        self, filters: UserListFilters, pagination_params: PaginationParams
    ) -> Page[PublicUserResponseSchema]: ...

    def get(self, user_id: int) -> PublicUserResponseSchema: ...

    def update(
        self, user_id: int, data: UserUpdateRequestSchema, current_user: CurrentUser
    ) -> UserResponseSchema: ...

    def delete(self, user_id: int, current_user: CurrentUser) -> None: ...


@inject(alias=IUserService)
class UserService(IUserService):
    def __init__(self, user_repository: IUserRepository) -> None:
        self._user_repository = user_repository

    def list(
        self, filters: UserListFilters, pagination_params: PaginationParams
    ) -> Page[PublicUserResponseSchema]:
        users = self._user_repository.get_all(filters=filters, pagination_params=pagination_params)
        return Page(
            total=users.total,
            items=[PublicUserResponseSchema.model_validate(user) for user in users.items],
            pages=users.pages,
        )

    def get(self, user_id: int) -> PublicUserResponseSchema:
        return PublicUserResponseSchema.model_validate(self._get_or_raise(user_id))

    def update(
        self, user_id: int, data: UserUpdateRequestSchema, current_user: CurrentUser
    ) -> UserResponseSchema:
        user = self._get_owned_or_raise(user_id, current_user)
        changes = data.model_dump(exclude_unset=True)
        # Switching to host mode turns hosting on for good; switching back keeps it (entities.md).
        if changes.get("mode") == UserMode.HOST:
            user.is_host = True
        for field, value in changes.items():
            setattr(user, field, value)
        try:
            user = self._user_repository.save(user)
        except StaleDataError as e:
            # The row vanished after it was read (the account was deleted during the request).
            raise UserNotFoundException from e
        return UserResponseSchema.model_validate(user)

    def delete(self, user_id: int, current_user: CurrentUser) -> None:
        user = self._get_owned_or_raise(user_id, current_user)
        if not self._user_repository.delete(user.id):
            # Deleted by a parallel request after it was read.
            raise UserNotFoundException

    def _get_or_raise(self, user_id: int) -> User:
        user = self._user_repository.get_by_id(user_id)
        if user is None:
            raise UserNotFoundException
        return user

    def _get_owned_or_raise(self, user_id: int, current_user: CurrentUser) -> User:
        # 404 before 403: public profiles are listed anyway, so a 403 reveals nothing new.
        user = self._get_or_raise(user_id)
        if user.id != current_user.id:
            raise NotAccountOwnerException
        return user
