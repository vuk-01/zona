from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime
from typing import Protocol

from pydantic import ValidationError
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm.exc import StaleDataError

from app.auth.exceptions.auth import InvalidTokenException, NotAuthenticatedException
from app.auth.schemas.auth import CurrentUser
from app.bookings.repositories.booking import IBookingRepository
from app.spaces.exceptions.space import (
    InvalidSpaceException,
    NotAHostException,
    NotOwnFavoritesException,
    NotSpaceOwnerException,
    SpaceHasActiveBookingsException,
    SpaceNotFoundException,
)
from app.spaces.models.space import OpeningHours, Space, SpaceCategory, SpaceStatus
from app.spaces.repositories.space import ISpaceRepository
from app.spaces.schemas.space import (
    BookingCountsSchema,
    SpaceCreateRequestSchema,
    SpaceListFilters,
    SpaceResponseSchema,
    SpaceStoredSchema,
    SpaceUpdateRequestSchema,
)
from app.users.repositories.user import IUserRepository
from app.utils.clock import LOCAL_TIMEZONE, WEEKDAYS, IClock
from app.utils.di import inject
from app.utils.pagination import Page, PaginationParams


class ISpaceService(Protocol):
    def list(
        self,
        filters: SpaceListFilters,
        pagination_params: PaginationParams,
        current_user: CurrentUser | None,
    ) -> Page[SpaceResponseSchema]: ...

    def get(self, space_id: int, current_user: CurrentUser | None) -> SpaceResponseSchema: ...

    def create(
        self, data: SpaceCreateRequestSchema, current_user: CurrentUser
    ) -> SpaceResponseSchema: ...

    def update(
        self, space_id: int, data: SpaceUpdateRequestSchema, current_user: CurrentUser
    ) -> SpaceResponseSchema: ...

    def delete(self, space_id: int, current_user: CurrentUser) -> None: ...


@inject(alias=ISpaceService)
class SpaceService(ISpaceService):
    def __init__(
        self,
        space_repository: ISpaceRepository,
        booking_repository: IBookingRepository,
        user_repository: IUserRepository,
        clock: IClock,
    ) -> None:
        self._space_repository = space_repository
        # Another domain through its Protocol (ADR-020): bookings counts its own rows (ADR-027).
        self._booking_repository = booking_repository
        self._user_repository = user_repository
        self._clock = clock

    def list(
        self,
        filters: SpaceListFilters,
        pagination_params: PaginationParams,
        current_user: CurrentUser | None,
    ) -> Page[SpaceResponseSchema]:
        if filters.favorite_of is not None:
            # Favorites are private: only with a token, and only the user's own (docs/entities.md).
            if current_user is None:
                raise NotAuthenticatedException
            if filters.favorite_of != current_user.id:
                raise NotOwnFavoritesException
        viewer_id = current_user.id if current_user is not None else None
        spaces = self._space_repository.get_all(
            filters=filters, viewer_id=viewer_id, pagination_params=pagination_params
        )
        # Only the host's own list carries booking counts (docs/entities.md).
        own_list = viewer_id is not None and filters.host_id == viewer_id
        return Page(
            total=spaces.total,
            items=self._to_responses(spaces.items, with_booking_counts=own_list),
            pages=spaces.pages,
        )

    def get(self, space_id: int, current_user: CurrentUser | None) -> SpaceResponseSchema:
        space = self._get_visible_or_raise(space_id, current_user)
        return self._to_response(space)

    def create(
        self, data: SpaceCreateRequestSchema, current_user: CurrentUser
    ) -> SpaceResponseSchema:
        if not current_user.is_host:
            raise NotAHostException
        # The host is always the signed-in user, never an id from the request body (ADR-006).
        space = Space(**data.model_dump(), host_id=current_user.id)
        try:
            space = self._space_repository.add(space)
        except IntegrityError as e:
            # Every CHECK has a Pydantic twin; what is left is the host_id foreign key, refused when
            # the host's account was deleted during the request. Their token is then invalid.
            if not self._user_repository.exists(current_user.id):
                raise InvalidTokenException from e
            raise  # the host exists: a rule Pydantic lets through, a bug, not a client error
        return self._to_response(space)

    def update(
        self, space_id: int, data: SpaceUpdateRequestSchema, current_user: CurrentUser
    ) -> SpaceResponseSchema:
        space = self._get_owned_or_raise(space_id, current_user)
        changed = self._validate_after_change(space, data)
        for field, value in changed.model_dump().items():
            setattr(space, field, value)
        try:
            space = self._space_repository.save(space)
        except StaleDataError as e:
            # The row vanished after it was read (deleted by its host or with the host's account).
            raise SpaceNotFoundException from e
        return self._to_response(space)

    def delete(self, space_id: int, current_user: CurrentUser) -> None:
        # Only the host may delete, and anyone else is refused before the lock, so they never hold
        # the space (on SQLite the whole database). The host never changes; the status only picks
        # 404 or 403 for someone else, never what the rule below depends on (ADR-026).
        owner = self._space_repository.get_owner(space_id)
        if owner is None:
            raise SpaceNotFoundException
        _raise_unless_owner(*owner, current_user=current_user)
        # The lock comes before the count, so no booking is created or confirmed between the count
        # and the DELETE, which would delete that booking with the space (ADR-025).
        if self._space_repository.lock(space_id) is None:
            raise SpaceNotFoundException  # deleted by a parallel request after the check
        active, _ = self._booking_repository.booking_counts(
            space_ids=[space_id], now=self._clock.now()
        ).get(space_id, (0, 0))
        if active:
            raise SpaceHasActiveBookingsException(active)
        if not self._space_repository.delete(space_id):
            # Never under the lock; read as a vanished row all the same, never assumed away.
            raise SpaceNotFoundException

    def _get_visible_or_raise(self, space_id: int, current_user: CurrentUser | None) -> Space:
        space = self._space_repository.get_by_id(space_id)
        if space is None:
            raise SpaceNotFoundException
        # Someone else's draft does not exist for the viewer: 404, not 403.
        is_host = current_user is not None and space.host_id == current_user.id
        if space.status == SpaceStatus.DRAFT and not is_host:
            raise SpaceNotFoundException
        return space

    def _get_owned_or_raise(self, space_id: int, current_user: CurrentUser) -> Space:
        space = self._space_repository.get_by_id(space_id)
        if space is None:
            raise SpaceNotFoundException
        _raise_unless_owner(space.host_id, space.status, current_user=current_user)
        return space

    @staticmethod
    def _validate_after_change(
        space: Space, data: SpaceUpdateRequestSchema
    ) -> SpaceCreateRequestSchema:
        """The space as it looks after the PATCH, held to the same rules as a new one."""
        # Keyed by alias (camelCase): error locations repeat the input's keys, and the client
        # expects `fieldErrors` in camelCase (ADR-010).
        current = {
            info.alias or field: getattr(space, field)
            for field, info in SpaceCreateRequestSchema.model_fields.items()
        }
        try:
            return SpaceCreateRequestSchema.model_validate(
                current | data.model_dump(exclude_unset=True, by_alias=True)
            )
        except ValidationError as e:
            field_errors: dict[str, str] = {}
            for error in e.errors():
                field = ".".join(str(part) for part in error["loc"]) or "body"
                field_errors.setdefault(field, error["msg"])
            raise InvalidSpaceException(field_errors=field_errors) from e

    def _to_response(self, space: Space) -> SpaceResponseSchema:
        (response,) = self._to_responses([space])
        return response

    def _to_responses(
        self, spaces: Sequence[Space], with_booking_counts: bool = False
    ) -> Sequence[SpaceResponseSchema]:
        """The spaces with the fields computed from bookings: one query per field for the whole
        page, never one per space (ADR-027)."""
        now = self._clock.now()
        local_now = now.astimezone(LOCAL_TIMEZONE)
        # Only desk spaces open right now have free desks; the others are `null` without a query.
        taken = self._booking_repository.confirmed_at(
            space_ids=[space.id for space in spaces if _desk_count_now(space, local_now)],
            day=local_now.date(),
            hour=local_now.hour,
        )
        if not with_booking_counts:
            return [_response(space, local_now, taken) for space in spaces]
        counts = self._booking_repository.booking_counts(
            space_ids=[space.id for space in spaces], now=now
        )
        return [
            _response(space, local_now, taken, counts.get(space.id, (0, 0))) for space in spaces
        ]


