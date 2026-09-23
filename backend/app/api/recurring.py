"""CRUD for recurring task templates, plus the materialisation trigger."""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..db import get_db
from ..pipeline import materialize_recurring_tasks
from ..timeutil import format_hhmm, parse_hhmm

router = APIRouter(prefix="/api", tags=["recurring"])


def _get_student(db: Session, student_id: int) -> models.Student:
    student = db.get(models.Student, student_id)
    if student is None:
        raise HTTPException(404, f"No student {student_id}")
    return student


def _get_recurring_task(db: Session, recurring_task_id: int) -> models.RecurringTask:
    row = db.get(models.RecurringTask, recurring_task_id)
    if row is None:
        raise HTTPException(404, f"No recurring task {recurring_task_id}")
    return row


def _recurring_out(row: models.RecurringTask) -> dict:
    return {
        "id": row.id,
        "student_id": row.student_id,
        "title": row.title,
        "task_type": row.task_type,
        "estimated_duration": row.estimated_duration,
        "grade_weight": row.grade_weight,
        "stress_rating": row.stress_rating,
        "weekdays": sorted(int(d) for d in row.weekdays.split(",") if d != ""),
        "due_time": format_hhmm(row.due_minute),
        "active": row.active,
    }


@router.get("/students/{student_id}/recurring-tasks", response_model=list[schemas.RecurringTaskOut])
def list_recurring_tasks(student_id: int, db: Session = Depends(get_db)):
    _get_student(db, student_id)
    rows = (
        db.query(models.RecurringTask)
        .filter(models.RecurringTask.student_id == student_id)
        .order_by(models.RecurringTask.title)
        .all()
    )
    return [_recurring_out(r) for r in rows]


@router.post(
    "/students/{student_id}/recurring-tasks", response_model=schemas.RecurringTaskOut, status_code=201
)
def create_recurring_task(
    student_id: int, payload: schemas.RecurringTaskCreate, db: Session = Depends(get_db)
):
    _get_student(db, student_id)
    row = models.RecurringTask(
        student_id=student_id,
        title=payload.title,
        task_type=payload.task_type,
        estimated_duration=payload.estimated_duration,
        grade_weight=payload.grade_weight,
        stress_rating=payload.stress_rating,
        weekdays=",".join(str(d) for d in payload.weekdays),
        due_minute=parse_hhmm(payload.due_time),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    materialize_recurring_tasks(db, student_id, datetime.now().replace(second=0, microsecond=0))
    return _recurring_out(row)


@router.get("/recurring-tasks/{recurring_task_id}", response_model=schemas.RecurringTaskOut)
def get_recurring_task(recurring_task_id: int, db: Session = Depends(get_db)):
    return _recurring_out(_get_recurring_task(db, recurring_task_id))


@router.patch("/recurring-tasks/{recurring_task_id}", response_model=schemas.RecurringTaskOut)
def update_recurring_task(
    recurring_task_id: int, payload: schemas.RecurringTaskUpdate, db: Session = Depends(get_db)
):
    row = _get_recurring_task(db, recurring_task_id)
    changes = payload.model_dump(exclude_unset=True)

    if "weekdays" in changes:
        changes["weekdays"] = ",".join(str(d) for d in changes["weekdays"])
    if "due_time" in changes:
        changes["due_minute"] = parse_hhmm(changes.pop("due_time"))

    for field, value in changes.items():
        setattr(row, field, value)
    db.commit()
    db.refresh(row)

    if row.active:
        materialize_recurring_tasks(
            db, row.student_id, datetime.now().replace(second=0, microsecond=0)
        )
    return _recurring_out(row)


@router.delete("/recurring-tasks/{recurring_task_id}", status_code=204)
def delete_recurring_task(recurring_task_id: int, db: Session = Depends(get_db)):
    row = _get_recurring_task(db, recurring_task_id)
    db.delete(row)
    db.commit()
