"""Calendar events read side: expand rows into occurrences, and derive busy time.

The DB-facing companion to `recurrence.py`: it loads a student's series rows and
their edited/cancelled instance rows, hands them to the pure `expand`, and
pairs each occurrence with the row whose details it shows (the instance row for
an edited instance, otherwise the series row). The scheduler only ever sees the
plain `(start, end)` busy intervals.
"""
import logging
from collections import defaultdict
from collections.abc import Sequence
from datetime import datetime

from sqlalchemy.orm import Session

from . import models
from .recurrence import EventSpec, ExceptionSpec, Occurrence, RecurrenceError, expand

logger = logging.getLogger(__name__)

STATUS_CANCELLED = "cancelled"
BUSY = "opaque"


def _event_spec(row: models.CalendarEvent) -> EventSpec:
    return EventSpec(
        id=row.id, start=row.start, end=row.end,
        recurrence=tuple(row.recurrence_lines), busy=row.transparency == BUSY,
    )


def _exception_spec(row: models.CalendarEvent) -> ExceptionSpec:
    return ExceptionSpec(
        id=row.id, original_start=row.original_start_time, start=row.start, end=row.end,
        busy=row.transparency == BUSY, cancelled=row.status == STATUS_CANCELLED,
    )


def load_occurrences(
    db: Session,
    student_id: int,
    start: datetime,
    end: datetime,
    *,
    calendar_ids: Sequence[int] | None = None,
) -> list[tuple[models.CalendarEvent, Occurrence]]:
    """Every occurrence overlapping [start, end), paired with its row, sorted by start.

    Cancelled series are left out entirely; a cancelled instance removes just
    that occurrence. Hidden calendars are included: `visible` is display-only.
    A series whose stored recurrence no longer validates is skipped with a warning.
    """
    query = db.query(models.CalendarEvent).filter(
        models.CalendarEvent.student_id == student_id,
        models.CalendarEvent.recurring_event_id.is_(None),
        models.CalendarEvent.status != STATUS_CANCELLED,
    )
    if calendar_ids is not None:
        query = query.filter(models.CalendarEvent.calendar_id.in_(list(calendar_ids)))
    series = query.order_by(models.CalendarEvent.id).all()
    if not series:
        return []

    instances: dict[int, list[models.CalendarEvent]] = defaultdict(list)
    for row in db.query(models.CalendarEvent).filter(
        models.CalendarEvent.recurring_event_id.in_([s.id for s in series])
    ).order_by(models.CalendarEvent.id):
        instances[row.recurring_event_id].append(row)

    out: list[tuple[models.CalendarEvent, Occurrence]] = []
    for row in series:
        own = instances.get(row.id, [])
        by_id = {r.id: r for r in own}
        try:
            occurrences = expand(_event_spec(row), [_exception_spec(r) for r in own], start, end)
        except RecurrenceError as exc:
            # One bad stored series must not take down the calendar or scheduling.
            logger.warning("Skipping calendar event %s: bad recurrence (%s)", row.id, exc)
            continue
        for occurrence in occurrences:
            out.append((by_id.get(occurrence.exception_id, row), occurrence))
    out.sort(key=lambda pair: (pair[1].start, pair[1].event_id))
    return out


def busy_intervals(
    db: Session, student_id: int, start: datetime, end: datetime
) -> list[tuple[datetime, datetime]]:
    """Busy `(start, end)` intervals from every calendar, visible or hidden."""
    return [
        (occurrence.start, occurrence.end)
        for _, occurrence in load_occurrences(db, student_id, start, end)
        if occurrence.busy
    ]


def effective_color(event: models.CalendarEvent) -> str:
    """The category's colour if set, else the event's own, else its calendar's."""
    if event.category is not None:
        return event.category.color_key
    return event.color_key or event.calendar.color_key
