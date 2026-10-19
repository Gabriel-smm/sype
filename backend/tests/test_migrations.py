"""Upgrading an existing SQLite database in place: new columns, fixed blocks -> events."""
import json
from datetime import date, datetime, timedelta

import pytest
from sqlalchemy import Column, Integer, MetaData, String, Table, create_engine, inspect, text
from sqlalchemy.orm import Session, sessionmaker

from app import models, seed
from app.calendar_defaults import WeeklyBlock, events_from_weekly_blocks
from app.db import Base
from app.migrations import add_missing_columns, run_data_migrations
from app.models import Calendar, CalendarEvent, Category, FixedBlock, SchemaMigration

# The `tasks` / `recurring_tasks` columns as they were before calendar events existed.
OLD_TASKS_DDL = """
CREATE TABLE tasks (
    id INTEGER NOT NULL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES students (id),
    title VARCHAR NOT NULL,
    due_date DATETIME NOT NULL,
    estimated_duration INTEGER NOT NULL,
    task_type VARCHAR NOT NULL,
    grade_weight FLOAT,
    stress_rating INTEGER,
    time_invested INTEGER,
    status VARCHAR,
    created_at DATETIME
)
"""
OLD_RECURRING_TASKS_DDL = """
CREATE TABLE recurring_tasks (
    id INTEGER NOT NULL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES students (id),
    title VARCHAR NOT NULL,
    task_type VARCHAR NOT NULL,
    estimated_duration INTEGER NOT NULL,
    grade_weight FLOAT,
    stress_rating INTEGER,
    weekdays VARCHAR NOT NULL,
    due_minute INTEGER,
    active BOOLEAN,
    created_at DATETIME
)
"""
OLD_STUDENTS_DDL = "CREATE TABLE students (id INTEGER NOT NULL PRIMARY KEY, name VARCHAR NOT NULL)"
OLD_FIXED_BLOCKS_DDL = """
CREATE TABLE fixed_blocks (
    id INTEGER NOT NULL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES students (id),
    kind VARCHAR NOT NULL,
    label VARCHAR,
    day_of_week INTEGER,
    start_minute INTEGER NOT NULL,
    end_minute INTEGER NOT NULL
)
"""


def _engine(tmp_path, name="old.db"):
    return create_engine(f"sqlite:///{tmp_path / name}")


def _columns(engine, table):
    return {c["name"] for c in inspect(engine).get_columns(table)}


@pytest.fixture()
def db_session(tmp_path):
    engine = _engine(tmp_path, "fresh.db")
    Base.metadata.create_all(bind=engine)
    session = sessionmaker(bind=engine, autoflush=False)()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


def _student_with_blocks(db: Session) -> models.Student:
    student = models.Student(id=1, name="Old Student")
    db.add(student)
    db.flush()
    for kind, label, day, start, end in [
        ("sleep", "Sleep", None, 23 * 60 + 30, 7 * 60 + 30),
        ("class", "Bio 101", 0, 9 * 60, 10 * 60 + 15),
        ("class", "Bio 101", 2, 9 * 60, 10 * 60 + 15),
        ("lunch", "Lunch", None, 12 * 60, 13 * 60),
    ]:
        db.add(FixedBlock(student_id=student.id, kind=kind, label=label, day_of_week=day,
                          start_minute=start, end_minute=end))
    db.commit()
    return student


# --- add_missing_columns -------------------------------------------------------------


def test_add_missing_columns_adds_new_nullable_columns(tmp_path):
    engine = _engine(tmp_path)
    with engine.begin() as conn:
        conn.execute(text(OLD_STUDENTS_DDL))
        conn.execute(text(OLD_TASKS_DDL))
        conn.execute(text(OLD_RECURRING_TASKS_DDL))
        conn.execute(text("INSERT INTO students (id, name) VALUES (1, 'S')"))
        conn.execute(text(
            "INSERT INTO tasks (id, student_id, title, due_date, estimated_duration, task_type)"
            " VALUES (7, 1, 'Old task', '2026-10-20 12:00:00', 60, 'other')"
        ))

    added = add_missing_columns(engine)

    assert "tasks.category_id" in added and "tasks.color_key" in added
    assert "recurring_tasks.category_id" in added
    assert {"category_id", "color_key"} <= _columns(engine, "tasks")
    with engine.connect() as conn:
        row = conn.execute(text("SELECT title, category_id, color_key FROM tasks")).one()
    assert tuple(row) == ("Old task", None, None)  # existing rows survive, new cols NULL
    assert add_missing_columns(engine) == []  # idempotent


