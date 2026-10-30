from __future__ import annotations

from datetime import datetime
from typing import Protocol
from zoneinfo import ZoneInfo

from pydantic import ValidationError
from sqlalchemy.exc import IntegrityError

from app.auth.schemas.auth import CurrentUser
from app.spaces.exceptions.space import (
    InvalidSpaceException,
    NotAHostException,
    NotSpaceOwnerException,
    SpaceConflictException,
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
from app.utils.clock import IClock
from app.utils.di import inject
from app.utils.pagination import Page, PaginationParams

# Opening hours and booking slots are in the local time of the city the app serves.
LOCAL_TIMEZONE = ZoneInfo("Europe/Podgorica")
_WEEKDAYS = ("mon", "tue", "wed", "thu", "fri", "sat", "sun")


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
    def __init__(self, space_repository: ISpaceRepository, clock: IClock) -> None:
        self._space_repository = space_repository
        self._clock = clock

    def list(
        self,
        filters: SpaceListFilters,
        pagination_params: PaginationParams,
        current_user: CurrentUser | None,
    ) -> Page[SpaceResponseSchema]:
        viewer_id = current_user.id if current_user is not None else None
        spaces = self._space_repository.get_all(
            filters=filters, viewer_id=viewer_id, pagination_params=pagination_params
        )
        # The host's own list carries booking counts; zeros until the bookings feature exists.
        own_list = viewer_id is not None and filters.host_id == viewer_id
        booking_counts = BookingCountsSchema(active=0, pending=0) if own_list else None
        now = self._local_now()
        return Page(
            total=spaces.total,
            items=[self._to_response(space, now, booking_counts) for space in spaces.items],
            pages=spaces.pages,
        )

    def get(self, space_id: int, current_user: CurrentUser | None) -> SpaceResponseSchema:
        space = self._get_visible_or_raise(space_id, current_user)
        return self._to_response(space, self._local_now())

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
            # Every CHECK has a Pydantic twin, so only a race gets here (the host was deleted).
            raise SpaceConflictException from e
        return self._to_response(space, self._local_now())

    def update(
        self, space_id: int, data: SpaceUpdateRequestSchema, current_user: CurrentUser
    ) -> SpaceResponseSchema:
        space = self._get_owned_or_raise(space_id, current_user)
        changed = self._validate_after_change(space, data)
        for field, value in changed.model_dump().items():
            setattr(space, field, value)
        try:
            space = self._space_repository.save(space)
        except IntegrityError as e:
            raise SpaceConflictException from e
        return self._to_response(space, self._local_now())

    def delete(self, space_id: int, current_user: CurrentUser) -> None:
        space = self._get_owned_or_raise(space_id, current_user)
        # The bookings feature adds 409 space_has_active_bookings here.
        self._space_repository.delete(space)

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
        space = self._get_visible_or_raise(space_id, current_user)
        if space.host_id != current_user.id:
            raise NotSpaceOwnerException
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

    def _local_now(self) -> datetime:
        return self._clock.now().astimezone(LOCAL_TIMEZONE)

    @staticmethod
    def _to_response(
        space: Space, now: datetime, booking_counts: BookingCountsSchema | None = None
    ) -> SpaceResponseSchema:
        # dict(model) gives the validated fields as they are (no second validation of nested ones).
        stored = dict(SpaceStoredSchema.model_validate(space))
        return SpaceResponseSchema(
            **stored,
            available_desks=_available_desks(space, now),
            booking_counts=booking_counts,
        )


def _available_desks(space: Space, now: datetime) -> int | None:
    """Free desks in the current hour; `None` for non-desk spaces and while the space is closed."""
    if space.category != SpaceCategory.DESK or space.desk_count is None:
        return None
    if not _is_open(space.opening_hours, now):
        return None
    # The bookings feature subtracts the confirmed bookings that cover this hour.
    return space.desk_count


def _is_open(opening_hours: OpeningHours, now: datetime) -> bool:
    hours = opening_hours.get(_WEEKDAYS[now.weekday()])
    if hours is None:
        return False
    # Whole hours as "HH:00" compare as strings; "24:00" closes after "23:00".
    current = f"{now.hour:02d}:00"
    return hours["open"] <= current < hours["close"]
