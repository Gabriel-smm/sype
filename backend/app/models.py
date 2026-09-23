"""SQLAlchemy models (Section 7 of the brief).

Durations are stored in minutes everywhere. Fixed blocks and productive
windows are weekly-recurring and stored as minutes-from-midnight; a block
whose end_minute <= start_minute wraps past midnight (e.g. sleep 23:00-07:00).
"""
from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base
from .timeutil import MINUTES_PER_DAY, utcnow

# Task types the decomposer knows about; anything else is scheduled whole.
TASK_TYPE_ESSAY = "essay_project"
TASK_TYPE_EXAM = "exam_study"
TASK_TYPE_ROUTINE = "routine"
TASK_TYPES = [
    TASK_TYPE_ESSAY, TASK_TYPE_EXAM, "reading", "problem_set", "admin", "other",
    TASK_TYPE_ROUTINE,
]

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
    recurring_tasks: Mapped[list["RecurringTask"]] = relationship(
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
    # No delete cascade: removing a RecurringTask template must not delete the
    # Task rows it already produced, only the link (see RecurringTaskInstance).
    recurring_instance: Mapped["RecurringTaskInstance | None"] = relationship(
        back_populates="task", uselist=False
    )

    @property
    def recurring_task_id(self) -> int | None:
        """None for a one-off task; the owning template's id for a materialised one."""
        return self.recurring_instance.recurring_task_id if self.recurring_instance else None


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


class RecurringTask(Base):
    """Template for a routine item that recurs weekly (gym, laundry, chores).

    Not decomposed itself - it is materialised into whole Task rows on the days
    it recurs (see RecurringTaskInstance), and those rows flow through the
    existing decompose -> score -> schedule pipeline unchanged.
    """

    __tablename__ = "recurring_tasks"

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), nullable=False)
    title: Mapped[str] = mapped_column(String, nullable=False)
    task_type: Mapped[str] = mapped_column(String, nullable=False, default=TASK_TYPE_ROUTINE)
    estimated_duration: Mapped[int] = mapped_column(Integer, nullable=False)  # minutes
    grade_weight: Mapped[float] = mapped_column(Float, default=0.0)  # percent, 0-100
    stress_rating: Mapped[int] = mapped_column(Integer, default=3)  # 1-5
    # CSV of 0=Mon..6=Sun, e.g. "0,2,4" - same stringly-encoded style as EventLog.details.
    weekdays: Mapped[str] = mapped_column(String, nullable=False)
    due_minute: Mapped[int] = mapped_column(Integer, default=MINUTES_PER_DAY - 1)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    student: Mapped[Student] = relationship(back_populates="recurring_tasks")
    instances: Mapped[list["RecurringTaskInstance"]] = relationship(
        back_populates="recurring_task", cascade="all, delete-orphan"
    )


class RecurringTaskInstance(Base):
    """Join between a RecurringTask template and the Task materialised for one
    calendar occurrence. Exists so materialisation can be idempotent per
    (template, date) without adding a column to the existing `tasks` table.
    """

    __tablename__ = "recurring_task_instances"
    __table_args__ = (
        UniqueConstraint("recurring_task_id", "occurrence_date", name="uq_recurring_instance_per_day"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    recurring_task_id: Mapped[int] = mapped_column(ForeignKey("recurring_tasks.id"), nullable=False)
    task_id: Mapped[int] = mapped_column(ForeignKey("tasks.id"), nullable=False, unique=True)
    occurrence_date: Mapped[date] = mapped_column(Date, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    recurring_task: Mapped[RecurringTask] = relationship(back_populates="instances")
    task: Mapped["Task"] = relationship(back_populates="recurring_instance")


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
