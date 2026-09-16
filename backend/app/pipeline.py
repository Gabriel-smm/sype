"""Glue layer: DB rows -> decomposition -> scoring -> scheduling -> DB rows.

All the decisions live in scoring.py / decompose.py / scheduler.py; this module
only translates between those pure functions and SQLAlchemy.
"""
import json
from datetime import datetime

from sqlalchemy.orm import Session

from . import models
from .decompose import decompose
from .scheduler import (
    DEFAULT_HORIZON_DAYS,
    BlockSpec,
    ScheduleResult,
    build_free_slots,
    schedule,
)
from .scoring import ScorableTask, Weights, days_until
from .timeutil import utcnow

# Task types that always demand a productive-hour slot when scheduled whole.
FOCUS_TASK_TYPES = {models.TASK_TYPE_ESSAY, models.TASK_TYPE_EXAM}


def get_weights(db: Session, student_id: int) -> Weights:
    row = db.get(models.Weights, student_id)
    if row is None:
        row = models.Weights(student_id=student_id)
        db.add(row)
        db.commit()
    return Weights(row.w_urgency, row.w_grade, row.w_stress, row.w_effort_gap)


def _block_specs(rows) -> list[BlockSpec]:
    return [
        BlockSpec(
            start_minute=r.start_minute,
            end_minute=r.end_minute,
            day_of_week=r.day_of_week,
            kind=getattr(r, "kind", "productive"),
            label=r.label or "",
        )
        for r in rows
    ]


def apply_decomposition(db: Session, task: models.Task, now: datetime) -> list[models.Subtask]:
    """(Re)build a task's subtasks from the rules. Returns the new subtasks."""
    for existing in list(task.subtasks):
        db.delete(existing)
    task.subtasks.clear()

    specs = decompose(
        title=task.title,
        task_type=task.task_type,
        due_date=task.due_date,
        estimated_duration=task.estimated_duration,
        now=now,
    )
    created = []
    for spec in specs:
        subtask = models.Subtask(
            parent_task_id=task.id,
            title=spec.title,
            due_by=spec.due_by,
            estimated_duration=spec.estimated_duration,
            phase=spec.phase,
            requires_focus=spec.requires_focus,
            order_index=spec.order_index,
        )
        db.add(subtask)
        created.append(subtask)
    db.flush()
    return created


def collect_scorable(db: Session, student_id: int, now: datetime) -> list[ScorableTask]:
    """Flatten pending tasks (or their pending subtasks) into scorable items.

    A decomposed task is represented by its subtasks only - never both, or the
    work would be double-counted on the calendar.
    """
    tasks = (
        db.query(models.Task)
        .filter(models.Task.student_id == student_id, models.Task.status == models.STATUS_PENDING)
        .all()
    )

    items: list[ScorableTask] = []
    for task in tasks:
        pending_subtasks = sorted(
            (s for s in task.subtasks if s.status == models.STATUS_PENDING),
            key=lambda s: s.order_index,
        )
        if pending_subtasks:
            # Phases run in order: you cannot revise a draft you have not written.
            previous_id: str | None = None
            for subtask in pending_subtasks:
                item_id = f"sub-{subtask.id}"
                predecessors = [previous_id] if previous_id else []
                previous_id = item_id
                items.append(
                    ScorableTask(
                        id=item_id,
                        title=subtask.title,
                        days_until_due=days_until(subtask.due_by, now),
                        # Subtasks inherit the parent's grade stake and stress.
                        grade_weight=task.grade_weight,
                        stress_rating=task.stress_rating,
                        estimated_duration=subtask.estimated_duration,
                        time_invested=subtask.time_invested,
                        requires_focus=subtask.requires_focus,
                        due_date=subtask.due_by,
                        task_id=task.id,
                        subtask_id=subtask.id,
                        predecessor_ids=predecessors,
                    )
                )
        else:
            items.append(
                ScorableTask(
                    id=f"task-{task.id}",
                    title=task.title,
                    days_until_due=days_until(task.due_date, now),
                    grade_weight=task.grade_weight,
                    stress_rating=task.stress_rating,
                    estimated_duration=task.estimated_duration,
                    time_invested=task.time_invested,
                    requires_focus=task.task_type in FOCUS_TASK_TYPES,
                    due_date=task.due_date,
                    task_id=task.id,
                )
            )
    return items


def generate_schedule(
    db: Session,
    student_id: int,
    *,
    now: datetime | None = None,
    horizon_days: int = DEFAULT_HORIZON_DAYS,
) -> ScheduleResult:
    """Regenerate the student's whole week and persist the result."""
    now = now or datetime.now().replace(second=0, microsecond=0)

    student = db.get(models.Student, student_id)
    if student is None:
        raise ValueError(f"no student {student_id}")

    weights = get_weights(db, student_id)
    slots = build_free_slots(
        _block_specs(student.fixed_blocks),
        _block_specs(student.productive_hours),
        now=now,
        horizon_days=horizon_days,
    )
    items = collect_scorable(db, student_id, now)
    result = schedule(items, weights, slots, now=now, horizon_days=horizon_days)

    # Replace the previous plan wholesale - the schedule is derived state.
    db.query(models.ScheduledSlot).filter(
        models.ScheduledSlot.student_id == student_id
    ).delete(synchronize_session=False)

    generated_at = utcnow()
    for placement in result.placements:
        db.add(
            models.ScheduledSlot(
                student_id=student_id,
                task_id=placement.item.task_id if placement.item.subtask_id is None else None,
                subtask_id=placement.item.subtask_id,
                start_time=placement.start,
                end_time=placement.end,
                in_productive_hours=placement.is_productive,
                priority_score=placement.score,
                generated_at=generated_at,
            )
        )

    for miss in result.unschedulable:
        db.add(
            models.EventLog(
                student_id=student_id,
                task_id=miss.item.task_id,
                subtask_id=miss.item.subtask_id,
                event_type="unschedulable",
                details=json.dumps({"reason": miss.reason, "score": round(miss.score, 4)}),
            )
        )

    db.commit()
    return result


def log_event(
    db: Session,
    student_id: int,
    event_type: str,
    *,
    task_id: int | None = None,
    subtask_id: int | None = None,
    details: dict | None = None,
) -> models.EventLog:
    """Append to the behavioural log. Nothing reads this yet - it is future
    training data, so it is written even when no feature depends on it."""
    entry = models.EventLog(
        student_id=student_id,
        task_id=task_id,
        subtask_id=subtask_id,
        event_type=event_type,
        details=json.dumps(details or {}),
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry
