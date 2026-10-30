from __future__ import annotations

import datetime as dt
from dataclasses import dataclass
from enum import StrEnum

from pydantic import Field

from app.utils.schemas import CamelCaseModel, CamelCaseResponseModel, UtcDatetime

# Ids above this overflow SQLite's 64-bit integer as a 500; bounded here they are a 422.
MAX_ID = 2**31 - 1

# `HH:mm`. A time that is not on a whole hour (10:30) has the right shape: the service answers
# it with `invalid_slot`, not `validation_error` (docs/entities.md). "24:00" is midnight, an end only.
_START_TIME = r"^([01]\d|2[0-3]):[0-5]\d$"
_END_TIME = r"^(([01]\d|2[0-3]):[0-5]\d|24:00)$"


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
    # Local wall-clock date and hours in Europe/Podgorica (ADR-022).
    date: dt.date
    start_time: str = Field(pattern=_START_TIME, examples=["10:00"])
    end_time: str = Field(pattern=_END_TIME, examples=["12:00"])


class BookingStatusChange(StrEnum):
    """What `PATCH` may set. `confirmed` comes with the space lock (ADR-023)."""

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
