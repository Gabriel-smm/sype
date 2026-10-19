"""Calendar events as busy time: occurrence loading, busy intervals, colours, wiring."""
import json
from datetime import datetime, timedelta

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app import models
from app.calendar_defaults import ensure_default_categories, ensure_primary_calendar
from app.calendar_service import busy_intervals, effective_color, load_occurrences
from app.db import Base
from app.pipeline import generate_schedule

MONDAY = datetime(2026, 10, 19)


@pytest.fixture()
def db_session(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'events.db'}")
    Base.metadata.create_all(bind=engine)
    session = sessionmaker(bind=engine, autoflush=False)()
    try:
        session.add(models.Student(id=1, name="S"))
        session.flush()
        yield session
    finally:
        session.close()
        engine.dispose()


def _event(db: Session, start, end, *, title="Event", recurrence=(), calendar=None,
           student_id=1, **fields) -> models.CalendarEvent:
    calendar = calendar or ensure_primary_calendar(db, student_id)
    event = models.CalendarEvent(
        student_id=student_id, calendar=calendar, title=title, start=start, end=end,
        recurrence=json.dumps(list(recurrence)), **fields,
    )
    db.add(event)
    db.flush()
    return event


def _instance(db: Session, series: models.CalendarEvent, original_start, start, end,
              **fields) -> models.CalendarEvent:
    """An edited or cancelled instance row of `series`."""
    return _event(
        db, start, end, title=fields.pop("title", series.title), calendar=series.calendar,
        recurring_event_id=series.id, original_start_time=original_start, **fields,
    )


# --- load_occurrences -----------------------------------------------------------------


def test_series_expand_and_come_back_sorted_by_start(db_session):
    lunch = _event(db_session, MONDAY.replace(hour=12), MONDAY.replace(hour=13), title="Lunch",
                   recurrence=["RRULE:FREQ=DAILY"])
    talk = _event(db_session, MONDAY + timedelta(days=1, hours=9),
                  MONDAY + timedelta(days=1, hours=10), title="Talk")

    rows = load_occurrences(db_session, 1, MONDAY, MONDAY + timedelta(days=2))

    assert [(row.title, occ.start) for row, occ in rows] == [
        ("Lunch", MONDAY.replace(hour=12)),
        ("Talk", MONDAY + timedelta(days=1, hours=9)),
        ("Lunch", MONDAY + timedelta(days=1, hours=12)),
    ]
    assert rows[0][1].event_id == lunch.id and rows[1][1].event_id == talk.id


def test_cancelled_series_are_left_out(db_session):
    _event(db_session, MONDAY.replace(hour=9), MONDAY.replace(hour=10), status="cancelled")
    assert load_occurrences(db_session, 1, MONDAY, MONDAY + timedelta(days=1)) == []


def test_an_edited_instance_replaces_its_slot_and_carries_its_own_row(db_session):
    series = _event(db_session, MONDAY.replace(hour=9), MONDAY.replace(hour=10), title="Bio",
                    recurrence=["RRULE:FREQ=DAILY"])
    moved = _instance(db_session, series, MONDAY.replace(hour=9), MONDAY.replace(hour=15),
                      MONDAY.replace(hour=16), title="Bio (moved)")

    rows = load_occurrences(db_session, 1, MONDAY, MONDAY + timedelta(days=1))

    assert len(rows) == 1
    row, occ = rows[0]
    assert row.id == moved.id and row.title == "Bio (moved)"
    assert occ.event_id == series.id and occ.exception_id == moved.id
    assert (occ.start, occ.original_start) == (MONDAY.replace(hour=15), MONDAY.replace(hour=9))


def test_a_cancelled_instance_is_skipped(db_session):
    series = _event(db_session, MONDAY.replace(hour=9), MONDAY.replace(hour=10),
                    recurrence=["RRULE:FREQ=DAILY"])
    _instance(db_session, series, MONDAY.replace(hour=9), MONDAY.replace(hour=9),
              MONDAY.replace(hour=10), status="cancelled")

    rows = load_occurrences(db_session, 1, MONDAY, MONDAY + timedelta(days=2))

    assert [occ.start for _, occ in rows] == [MONDAY + timedelta(days=1, hours=9)]


def test_calendar_ids_filter_the_occurrences(db_session):
    other = models.Calendar(student_id=1, name="Club", color_key="mint")
    db_session.add(other)
    _event(db_session, MONDAY.replace(hour=9), MONDAY.replace(hour=10), title="Primary")
    _event(db_session, MONDAY.replace(hour=11), MONDAY.replace(hour=12), title="Club",
           calendar=other)

    rows = load_occurrences(db_session, 1, MONDAY, MONDAY + timedelta(days=1),
                            calendar_ids=[other.id])

    assert [row.title for row, _ in rows] == ["Club"]


