from __future__ import annotations

from datetime import UTC, datetime
from typing import Protocol

from app.utils.di import inject


class IClock(Protocol):
    def now(self) -> datetime: ...


@inject(alias=IClock)
class SystemClock(IClock):
    """The current time, behind a Protocol so tests can fix it (`add_to_di_container(IClock, ...)`)."""

    def now(self) -> datetime:
        return datetime.now(UTC)
