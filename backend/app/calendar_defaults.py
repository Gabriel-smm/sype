"""Default calendar data, and the bridge from weekly blocks to calendar events.

Shared by the fresh-database seed and the `fixed_blocks_to_events` data
migration, so a new install and an upgraded one end up with the same shape.
Every helper flushes but never commits; the caller owns the transaction.
"""
import json
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta

from sqlalchemy.orm import Session

from . import models
from .recurrence import weekly_rule
from .timeutil import MINUTES_PER_DAY

PRIMARY_CALENDAR_NAME = "Sype"
DEFAULT_CATEGORIES = [("Classes", "sky"), ("Routine", "stone")]
ROUTINE_KINDS = {"sleep", "lunch"}

_CLASSES = "Classes"
_ROUTINE = "Routine"


@dataclass(frozen=True)
class WeeklyBlock:
    """The old fixed-block shape: minutes from midnight, recurring weekly or daily."""

    kind: str
    label: str
    day_of_week: int | None  # None = every day, 0 = Monday ... 6 = Sunday
    start_minute: int
    end_minute: int  # <= start_minute wraps past midnight


def ensure_primary_calendar(db: Session, student_id: int) -> models.Calendar:
    calendar = (
        db.query(models.Calendar)
        .filter_by(student_id=student_id, is_primary=True)
        .order_by(models.Calendar.id)
        .first()
    )
    if calendar is None:
        calendar = models.Calendar(
            student_id=student_id, name=PRIMARY_CALENDAR_NAME, source="local",
            is_primary=True, visible=True, color_key=models.DEFAULT_CALENDAR_COLOR, position=0,
        )
        db.add(calendar)
        db.flush()
    return calendar


def ensure_default_categories(db: Session, student_id: int) -> dict[str, models.Category]:
    existing = {
        c.name: c for c in db.query(models.Category).filter_by(student_id=student_id)
    }
    result: dict[str, models.Category] = {}
    for position, (name, color_key) in enumerate(DEFAULT_CATEGORIES):
        category = existing.get(name)
        if category is None:
            category = models.Category(
                student_id=student_id, name=name, color_key=color_key, position=position,
            )
            db.add(category)
        result[name] = category
    db.flush()
    return result


def _first_start(monday: date, days: set[int] | None, start_minute: int) -> datetime:
    """DTSTART: the first matching day on or after `monday`, at `start_minute`."""
    offset = 0 if days is None else min(days)
    return datetime.combine(monday + timedelta(days=offset), time()) + timedelta(
        minutes=start_minute
    )


def events_from_weekly_blocks(
    db: Session, student_id: int, blocks: Sequence[WeeklyBlock], *, today: date
) -> list[models.CalendarEvent]:
    """One recurring event per (kind, label, start, end) group of weekly blocks."""
    if not blocks:
        return []
    calendar = ensure_primary_calendar(db, student_id)
    categories = ensure_default_categories(db, student_id)

    # Group, keeping first-seen order. A None entry in the day set means "daily".
    groups: dict[tuple[str, str, int, int], set[int | None]] = {}
    for block in blocks:
        key = (block.kind, block.label, block.start_minute, block.end_minute)
        groups.setdefault(key, set()).add(block.day_of_week)

    # Anchor a week early: a series starting today would miss the overnight
    # instance that began last night, leaving this morning unblocked.
    monday = today - timedelta(days=today.weekday() + 7)
    events: list[models.CalendarEvent] = []
    for (kind, label, start_minute, end_minute), day_set in groups.items():
        days = None if None in day_set else {d for d in day_set if d is not None}
        start = _first_start(monday, days, start_minute)
        length = (end_minute - start_minute) % MINUTES_PER_DAY or MINUTES_PER_DAY
        if kind in ROUTINE_KINDS:
            category, event_kind = categories[_ROUTINE], "routine"
        elif kind == "class":
            category, event_kind = categories[_CLASSES], "default"
        else:
            category, event_kind = None, "default"
        event = models.CalendarEvent(
            student_id=student_id, calendar=calendar, category=category,
            title=label or kind.capitalize(), start=start,
            end=start + timedelta(minutes=length), all_day=False, transparency="opaque",
            kind=event_kind, status="confirmed",
            recurrence=json.dumps([weekly_rule(None if days is None else sorted(days))]),
        )
        db.add(event)
        events.append(event)
    db.flush()
    return events
