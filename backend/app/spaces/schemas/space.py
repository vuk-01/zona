from __future__ import annotations

from dataclasses import dataclass
from typing import Annotated, Self

from pydantic import (
    AfterValidator,
    Field,
    StringConstraints,
    ValidationInfo,
    field_validator,
    model_validator,
)

from app.spaces.models.space import SpaceCategory, SpaceStatus
from app.utils.schemas import CamelCaseModel, CamelCaseResponseModel, UtcDatetime

# Whole hours only; "24:00" is allowed as a closing time.
_HOUR_PATTERN = r"^([01]\d|2[0-4]):00$"

# Messages that reach the client in `fieldErrors`.
_PRICE_DECIMALS = "Price can have at most 2 decimals"
_CLOSE_AFTER_OPEN = "close must be after open"
_OPEN_ONE_DAY = "The space must be open on at least one day"
_DESK_COUNT_REQUIRED = "Required for desk spaces"
_DESK_COUNT_OVER_CAPACITY = "Must not be more than the capacity"


def _at_most_two_decimals(value: float) -> float:
    if round(value, 2) != value:
        raise ValueError(_PRICE_DECIMALS)
    return value


def _is_none(value: object) -> bool:
    return value is None


SpaceName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=80)]
Description = Annotated[str, StringConstraints(max_length=500)]
City = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]
Address = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
PricePerHour = Annotated[float, Field(gt=0, le=1000), AfterValidator(_at_most_two_decimals)]
Capacity = Annotated[int, Field(ge=1, le=1000)]
DeskCount = Annotated[int, Field(ge=1, le=1000)]
ImageUrl = Annotated[
    str, StringConstraints(strip_whitespace=True, max_length=500, pattern=r"^https?://\S+$")
]
Images = Annotated[list[ImageUrl], Field(min_length=1, max_length=8)]


class DayHoursSchema(CamelCaseModel):
    open: str = Field(pattern=_HOUR_PATTERN)
    close: str = Field(pattern=_HOUR_PATTERN)

    @model_validator(mode="after")
    def _close_after_open(self) -> Self:
        # "HH:00" strings compare like the hours they stand for.
        if self.close <= self.open:
            raise ValueError(_CLOSE_AFTER_OPEN)
        return self


class OpeningHoursSchema(CamelCaseModel):
    """`null` = closed that day; local time in Europe/Podgorica."""

    mon: DayHoursSchema | None
    tue: DayHoursSchema | None
    wed: DayHoursSchema | None
    thu: DayHoursSchema | None
    fri: DayHoursSchema | None
    sat: DayHoursSchema | None
    sun: DayHoursSchema | None

    @model_validator(mode="after")
    def _open_at_least_one_day(self) -> Self:
        if all(getattr(self, day) is None for day in type(self).model_fields):
            raise ValueError(_OPEN_ONE_DAY)
        return self


class SpaceCreateRequestSchema(CamelCaseModel):
    name: SpaceName
    description: Description = ""
    category: SpaceCategory
    city: City
    address: Address
    price_per_hour: PricePerHour
    capacity: Capacity
    # Declared after category and capacity: the validator below reads both.
    desk_count: DeskCount | None = Field(default=None, validate_default=True)
    images: Images
    opening_hours: OpeningHoursSchema
    status: SpaceStatus

    @field_validator("desk_count")
    @classmethod
    def _desk_count_matches_category(cls, value: int | None, info: ValidationInfo) -> int | None:
        if info.data.get("category") != SpaceCategory.DESK:
            return None  # dropped for every other category
        if value is None:
            raise ValueError(_DESK_COUNT_REQUIRED)
        capacity = info.data.get("capacity")
        if capacity is not None and value > capacity:
            raise ValueError(_DESK_COUNT_OVER_CAPACITY)
        return value


class SpaceUpdateRequestSchema(CamelCaseModel):
    """Every field optional: PATCH changes only what the client sends (`exclude_unset`).

    Rules across fields (desk count vs. category and capacity) are checked by the service on the
    space as it looks after the change.
    """

    name: SpaceName | None = None
    description: Description | None = None
    category: SpaceCategory | None = None
    city: City | None = None
    address: Address | None = None
    price_per_hour: PricePerHour | None = None
    capacity: Capacity | None = None
    desk_count: DeskCount | None = None
    images: Images | None = None
    opening_hours: OpeningHoursSchema | None = None
    status: SpaceStatus | None = None


@dataclass
class SpaceListFilters:
    search: str = ""
    category: SpaceCategory | None = None
    city: str | None = None
    host_id: int | None = None
    status: SpaceStatus | None = None
    min_price: float | None = None
    max_price: float | None = None


class SpaceHostSchema(CamelCaseResponseModel):
    id: int
    name: str


class BookingCountsSchema(CamelCaseResponseModel):
    active: int
    pending: int


class SpaceStoredSchema(CamelCaseResponseModel):
    """What the `spaces` row holds; built from the model with `model_validate(space)`."""

    id: int
    name: str
    description: str
    category: SpaceCategory
    city: str
    address: str
    price_per_hour: float
    capacity: int
    # Left out of the JSON for non-desk spaces (docs/entities.md).
    desk_count: int | None = Field(exclude_if=_is_none)
    images: list[str]
    opening_hours: OpeningHoursSchema
    status: SpaceStatus
    host: SpaceHostSchema
    created_at: UtcDatetime


class SpaceResponseSchema(SpaceStoredSchema):
    # Computed by the service on every read, not stored. No default: always in the JSON, so
    # OpenAPI marks it required, as docs/entities.md does.
    available_desks: int | None
    # Only in the host's own list (`hostId` = own id); left out of the JSON everywhere else.
    booking_counts: BookingCountsSchema | None = Field(default=None, exclude_if=_is_none)
