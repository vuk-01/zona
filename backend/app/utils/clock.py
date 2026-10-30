from __future__ import annotations

from datetime import UTC, date, datetime, time, timedelta
from typing import Protocol
from zoneinfo import ZoneInfo

from app.utils.di import inject

# Opening hours and booking slots are in the local time of the city the app serves (ADR-022).
LOCAL_TIMEZONE = ZoneInfo("Europe/Podgorica")


class IClock(Protocol):
    def now(self) -> datetime: ...


@inject(alias=IClock)
class SystemClock(IClock):
    """The current time, behind a Protocol so tests can fix it (`add_to_di_container(IClock, ...)`)."""

    def now(self) -> datetime:
        return datetime.now(UTC)


def local_hour_to_utc(day: date, hour: int) -> datetime:
    """`hour`:00 on `day` in Podgorica, as UTC; `24` is the next day's 00:00.

    An hour that exists twice (the clocks go back, 2026-10-25 02:00) is its first occurrence (`fold=0`).
    """
    if hour == 24:
        day, hour = day + timedelta(days=1), 0
    return datetime.combine(day, time(hour), tzinfo=LOCAL_TIMEZONE).astimezone(UTC)


def hour_exists(day: date, hour: int) -> bool:
    """False for an hour (0-23) the clocks skip that day (they go forward, 2027-03-28 02:00)."""
    local = datetime.combine(day, time(hour), tzinfo=LOCAL_TIMEZONE)
    # A skipped wall-clock time does not survive the round trip through UTC: 02:00 comes back as 03:00.
    return local.astimezone(UTC).astimezone(LOCAL_TIMEZONE).hour == hour