def test_add_missing_columns_skips_tables_that_do_not_exist(tmp_path):
    engine = _engine(tmp_path)
    assert add_missing_columns(engine) == []  # nothing to alter; create_all handles new tables


def test_add_missing_columns_refuses_not_null_without_default(tmp_path):
    engine = _engine(tmp_path)
    with engine.begin() as conn:
        conn.execute(text("CREATE TABLE widgets (id INTEGER PRIMARY KEY)"))
    metadata = MetaData()
    Table("widgets", metadata,
          Column("id", Integer, primary_key=True),
          Column("size", String, nullable=False))

    with pytest.raises(RuntimeError, match="widgets.size"):
        add_missing_columns(engine, metadata)
    assert _columns(engine, "widgets") == {"id"}


def test_add_missing_columns_accepts_not_null_with_server_default(tmp_path):
    engine = _engine(tmp_path)
    with engine.begin() as conn:
        conn.execute(text("CREATE TABLE widgets (id INTEGER PRIMARY KEY)"))
        conn.execute(text("INSERT INTO widgets (id) VALUES (1)"))
    metadata = MetaData()
    Table("widgets", metadata,
          Column("id", Integer, primary_key=True),
          Column("size", String, nullable=False, server_default="small"))

    assert add_missing_columns(engine, metadata) == ["widgets.size"]
    with engine.connect() as conn:
        assert conn.execute(text("SELECT size FROM widgets")).scalar_one() == "small"


# --- events_from_weekly_blocks --------------------------------------------------------


def test_weekly_blocks_start_on_the_first_matching_day_of_the_current_week(db_session):
    db_session.add(models.Student(id=1, name="S"))
    db_session.flush()
    today = date(2026, 10, 18)  # a Sunday; that week's Monday is 2026-10-12
    events = events_from_weekly_blocks(db_session, 1, [
        WeeklyBlock("class", "Stats 210", 1, 13 * 60 + 30, 15 * 60),
        WeeklyBlock("class", "Stats 210", 3, 13 * 60 + 30, 15 * 60),
        WeeklyBlock("sleep", "Sleep", None, 23 * 60 + 30, 7 * 60 + 30),
        WeeklyBlock("other", "Club", 5, 18 * 60, 18 * 60),
    ], today=today)

    stats, sleep, club = events
    assert stats.start == datetime(2026, 10, 13, 13, 30)  # Tuesday
    assert stats.end == datetime(2026, 10, 13, 15, 0)
    assert stats.recurrence_lines == ["RRULE:FREQ=WEEKLY;BYDAY=TU,TH"]
    assert stats.category.name == "Classes"
    assert sleep.start == datetime(2026, 10, 12, 23, 30)  # daily: the Monday
    assert sleep.end == datetime(2026, 10, 13, 7, 30)  # overnight wraps
    assert sleep.recurrence_lines == ["RRULE:FREQ=DAILY"]
    assert sleep.category.name == "Routine" and sleep.kind == "routine"
    assert club.category_id is None and club.kind == "default"
    assert club.end - club.start == timedelta(hours=24)  # end == start means a full day
    assert all(e.transparency == "opaque" and e.status == "confirmed" for e in events)
    assert {e.calendar.is_primary for e in events} == {True}


def test_a_group_with_any_daily_block_becomes_daily(db_session):
    db_session.add(models.Student(id=1, name="S"))
    db_session.flush()
    events = events_from_weekly_blocks(db_session, 1, [
        WeeklyBlock("lunch", "Lunch", 2, 12 * 60, 13 * 60),
        WeeklyBlock("lunch", "Lunch", None, 12 * 60, 13 * 60),
    ], today=date(2026, 10, 18))
    assert len(events) == 1 and events[0].recurrence_lines == ["RRULE:FREQ=DAILY"]


# --- data migrations ------------------------------------------------------------------


def test_fixed_blocks_become_grouped_recurring_events(db_session):
    _student_with_blocks(db_session)

    run_data_migrations(db_session)

    events = db_session.query(CalendarEvent).all()
    assert len(events) == 3
    bio = next(e for e in events if e.title == "Bio 101")
    assert bio.recurrence_lines == ["RRULE:FREQ=WEEKLY;BYDAY=MO,WE"] and bio.kind == "default"
    sleep = next(e for e in events if e.title == "Sleep")
    assert sleep.kind == "routine" and (sleep.end - sleep.start) == timedelta(hours=8)
    assert {c.name for c in db_session.query(Category)} == {"Classes", "Routine"}
    assert db_session.query(Calendar).filter_by(is_primary=True).count() == 1
    assert db_session.query(FixedBlock).count() == 4  # legacy rows stay untouched


