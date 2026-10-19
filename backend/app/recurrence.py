"""Calendar recurrence expansion.

Pure and DB-free (like the scheduler): turns an event, its optional RFC 5545
recurrence lines (RRULE / EXDATE / RDATE) and its edited or cancelled
instances into concrete occurrences inside a window. Datetimes are naive local
time, so a 09:00 series stays at 09:00 on the wall clock across DST changes.
"""
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime

from dateutil.rrule import rruleset, rrulestr

_ALLOWED_PREFIXES = ("RRULE:", "EXDATE:", "RDATE:")
_SUB_DAILY = ("SECONDLY", "MINUTELY", "HOURLY")
_BYDAY = ("MO", "TU", "WE", "TH", "FR", "SA", "SU")


class RecurrenceError(ValueError):
    """A recurrence line is malformed or not one of RRULE / EXDATE / RDATE."""


@dataclass(frozen=True)
class EventSpec:
    id: int
    start: datetime
    end: datetime
    recurrence: tuple[str, ...] = ()
    busy: bool = True


@dataclass(frozen=True)
class ExceptionSpec:
    """One edited or cancelled instance of a series (Google's recurringEventId model).

    Keyed by `original_start`, the instance's start before it was edited.
    """

    id: int
    original_start: datetime
    start: datetime
    end: datetime
    busy: bool = True
    cancelled: bool = False


@dataclass(frozen=True)
class Occurrence:
    event_id: int
    start: datetime
    end: datetime
    busy: bool
    original_start: datetime | None = None  # set for instances of a series
    exception_id: int | None = None


def _ruleset(lines: Sequence[str], start: datetime) -> rruleset:
    """Parse recurrence lines against a naive DTSTART; raises RecurrenceError."""
    for line in lines:
        if not line.upper().startswith(_ALLOWED_PREFIXES):
            raise RecurrenceError(f"Unsupported recurrence line: {line!r}")
        if line.upper().startswith("RRULE:") and any(
            part.strip() == f"FREQ={freq}"
            for part in line.upper()[len("RRULE:"):].split(";")
            for freq in _SUB_DAILY
        ):
            # Sype events never repeat within a day, and such rules expand very slowly.
            raise RecurrenceError(f"Recurrence must be daily or coarser: {line!r}")
    text = "DTSTART:" + start.strftime("%Y%m%dT%H%M%S") + "\n" + "\n".join(lines)
    try:
        rset = rrulestr(text, forceset=True)
        if not any(line.upper().startswith("RRULE:") for line in lines):
            rset.rdate(start)  # no rule: the first instance is DTSTART itself
        rset.after(start, inc=True)  # surfaces errors that only appear on iteration
    except (ValueError, TypeError, KeyError) as exc:
        raise RecurrenceError(str(exc)) from exc
    return rset


def validate_recurrence(lines: Sequence[str], start: datetime) -> None:
    """Raise RecurrenceError unless `lines` is a valid recurrence for `start`."""
    if lines:
        _ruleset(lines, start)


def _overlaps(start: datetime, end: datetime, window_start: datetime, window_end: datetime) -> bool:
    return start < window_end and end > window_start


def expand(
    event: EventSpec,
    exceptions: Sequence[ExceptionSpec],
    window_start: datetime,
    window_end: datetime,
) -> list[Occurrence]:
    """Occurrences of `event` overlapping [window_start, window_end), sorted by start.

    Instances that began before the window but run into it are included, so an
    overnight series still blocks the morning after.
    """
    duration = event.end - event.start
    if not event.recurrence:
        if not _overlaps(event.start, event.end, window_start, window_end):
            return []
        return [Occurrence(event.id, event.start, event.end, event.busy)]

    by_original = {ex.original_start: ex for ex in exceptions}
    rset = _ruleset(event.recurrence, event.start)
    out: list[Occurrence] = []
    for start in rset.between(window_start - duration, window_end, inc=True):
        end = start + duration
        if start in by_original or not _overlaps(start, end, window_start, window_end):
            continue  # replaced or cancelled by an exception, or outside the window
        out.append(Occurrence(event.id, start, end, event.busy, original_start=start))
    # A moved instance may sit in the window although its original slot does not.
    for ex in exceptions:
        if not ex.cancelled and _overlaps(ex.start, ex.end, window_start, window_end):
            out.append(
                Occurrence(
                    event.id, ex.start, ex.end, ex.busy,
                    original_start=ex.original_start, exception_id=ex.id,
                )
            )
    out.sort(key=lambda o: o.start)
    return out


def weekly_rule(days_of_week: Sequence[int] | None) -> str:
    """RRULE for the old weekly-block model: None = daily, else BYDAY (0=Mon..6=Sun)."""
    if days_of_week is None:
        return "RRULE:FREQ=DAILY"
    days = ",".join(_BYDAY[d] for d in sorted(set(days_of_week)))
    return f"RRULE:FREQ=WEEKLY;BYDAY={days}"
