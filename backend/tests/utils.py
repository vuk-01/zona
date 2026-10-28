from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from pydantic_settings import SettingsConfigDict

from app.auth.schemas.auth import CurrentUser
from app.config.settings import Settings
from app.utils.clock import IClock


class TestSettings(Settings):
    """Settings for tests: never reads `.env`, so a developer's local config cannot leak in."""

    model_config = SettingsConfigDict(env_file=None, use_enum_values=True, extra="allow")


class FixedClock(IClock):
    """A clock that always says the same time: `add_to_di_container(IClock, FixedClock(...))`."""

    def __init__(self, now: datetime) -> None:
        self._now = now

    def now(self) -> datetime:
        return self._now


def create_current_user(
    id: int = 1, email: str = "test@example.com", is_host: bool = False
) -> CurrentUser:
    return CurrentUser(
        id=id,
        email=email,
        display_name="Test User",
        is_host=is_host,
        created_at=datetime(2026, 1, 1, tzinfo=UTC),
    )


WEEKDAY_HOURS = {"open": "08:00", "close": "20:00"}


def space_body(**changes: Any) -> dict[str, Any]:
    """A valid `POST /api/spaces` body: a listed desk space, open 08:00-20:00 Monday to Friday."""
    body: dict[str, Any] = {
        "name": "Hub Morača Coworking",
        "category": "desk",
        "city": "Podgorica",
        "address": "Bulevar Svetog Petra Cetinjskog 9",
        "pricePerHour": 3,
        "capacity": 24,
        "deskCount": 20,
        "images": ["https://example.com/hub.jpg"],
        "openingHours": {
            "mon": WEEKDAY_HOURS,
            "tue": WEEKDAY_HOURS,
            "wed": WEEKDAY_HOURS,
            "thu": WEEKDAY_HOURS,
            "fri": WEEKDAY_HOURS,
            "sat": None,
            "sun": None,
        },
        "status": "listed",
    }
    return body | changes