def test_data_migrations_run_once(db_session):
    _student_with_blocks(db_session)

    assert run_data_migrations(db_session) == ["fixed_blocks_to_events"]
    count = db_session.query(CalendarEvent).count()
    assert run_data_migrations(db_session) == []
    assert db_session.query(CalendarEvent).count() == count
    assert [m.name for m in db_session.query(SchemaMigration)] == ["fixed_blocks_to_events"]


def test_migration_gives_a_student_without_blocks_a_primary_calendar(db_session):
    db_session.add(models.Student(id=1, name="S"))
    db_session.commit()
    run_data_migrations(db_session)
    assert db_session.query(Calendar).filter_by(is_primary=True).count() == 1
    assert db_session.query(CalendarEvent).count() == 0


# --- bootstrap ------------------------------------------------------------------------


def test_bootstrap_on_a_fresh_db_seeds_events_not_fixed_blocks(client):
    from app.db import SessionLocal

    db = SessionLocal()
    try:
        assert db.query(FixedBlock).count() == 0
        events = db.query(CalendarEvent).all()
        assert sorted(e.title for e in events) == [
            "Bio 101", "Lunch", "Sleep", "Stats 210", "Writing Seminar",
        ]
        assert db.query(Calendar).filter_by(is_primary=True).count() == 1
        assert [m.name for m in db.query(SchemaMigration)] == ["fixed_blocks_to_events"]
    finally:
        db.close()


def test_bootstrap_upgrades_an_existing_db_exactly_once(tmp_path, monkeypatch):
    engine = _engine(tmp_path)
    with engine.begin() as conn:
        for ddl in (OLD_STUDENTS_DDL, OLD_FIXED_BLOCKS_DDL, OLD_TASKS_DDL,
                    OLD_RECURRING_TASKS_DDL):
            conn.execute(text(ddl))
        conn.execute(text("INSERT INTO students (id, name) VALUES (1, 'Old Student')"))
        for i, (kind, label, day, start, end) in enumerate(seed.DEFAULT_FIXED_BLOCKS, 1):
            conn.execute(text(
                "INSERT INTO fixed_blocks (id, student_id, kind, label, day_of_week,"
                " start_minute, end_minute) VALUES (:i, 1, :k, :l, :d, :s, :e)"
            ), {"i": i, "k": kind, "l": label, "d": day,
                "s": int(start[:2]) * 60 + int(start[3:]), "e": int(end[:2]) * 60 + int(end[3:])})
        conn.execute(text(
            "INSERT INTO tasks (id, student_id, title, due_date, estimated_duration, task_type)"
            " VALUES (7, 1, 'Old task', '2026-10-20 12:00:00', 60, 'other')"
        ))
    monkeypatch.setattr(seed, "engine", engine)
    monkeypatch.setattr(seed, "SessionLocal", sessionmaker(bind=engine, autoflush=False))

    seed.bootstrap()

    assert {"category_id", "color_key"} <= _columns(engine, "tasks")
    assert "category_id" in _columns(engine, "recurring_tasks")
    db = seed.SessionLocal()
    try:
        assert db.get(models.Student, 1).name == "Old Student"  # not re-seeded
        assert db.get(models.Task, 7).title == "Old task"
        assert db.query(FixedBlock).count() == len(seed.DEFAULT_FIXED_BLOCKS)
        events = db.query(CalendarEvent).all()
        assert len(events) == 5
        assert all(json.loads(e.recurrence) for e in events)
        snapshot = sorted((e.title, e.start, e.end, e.recurrence) for e in events)
        counts = (db.query(Calendar).count(), db.query(Category).count())
    finally:
        db.close()

    seed.bootstrap()  # a second start must create nothing new

    db = seed.SessionLocal()
    try:
        events = db.query(CalendarEvent).all()
        assert sorted((e.title, e.start, e.end, e.recurrence) for e in events) == snapshot
        assert (db.query(Calendar).count(), db.query(Category).count()) == counts
    finally:
        db.close()
    engine.dispose()