def test_other_students_events_are_ignored(db_session):
    db_session.add(models.Student(id=2, name="Other"))
    db_session.flush()
    _event(db_session, MONDAY.replace(hour=9), MONDAY.replace(hour=10), student_id=2)
    assert load_occurrences(db_session, 1, MONDAY, MONDAY + timedelta(days=1)) == []


# --- busy_intervals -------------------------------------------------------------------


def test_only_busy_occurrences_count_as_busy_time(db_session):
    series = _event(db_session, MONDAY.replace(hour=9), MONDAY.replace(hour=10),
                    recurrence=["RRULE:FREQ=DAILY"])
    # Tuesday's instance was marked Free; a separate Free event never blocks either.
    _instance(db_session, series, MONDAY + timedelta(days=1, hours=9),
              MONDAY + timedelta(days=1, hours=9), MONDAY + timedelta(days=1, hours=10),
              transparency="transparent")
    _event(db_session, MONDAY.replace(hour=14), MONDAY.replace(hour=15), transparency="transparent")

    busy = busy_intervals(db_session, 1, MONDAY, MONDAY + timedelta(days=2))

    assert busy == [(MONDAY.replace(hour=9), MONDAY.replace(hour=10))]


def test_a_hidden_calendar_still_blocks(db_session):
    hidden = models.Calendar(student_id=1, name="Hidden", color_key="rose", visible=False)
    db_session.add(hidden)
    _event(db_session, MONDAY.replace(hour=9), MONDAY.replace(hour=10), calendar=hidden)

    assert busy_intervals(db_session, 1, MONDAY, MONDAY + timedelta(days=1)) == [
        (MONDAY.replace(hour=9), MONDAY.replace(hour=10)),
    ]


def test_last_nights_sleep_blocks_this_morning(db_session):
    """Review Focus 2: the window starts today, the occurrence began last night."""
    _event(db_session, MONDAY - timedelta(days=7) + timedelta(hours=23, minutes=30),
           MONDAY - timedelta(days=6) + timedelta(hours=7, minutes=30), title="Sleep",
           recurrence=["RRULE:FREQ=DAILY"])

    busy = busy_intervals(db_session, 1, MONDAY, MONDAY + timedelta(days=1))

    assert busy[0] == (MONDAY - timedelta(minutes=30), MONDAY.replace(hour=7, minute=30))


# --- effective_color ------------------------------------------------------------------


def test_effective_colour_prefers_category_then_own_then_calendar(db_session):
    calendar = ensure_primary_calendar(db_session, 1)
    classes = ensure_default_categories(db_session, 1)["Classes"]
    plain = _event(db_session, MONDAY, MONDAY + timedelta(hours=1))
    own = _event(db_session, MONDAY, MONDAY + timedelta(hours=1), color_key="rose")
    both = _event(db_session, MONDAY, MONDAY + timedelta(hours=1), color_key="rose",
                  category=classes)
    classes.color_key = "lilac"

    assert effective_color(plain) == calendar.color_key == "sky"
    assert effective_color(own) == "rose"
    assert effective_color(both) == "lilac"


# --- pipeline wiring ------------------------------------------------------------------


def _pending_task(db: Session, now: datetime) -> None:
    db.add(models.Task(student_id=1, title="Read", due_date=now + timedelta(days=5),
                       estimated_duration=60, task_type="reading"))
    db.commit()


def test_generate_schedule_cannot_place_work_inside_a_week_long_busy_event(db_session):
    now = MONDAY.replace(hour=10)
    hidden = models.Calendar(student_id=1, name="Retreat", color_key="rose", visible=False)
    db_session.add(hidden)
    _event(db_session, MONDAY, MONDAY + timedelta(days=8), calendar=hidden)
    _pending_task(db_session, now)

    result = generate_schedule(db_session, 1, now=now)

    assert result.placements == [] and result.unschedulable


def test_generate_schedule_ignores_free_and_cancelled_events(db_session):
    now = MONDAY.replace(hour=10)
    _event(db_session, MONDAY, MONDAY + timedelta(days=8), transparency="transparent")
    _event(db_session, MONDAY, MONDAY + timedelta(days=8), status="cancelled")
    _pending_task(db_session, now)

    result = generate_schedule(db_session, 1, now=now)

    assert len(result.placements) == 1 and not result.unschedulable
