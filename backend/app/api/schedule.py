"""Schedule generation and retrieval."""
import json
from datetime import datetime, timedelta

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..db import get_db
from ..pipeline import generate_schedule, log_event
from ..scheduler import DEFAULT_HORIZON_DAYS

router = APIRouter(prefix="/api/students/{student_id}/schedule", tags=["schedule"])


def _slot_out(slot: models.ScheduledSlot, now: datetime) -> dict:
    if slot.subtask is not None:
        title = slot.subtask.title
        parent = slot.subtask.parent_task
        due = slot.subtask.due_by
        requires_focus = slot.subtask.requires_focus
        parent_title, task_type, task_id = parent.title, parent.task_type, parent.id
        recurring = parent.recurring_task_id is not None
    else:
        task = slot.task
        title, parent_title, due = task.title, None, task.due_date
        task_type, task_id = task.task_type, task.id
        requires_focus = task.task_type in (models.TASK_TYPE_ESSAY, models.TASK_TYPE_EXAM)
        recurring = task.recurring_task_id is not None

    return {
        "id": slot.id,
        "task_id": task_id,
        "subtask_id": slot.subtask_id,
        "title": title,
        "parent_title": parent_title,
        "task_type": task_type,
        "start_time": slot.start_time,
        "end_time": slot.end_time,
        "in_productive_hours": slot.in_productive_hours,
        "requires_focus": requires_focus,
        "recurring": recurring,
        "priority_score": slot.priority_score,
        "due_date": due,
        "overdue": due <= now,
    }


def _read_schedule(db: Session, student_id: int, horizon_days: int, now: datetime) -> dict:
    slots = (
        db.query(models.ScheduledSlot)
        .filter(models.ScheduledSlot.student_id == student_id)
        .order_by(models.ScheduledSlot.start_time)
        .all()
    )
    generated_at = min((s.generated_at for s in slots), default=now)

    # Surface the misses recorded by the most recent generation run.
    latest_run = (
        db.query(models.EventLog)
        .filter(
            models.EventLog.student_id == student_id,
            models.EventLog.event_type == "unschedulable",
        )
        .order_by(models.EventLog.timestamp.desc(), models.EventLog.id.desc())
        .first()
    )
    unschedulable = []
    if latest_run is not None:
        misses = (
            db.query(models.EventLog)
            .filter(
                models.EventLog.student_id == student_id,
                models.EventLog.event_type == "unschedulable",
                models.EventLog.timestamp == latest_run.timestamp,
            )
            .all()
        )
        for miss in misses:
            payload = json.loads(miss.details or "{}")
            subtask = db.get(models.Subtask, miss.subtask_id) if miss.subtask_id else None
            task = db.get(models.Task, miss.task_id) if miss.task_id else None
            if subtask is None and task is None:
                continue
            unschedulable.append(
                {
                    "task_id": miss.task_id,
                    "subtask_id": miss.subtask_id,
                    "title": subtask.title if subtask else task.title,
                    "priority_score": payload.get("score", 0.0),
                    "estimated_duration": (
                        subtask.estimated_duration if subtask else task.estimated_duration
                    ),
                    "due_date": subtask.due_by if subtask else task.due_date,
                    "reason": payload.get("reason", ""),
                }
            )

    return {
        "horizon_start": now,
        "horizon_end": now.replace(hour=0, minute=0, second=0, microsecond=0)
        + timedelta(days=horizon_days),
        "generated_at": generated_at,
        "slots": [_slot_out(s, now) for s in slots],
        "unschedulable": unschedulable,
    }


@router.get("", response_model=schemas.ScheduleOut)
def get_schedule(
    student_id: int, horizon_days: int = DEFAULT_HORIZON_DAYS, db: Session = Depends(get_db)
):
    """Return the stored plan without recomputing it."""
    if db.get(models.Student, student_id) is None:
        raise HTTPException(404, f"No student {student_id}")
    return _read_schedule(db, student_id, horizon_days, datetime.now())


@router.post("/generate", response_model=schemas.ScheduleOut)
def post_generate(
    student_id: int,
    horizon_days: int = DEFAULT_HORIZON_DAYS,
    db: Session = Depends(get_db),
):
    """Run the full pipeline: decompose -> score -> schedule -> persist."""
    now = datetime.now().replace(second=0, microsecond=0)
    try:
        generate_schedule(db, student_id, now=now, horizon_days=horizon_days)
    except ValueError as exc:
        raise HTTPException(404, str(exc)) from exc
    return _read_schedule(db, student_id, horizon_days, now)


@router.post("/slots/{slot_id}/reschedule", response_model=schemas.ScheduleOut)
def reschedule_slot(
    student_id: int,
    slot_id: int,
    start_time: datetime = Body(..., embed=True),
    end_time: datetime = Body(..., embed=True),
    horizon_days: int = DEFAULT_HORIZON_DAYS,
    db: Session = Depends(get_db),
):
    """Student dragged a block to a new time. Logged as training data."""
    slot = db.get(models.ScheduledSlot, slot_id)
    if slot is None or slot.student_id != student_id:
        raise HTTPException(404, "No such slot")
    if end_time <= start_time:
        raise HTTPException(422, "end_time must be after start_time")

    previous = {"start": slot.start_time.isoformat(), "end": slot.end_time.isoformat()}
    slot.start_time = start_time
    slot.end_time = end_time
    db.commit()
    log_event(
        db, student_id, "rescheduled", task_id=slot.task_id, subtask_id=slot.subtask_id,
        details={"from": previous, "to": {"start": start_time.isoformat(),
                                          "end": end_time.isoformat()}},
    )
    return _read_schedule(db, student_id, horizon_days, datetime.now())
