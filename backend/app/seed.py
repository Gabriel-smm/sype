"""Seed the single test student described in the MVP brief.

No auth for this MVP: every request operates on student 1 unless told otherwise.
"""
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from . import models
from .db import Base, SessionLocal, engine
from .timeutil import parse_hhmm

DEFAULT_STUDENT_ID = 1

DEFAULT_FIXED_BLOCKS = [
    ("sleep", "Sleep", None, "23:30", "07:30"),
    ("lunch", "Lunch", None, "12:00", "13:00"),
    ("class", "Bio 101", 0, "09:00", "10:15"),
    ("class", "Bio 101", 2, "09:00", "10:15"),
    ("class", "Stats 210", 1, "13:30", "15:00"),
    ("class", "Stats 210", 3, "13:30", "15:00"),
    ("class", "Writing Seminar", 4, "10:30", "12:00"),
]

DEFAULT_PRODUCTIVE_WINDOWS = [
    ("Mid-morning", None, "08:00", "09:00"),
    ("Late afternoon", None, "15:30", "18:00"),
    ("Evening", None, "20:00", "22:30"),
]


def ensure_schema() -> None:
    Base.metadata.create_all(bind=engine)


def seed_student(db: Session) -> models.Student:
    """Idempotent: creates student 1 with a default week if absent."""
    student = db.get(models.Student, DEFAULT_STUDENT_ID)
    if student is not None:
        return student

    student = models.Student(id=DEFAULT_STUDENT_ID, name="Test Student")
    db.add(student)
    db.flush()

    for kind, label, day, start, end in DEFAULT_FIXED_BLOCKS:
        db.add(models.FixedBlock(
            student_id=student.id, kind=kind, label=label, day_of_week=day,
            start_minute=parse_hhmm(start), end_minute=parse_hhmm(end),
        ))
    for label, day, start, end in DEFAULT_PRODUCTIVE_WINDOWS:
        db.add(models.ProductiveWindow(
            student_id=student.id, label=label, day_of_week=day,
            start_minute=parse_hhmm(start), end_minute=parse_hhmm(end),
        ))
    db.add(models.Weights(student_id=student.id))
    db.commit()
    db.refresh(student)
    return student


def seed_sample_tasks(db: Session, student_id: int = DEFAULT_STUDENT_ID) -> None:
    """Optional demo data, so the calendar is not empty on first run."""
    if db.query(models.Task).filter(models.Task.student_id == student_id).count():
        return

    from .pipeline import apply_decomposition

    now = datetime.now().replace(minute=0, second=0, microsecond=0)
    samples = [
        ("Ethics paper", "essay_project", 11, 600, 35, 4),
        ("Bio 101 midterm", "exam_study", 13, 480, 25, 5),
        ("Stats problem set 6", "problem_set", 3, 120, 10, 3),
        ("Read Ch. 7-9", "reading", 5, 90, 5, 2),
        ("Register for spring classes", "admin", 2, 30, 0, 3),
    ]
    for title, task_type, days, minutes, grade, stress in samples:
        task = models.Task(
            student_id=student_id, title=title, task_type=task_type,
            due_date=now + timedelta(days=days), estimated_duration=minutes,
            grade_weight=grade, stress_rating=stress,
        )
        db.add(task)
        db.flush()
        apply_decomposition(db, task, now)
    db.commit()


def bootstrap(with_samples: bool = False) -> None:
    ensure_schema()
    db = SessionLocal()
    try:
        seed_student(db)
        if with_samples:
            seed_sample_tasks(db)
    finally:
        db.close()
