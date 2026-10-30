from __future__ import annotations

from datetime import UTC, date, datetime

import pytest

from app.utils.clock import hour_exists, local_hour_to_utc

# Europe/Podgorica: CET (+01:00) in winter, CEST (+02:00) in summer.
# 2026-10-25: the clocks go back at 03:00 CEST to 02:00 CET, so 02:00-03:00 happens twice.
# 2027-03-28: the clocks go forward at 02:00 CET to 03:00 CEST, so 02:00-03:00 does not exist.


@pytest.mark.parametrize(
    ("day", "hour", "expected"),
    [
        (date(2026, 7, 1), 10, datetime(2026, 7, 1, 8, tzinfo=UTC)),  # summer, +02:00
        (date(2026, 12, 1), 10, datetime(2026, 12, 1, 9, tzinfo=UTC)),  # winter, +01:00
        # 24:00 is the next day's 00:00, in that day's offset.
        (date(2026, 7, 1), 24, datetime(2026, 7, 1, 22, tzinfo=UTC)),
        (date(2026, 10, 30), 24, datetime(2026, 10, 30, 23, tzinfo=UTC)),
        # The day the clocks go back: 02:00 is its first occurrence (still CEST).
        (date(2026, 10, 25), 1, datetime(2026, 10, 24, 23, tzinfo=UTC)),
        (date(2026, 10, 25), 2, datetime(2026, 10, 25, 0, tzinfo=UTC)),
        (date(2026, 10, 25), 3, datetime(2026, 10, 25, 2, tzinfo=UTC)),
        # The day the clocks go forward: 01:00 is CET, 03:00 already CEST.
        (date(2027, 3, 28), 1, datetime(2027, 3, 28, 0, tzinfo=UTC)),
        (date(2027, 3, 28), 3, datetime(2027, 3, 28, 1, tzinfo=UTC)),
    ],
)
def test_local_hour_to_utc(day: date, hour: int, expected: datetime) -> None:
    result = local_hour_to_utc(day, hour)

    assert result == expected
    assert result.tzinfo is UTC


@pytest.mark.parametrize(
    ("day", "hour", "expected"),
    [
        (date(2027, 3, 28), 1, True),
        (date(2027, 3, 28), 2, False),  # skipped: the clocks jump from 02:00 to 03:00
        (date(2027, 3, 28), 3, True),
        (date(2026, 10, 25), 2, True),  # happens twice, but exists
        (date(2026, 10, 25), 3, True),
        (date(2026, 7, 1), 0, True),
        (date(2026, 7, 1), 23, True),
    ],
)
def test_hour_exists(day: date, hour: int, expected: bool) -> None:
    assert hour_exists(day, hour) is expected
