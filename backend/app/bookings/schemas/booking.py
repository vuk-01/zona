from __future__ import annotations

import datetime as dt
import re
from dataclasses import dataclass
from enum import StrEnum
from typing import Annotated

from pydantic import BeforeValidator, Field
from pydantic_core import PydanticCustomError

from app.utils.schemas import CamelCaseModel, CamelCaseResponseModel, UtcDatetime

# Ids above this overflow SQLite's 64-bit integer as a 500; bounded here they are a 422.
MAX_ID = 2**31 - 1

# `HH:mm`. A time that is not on a whole hour (10:30) has the right shape: the service answers
# it with `invalid_slot`, not `validation_error` (docs/entities.md). "24:00" is midnight, an end only.
# [0-9], not \d: Pydantic's regex engine reads \d as any Unicode digit ("1\u0660:00").
_START_TIME = r"^([01][0-9]|2[0-3]):[0-5][0-9]$"
_END_TIME = r"^(([01][0-9]|2[0-3]):[0-5][0-9]|24:00)$"
_ISO_DATE = re.compile(r"^[0-9]{4}-[0-9]{2}-[0-9]{2}$")


def _iso_date_only(value: object) -> object:
    # Pydantic's lax date also takes a Unix timestamp (1793836800) or a datetime string. A request
    # brings a string; a `date` object only comes from Python code.
    if type(value) is dt.date:
        return value
    if not isinstance(value, str) or not _ISO_DATE.match(value):
        raise PydanticCustomError("date_format", "Use the format YYYY-MM-DD")
    return value


# `YYYY-MM-DD` only, in the body and in the `date` filter (docs/entities.md).
IsoDate = Annotated[dt.date, BeforeValidator(_iso_date_only)]


class BookingReturnedStatus(StrEnum):
    """The status as returned: the stored one, or `finished` / `expired` once the slot has ended."""

    PENDING = "pending"
    CONFIRMED = "confirmed"
    DECLINED = "declined"
    CANCELLED = "cancelled"
    FINISHED = "finished"
    EXPIRED = "expired"


class BookingCreateRequestSchema(CamelCaseModel):
    """The guest is the signed-in user (ADR-006); the request has no guest or status field."""

    space_id: int = Field(ge=1, le=MAX_ID)
    # Local wall-clock date and hours in Europe/Podgorica (ADR-022); the service checks that the
    # date is today or at most 365 days ahead, because "today" comes from `IClock`.
    date: IsoDate
    start_time: str = Field(pattern=_START_TIME, examples=["10:00"])
    end_time: str = Field(pattern=_END_TIME, examples=["12:00"])


class BookingStatusChange(StrEnum):
    """What `PATCH` may set; `confirmed` runs under the space lock (ADR-023)."""

    CONFIRMED = "confirmed"
    DECLINED = "declined"
    CANCELLED = "cancelled"


class BookingUpdateRequestSchema(CamelCaseModel):
    status: BookingStatusChange


class BookingSpaceSchema(CamelCaseResponseModel):
    id: int
    name: str
    address: str
    host_id: int


class BookingGuestSchema(CamelCaseResponseModel):
    id: int
    name: str
    avatar_url: str | None


@dataclass
class BookingListFilters:
    space_id: int | None = None
    # Only the signed-in user's own id; the service checks both (docs/entities.md).
    guest_id: int | None = None
    host_id: int | None = None
    # The status as returned, so `finished` and `expired` can be asked for.
    status: BookingReturnedStatus | None = None
    date: dt.date | None = None


class BookingResponseSchema(CamelCaseResponseModel):
    """Built by the service from the model: hours become `HH:00`, the status is the returned one."""

    id: int
    space_id: int
    space: BookingSpaceSchema
    guest: BookingGuestSchema
    date: dt.date
    start_time: str
    end_time: str
    total_price: float
    status: BookingReturnedStatus
    created_at: UtcDatetime


# Popular times cover the local hours 08:00-21:00, one value per hour (docs/entities.md).
POPULAR_FIRST_HOUR = 8
POPULAR_HOURS = 14


class PopularDaysSchema(CamelCaseModel):
    """0-100 per hour from `firstHour`; `null` for a day the space is closed."""

    mon: list[int] | None
    tue: list[int] | None
    wed: list[int] | None
    thu: list[int] | None
    fri: list[int] | None
    sat: list[int] | None
    sun: list[int] | None


class PopularTimesResponseSchema(CamelCaseModel):
    first_hour: int = POPULAR_FIRST_HOUR
    days: PopularDaysSchema