def _response(
    space: Space,
    local_now: datetime,
    taken: dict[int, int],
    booking_counts: tuple[int, int] | None = None,
) -> SpaceResponseSchema:
    """`taken`: confirmed bookings per space in this hour; `booking_counts`: `(active, pending)`."""
    desk_count = _desk_count_now(space, local_now)
    # dict(model) gives the validated fields as they are (no second validation of nested ones).
    stored = dict(SpaceStoredSchema.model_validate(space))
    return SpaceResponseSchema(
        **stored,
        # A PATCH may still lower deskCount below this hour's confirmed bookings
        # (docs/follow-ups.md), so the count never goes below 0.
        available_desks=(
            max(desk_count - taken.get(space.id, 0), 0) if desk_count is not None else None
        ),
        booking_counts=(
            BookingCountsSchema(active=booking_counts[0], pending=booking_counts[1])
            if booking_counts is not None
            else None
        ),
    )


def _raise_unless_owner(host_id: int, status: str, current_user: CurrentUser) -> None:
    if host_id == current_user.id:
        return
    # Someone else's draft does not exist for the viewer: 404, not 403.
    if status == SpaceStatus.DRAFT:
        raise SpaceNotFoundException
    raise NotSpaceOwnerException


def _desk_count_now(space: Space, local_now: datetime) -> int | None:
    """The desk count of a desk space that is open at `local_now`; `None` for any other space."""
    if space.category != SpaceCategory.DESK or space.desk_count is None:
        return None
    if not _is_open(space.opening_hours, local_now):
        return None
    return space.desk_count


def _is_open(opening_hours: OpeningHours, now: datetime) -> bool:
    hours = opening_hours.get(WEEKDAYS[now.weekday()])
    if hours is None:
        return False
    # Whole hours as "HH:00" compare as strings; "24:00" closes after "23:00".
    current = f"{now.hour:02d}:00"
    return hours["open"] <= current < hours["close"]
