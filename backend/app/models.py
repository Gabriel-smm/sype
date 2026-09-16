"""SQLAlchemy models (Section 7 of the brief).

Durations are stored in minutes everywhere. Fixed blocks and productive
windows are weekly-recurring and stored as minutes-from-midnight; a block
whose end_minute <= start_minute wraps past midnight (e.g. sleep 23:00-07:00).
"""
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base
from .timeutil import utcnow

# Task types the decomposer knows about; anything else is scheduled whole.
TASK_TYPE_ESSAY = "essay_project"
TASK_TYPE_EXAM = "exam_study"
TASK_TYPES = [TASK_TYPE_ESSAY, TASK_TYPE_EXAM, "reading", "problem_set", "admin", "other"]

STATUS_PENDING = "pending"
STATUS_DONE = "done"
STATUS_SKIPPED = "skipped"

BLOCK_KINDS = ["sleep", "lunch", "class", "other"]

EVENT_TYPES = ["rescheduled", "skipped", "completed", "created", "scheduled", "unschedulable"]


class Student(Base):
    __tablename__ = "students"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)

    fixed_blocks: Mapped[list["FixedBlock"]] = relationship(
        back_populates="student", cascade="all, delete-orphan"
    )
    productive_hours: Mapped[list["ProductiveWindow"]] = relationship(
        back_populates="student", cascade="all, delete-orphan"
    )
    tasks: Mapped[list["Task"]] = relationship(
        back_populates="student", cascade="all, delete-orphan"
    )
    weights: Mapped["Weights"] = relationship(
        back_populates="student", cascade="all, delete-orphan", uselist=False
    )


class FixedBlock(Base):
    """Sleep / lunch / class time that the scheduler must never touch."""

    __tablename__ = "fixed_blocks"

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), nullable=False)
    kind: Mapped[str] = mapped_column(String, nullable=False)
    label: Mapped[str] = mapped_column(String, default="")
    # None = applies to every day of the week. 0 = Monday ... 6 = Sunday.
    day_of_week: Mapped[int | None] = mapped_column(Integer, nullable=True)
    start_minute: Mapped[int] = mapped_column(Integer, nullable=False)
    end_minute: Mapped[int] = mapped_column(Integer, nullable=False)

    student: Mapped[Student] = relationship(back_populates="fixed_blocks")


class ProductiveWindow(Base):
    """Self-reported window where the student focuses well."""

    __tablename__ = "productive_windows"

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), nullable=False)
    label: Mapped[str] = mapped_column(String, default="")
    day_of_week: Mapped[int | None] = mapped_column(Integer, nullable=True)
    start_minute: Mapped[int] = mapped_column(Integer, nullable=False)
    end_minute: Mapped[int] = mapped_column(Integer, nullable=False)

    student: Mapped[Student] = relationship(back_populates="productive_hours")


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), nullable=False)
    title: Mapped[str] = mapped_column(String, nullable=False)
    due_date: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    estimated_duration: Mapped[int] = mapped_column(Integer, nullable=False)  # minutes
    task_type: Mapped[str] = mapped_column(String, nullable=False, default="other")
    grade_weight: Mapped[float] = mapped_column(Float, default=0.0)  # percent, 0-100
    stress_rating: Mapped[int] = mapped_column(Integer, default=3)  # 1-5
    time_invested: Mapped[int] = mapped_column(Integer, default=0)  # minutes
    status: Mapped[str] = mapped_column(String, default=STATUS_PENDING)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    student: Mapped[Student] = relationship(back_populates="tasks")
    subtasks: Mapped[list["Subtask"]] = relationship(
        back_populates="parent_task", cascade="all, delete-orphan", order_by="Subtask.order_index"
    )
    slots: Mapped[list["ScheduledSlot"]] = relationship(
        back_populates="task", cascade="all, delete-orphan"
    )


class Subtask(Base):
    __tablename__ = "subtasks"

    id: Mapped[int] = mapped_column(primary_key=True)
    parent_task_id: Mapped[int] = mapped_column(ForeignKey("tasks.id"), nullable=False)
    title: Mapped[str] = mapped_column(String, nullable=False)
    due_by: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    estimated_duration: Mapped[int] = mapped_column(Integer, nullable=False)  # minutes
    time_invested: Mapped[int] = mapped_column(Integer, default=0)
    phase: Mapped[str] = mapped_column(String, default="")
    requires_focus: Mapped[bool] = mapped_column(Boolean, default=False)
    order_index: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String, default=STATUS_PENDING)

    parent_task: Mapped[Task] = relationship(back_populates="subtasks")
    slots: Mapped[list["ScheduledSlot"]] = relationship(
        back_populates="subtask", cascade="all, delete-orphan"
    )


class ScheduledSlot(Base):
    """A placed block of work. Exactly one of task_id / subtask_id is set."""

    __tablename__ = "scheduled_slots"

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), nullable=False)
    task_id: Mapped[int | None] = mapped_column(ForeignKey("tasks.id"), nullable=True)
    subtask_id: Mapped[int | None] = mapped_column(ForeignKey("subtasks.id"), nullable=True)
    start_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    end_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    in_productive_hours: Mapped[bool] = mapped_column(Boolean, default=False)
    priority_score: Mapped[float] = mapped_column(Float, default=0.0)
    generated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    task: Mapped[Task | None] = relationship(back_populates="slots")
    subtask: Mapped[Subtask | None] = relationship(back_populates="slots")


class EventLog(Base):
    """Append-only behavioural log. Nothing reads it yet - it is training data."""

    __tablename__ = "event_log"

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), nullable=False)
    task_id: Mapped[int | None] = mapped_column(ForeignKey("tasks.id"), nullable=True)
    subtask_id: Mapped[int | None] = mapped_column(ForeignKey("subtasks.id"), nullable=True)
    event_type: Mapped[str] = mapped_column(String, nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    details: Mapped[str] = mapped_column(String, default="")  # JSON blob


class Weights(Base):
    __tablename__ = "weights"

    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), primary_key=True)
    w_urgency: Mapped[float] = mapped_column(Float, default=0.4)
    w_grade: Mapped[float] = mapped_column(Float, default=0.3)
    w_stress: Mapped[float] = mapped_column(Float, default=0.15)
    w_effort_gap: Mapped[float] = mapped_column(Float, default=0.15)

    student: Mapped[Student] = relationship(back_populates="weights")
