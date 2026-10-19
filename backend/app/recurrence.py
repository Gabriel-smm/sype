"""Calendar recurrence expansion.

Pure and DB-free (like the scheduler): turns an event, its optional RFC 5545
recurrence lines (RRULE / EXDATE / RDATE) and its edited or cancelled
instances into concrete occurrences inside a window. Datetimes are naive local
time, so a 09:00 series stays at 09:00 on the wall clock across DST changes.
"""
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime, timedelta

from dateutil.rrule import rrule, rruleset, rrulestr

_ALLOWED_PREFIXES = ("RRULE:", "EXDATE:", "RDATE:")
_SUB_DAILY = ("SECONDLY", "MINUTELY", "HOURLY")
_INTRA_DAY_PARTS = frozenset({"BYHOUR", "BYMINUTE", "BYSECOND"})
_BYDAY = ("MO", "TU", "WE", "TH", "FR", "SA", "SU")
_PROBE_SPAN = timedelta(days=5 * 365 + 2)  # 5 years, leap days included
_PROBE_LAST_YEAR = 9993  # leaves the probe span below dateutil's MAXYEAR (9999)
MAX_LINES = 100  # bounds the number of items (RRULE lines count too)
MAX_DATE_VALUES = 1000  # bounds EXDATE + RDATE values in total, comma-separated ones included
MIN_SERIES_YEAR = 1970  # bounds how far expansion has to walk from DTSTART


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


def _rrule_parts(line: str) -> dict[str, str]:
    """`RRULE:FREQ=DAILY;INTERVAL=2` -> {"FREQ": "DAILY", "INTERVAL": "2"} (keys upper-cased)."""
    parts: dict[str, str] = {}
    for part in line[len("RRULE:"):].split(";"):
        key, _, value = part.partition("=")
        parts[key.strip().upper()] = value.strip()
    return parts


def _check_line(line: str) -> None:
    """Cheap static checks that keep expansion fast and finite."""
    if any(c.isspace() or not c.isprintable() for c in line):
        # rrulestr re-splits the joined text on whitespace: one item must be one line.
        raise RecurrenceError(
            f"Recurrence lines may not contain spaces or control characters: {line!r}"
        )
    if not line.upper().startswith(_ALLOWED_PREFIXES):
        raise RecurrenceError(f"Unsupported recurrence line: {line!r}")
    if not line.upper().startswith("RRULE:"):
        return
    parts = _rrule_parts(line)
    if parts.get("FREQ", "").upper() in _SUB_DAILY or _INTRA_DAY_PARTS & parts.keys():
        # Sype events never repeat within a day, and such rules expand very slowly.
        raise RecurrenceError(f"Recurrence must be daily or coarser: {line!r}")
    if "BYEASTER" in parts:
        raise RecurrenceError(f"BYEASTER is not part of RFC 5545: {line!r}")
    if "INTERVAL" in parts:
        try:
            interval = int(parts["INTERVAL"])
        except ValueError:
            raise RecurrenceError(f"INTERVAL must be a whole number: {line!r}") from None
        if interval < 1:
            # dateutil accepts INTERVAL=0 and then never advances: an endless loop.
            raise RecurrenceError(f"INTERVAL must be at least 1: {line!r}")


def _ruleset(lines: Sequence[str], start: datetime) -> rruleset:
    """Parse recurrence lines against a naive DTSTART; raises RecurrenceError.

    Parsing is cheap; nothing here iterates the rules.
    """
    if len(lines) > MAX_LINES:
        raise RecurrenceError(f"At most {MAX_LINES} recurrence lines are allowed")
    if start.year < MIN_SERIES_YEAR:
        raise RecurrenceError(f"A recurring event must start in {MIN_SERIES_YEAR} or later")
    for line in lines:
        _check_line(line)
    date_values = sum(
        len(line.split(":", 1)[1].split(","))
        for line in lines
        if line.upper().startswith(("EXDATE:", "RDATE:"))
    )
    if date_values > MAX_DATE_VALUES:
        raise RecurrenceError(f"At most {MAX_DATE_VALUES} EXDATE/RDATE values are allowed")
    text = "DTSTART:" + start.strftime("%Y%m%dT%H%M%S") + "\n" + "\n".join(lines)
    try:
        rset = rrulestr(text, forceset=True)
    except (ValueError, TypeError, KeyError) as exc:
        raise RecurrenceError(str(exc)) from exc
    if not any(line.upper().startswith("RRULE:") for line in lines):
        rset.rdate(start)  # no rule: the first instance is DTSTART itself
    return rset


def _gregorian_twin(dt: datetime) -> datetime:
    """`dt` moved by whole 400-year Gregorian cycles to a year in [9594, 9993].

    The calendar repeats exactly every 400 years (146,097 days, a whole number of
    weeks), so a rule's instances shift with it. Near year 9999 dateutil's scan
    for the next match gives up after at most ~400 years instead of ~8,000.
    """
    year = _PROBE_LAST_YEAR - (_PROBE_LAST_YEAR - dt.year) % 400
    return dt.replace(year=year)


def _probe_first_occurrence(line: str, start: datetime) -> None:
    """Raise RecurrenceError unless the RRULE has an instance within 5 years of `start`.

    dateutil keeps scanning to year 9999 when a rule never matches (Feb 30), even
    past UNTIL or COUNT, so the probe runs on the rule's 400-year twin instead.
    """
    try:
        rule = rrulestr(line, dtstart=start)
        if not isinstance(rule, rrule):
            raise RecurrenceError(f"One recurrence line must hold one rule: {line!r}")
        twin_start = _gregorian_twin(start)
        until = rule._until  # noqa: SLF001 - dateutil has no public accessor
        twin_until = None
        if until is not None:
            if until < start:
                raise RecurrenceError(f"Recurrence has no occurrence: {line!r}")
            if until < start + _PROBE_SPAN:
                twin_until = twin_start + (until - start)
        twin = rule.replace(dtstart=twin_start, until=twin_until)
        first = next(iter(twin), None)
    except RecurrenceError:
        raise
    except (ValueError, TypeError, KeyError, OverflowError) as exc:
        raise RecurrenceError(str(exc)) from exc
    if first is None or first - twin_start >= _PROBE_SPAN:
        raise RecurrenceError(
            f"Recurrence has no occurrence within 5 years of the start: {line!r}"
        )


def validate_recurrence(lines: Sequence[str], start: datetime) -> None:
    """Raise RecurrenceError unless `lines` is a valid recurrence for `start`.

    Every RRULE must produce an instance within 5 years of `start`; that also
    rules out never-matching rules, which would make each expansion scan to 9999.
    """
    if not lines:
        return
    rset = _ruleset(lines, start)
    for line in lines:
        if line.upper().startswith("RRULE:"):
            _probe_first_occurrence(line, start)
    # Bounded now that every RRULE has an early instance; surfaces errors that
    # only appear on iteration, such as a timezone-aware EXDATE/RDATE value.
    try:
        rset.after(start, inc=True)
    except (ValueError, TypeError, KeyError, OverflowError) as exc:
        raise RecurrenceError(str(exc)) from exc


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
    # Static checks only: the first-occurrence probe ran when the event was written.
    rset = _ruleset(event.recurrence, event.start)
    try:
        starts = rset.between(window_start - duration, window_end, inc=True)
    except (ValueError, TypeError, KeyError, OverflowError) as exc:
        raise RecurrenceError(str(exc)) from exc
    out: list[Occurrence] = []
    for start in starts:
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
