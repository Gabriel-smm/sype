"""Helpers for the minutes-from-midnight representation used by fixed blocks."""
from datetime import UTC, datetime, timedelta

MINUTES_PER_DAY = 24 * 60


def parse_hhmm(value: str) -> int:
    """'07:30' -> 450. Accepts '24:00' as end-of-day."""
    hours, _, minutes = value.strip().partition(":")
    h, m = int(hours), int(minutes)
    total = h * 60 + m
    if not 0 <= total <= MINUTES_PER_DAY:
        raise ValueError(f"time out of range: {value}")
    return total


def format_hhmm(minutes: int) -> str:
    return f"{minutes // 60:02d}:{minutes % 60:02d}"


def day_start(moment: datetime) -> datetime:
    return moment.replace(hour=0, minute=0, second=0, microsecond=0)


def at_minute(day: datetime, minute_of_day: int) -> datetime:
    """Absolute datetime for a minute offset into `day` (handles 24:00)."""
    return day_start(day) + timedelta(minutes=minute_of_day)


def utcnow() -> datetime:
    """Naive UTC timestamp, matching the DateTime columns (which are naive)."""
    return datetime.now(UTC).replace(tzinfo=None)
