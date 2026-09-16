"""Task CRUD plus the student-facing actions that produce log events."""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..db import get_db
from ..pipeline import apply_decomposition, log_event

router = APIRouter(prefix="/api", tags=["tasks"])

# Task fields that change the shape of the work and so invalidate subtasks.
DECOMPOSITION_FIELDS = {"task_type", "estimated_duration", "due_date", "title"}


def _get_task(db: Session, task_id: int) -> models.Task:
    task = db.get(models.Task, task_id)
    if task is None:
        raise HTTPException(404, f"No task {task_id}")
    return task


@router.get("/students/{student_id}/tasks", response_model=list[schemas.TaskOut])
def list_tasks(student_id: int, status: str | None = None, db: Session = Depends(get_db)):
    query = db.query(models.Task).filter(models.Task.student_id == student_id)
    if status:
        query = query.filter(models.Task.status == status)
    return query.order_by(models.Task.due_date).all()


@router.post("/students/{student_id}/tasks", response_model=schemas.TaskOut, status_code=201)
def create_task(student_id: int, payload: schemas.TaskCreate, db: Session = Depends(get_db)):
    if db.get(models.Student, student_id) is None:
        raise HTTPException(404, f"No student {student_id}")

    task = models.Task(student_id=student_id, **payload.model_dump())
    db.add(task)
    db.flush()
    apply_decomposition(db, task, datetime.now())
    db.commit()
    db.refresh(task)
    log_event(db, student_id, "created", task_id=task.id, details={"title": task.title})
    return task


@router.get("/tasks/{task_id}", response_model=schemas.TaskOut)
def get_task(task_id: int, db: Session = Depends(get_db)):
    return _get_task(db, task_id)


@router.patch("/tasks/{task_id}", response_model=schemas.TaskOut)
def update_task(task_id: int, payload: schemas.TaskUpdate, db: Session = Depends(get_db)):
    task = _get_task(db, task_id)
    changes = payload.model_dump(exclude_unset=True)

    if "task_type" in changes and changes["task_type"] not in models.TASK_TYPES:
        raise HTTPException(422, f"task_type must be one of {models.TASK_TYPES}")

    for field, value in changes.items():
        setattr(task, field, value)
    db.flush()

    # Re-derive subtasks only when something structural moved.
    if DECOMPOSITION_FIELDS & changes.keys():
        apply_decomposition(db, task, datetime.now())

    db.commit()
    db.refresh(task)
    return task


@router.delete("/tasks/{task_id}", status_code=204)
def delete_task(task_id: int, db: Session = Depends(get_db)):
    task = _get_task(db, task_id)
    db.delete(task)
    db.commit()


@router.post("/tasks/{task_id}/complete", response_model=schemas.TaskOut)
def complete_task(task_id: int, db: Session = Depends(get_db)):
    task = _get_task(db, task_id)
    task.status = models.STATUS_DONE
    task.time_invested = max(task.time_invested, task.estimated_duration)
    for subtask in task.subtasks:
        if subtask.status == models.STATUS_PENDING:
            subtask.status = models.STATUS_DONE
    db.query(models.ScheduledSlot).filter(models.ScheduledSlot.task_id == task_id).delete(
        synchronize_session=False
    )
    db.commit()
    log_event(db, task.student_id, "completed", task_id=task.id)
    db.refresh(task)
    return task


@router.post("/subtasks/{subtask_id}/complete", response_model=schemas.SubtaskOut)
def complete_subtask(subtask_id: int, db: Session = Depends(get_db)):
    subtask = db.get(models.Subtask, subtask_id)
    if subtask is None:
        raise HTTPException(404, f"No subtask {subtask_id}")
    subtask.status = models.STATUS_DONE
    subtask.time_invested = max(subtask.time_invested, subtask.estimated_duration)

    task = subtask.parent_task
    task.time_invested = sum(s.time_invested for s in task.subtasks)
    if all(s.status != models.STATUS_PENDING for s in task.subtasks):
        task.status = models.STATUS_DONE

    db.query(models.ScheduledSlot).filter(
        models.ScheduledSlot.subtask_id == subtask_id
    ).delete(synchronize_session=False)
    db.commit()
    log_event(
        db, task.student_id, "completed", task_id=task.id, subtask_id=subtask.id,
        details={"phase": subtask.phase},
    )
    db.refresh(subtask)
    return subtask


@router.post("/subtasks/{subtask_id}/skip", response_model=schemas.SubtaskOut)
def skip_subtask(subtask_id: int, db: Session = Depends(get_db)):
    subtask = db.get(models.Subtask, subtask_id)
    if subtask is None:
        raise HTTPException(404, f"No subtask {subtask_id}")
    subtask.status = models.STATUS_SKIPPED
    db.query(models.ScheduledSlot).filter(
        models.ScheduledSlot.subtask_id == subtask_id
    ).delete(synchronize_session=False)
    db.commit()
    log_event(
        db, subtask.parent_task.student_id, "skipped", task_id=subtask.parent_task_id,
        subtask_id=subtask.id, details={"phase": subtask.phase},
    )
    db.refresh(subtask)
    return subtask


@router.post("/tasks/{task_id}/skip", response_model=schemas.TaskOut)
def skip_task(task_id: int, db: Session = Depends(get_db)):
    task = _get_task(db, task_id)
    task.status = models.STATUS_SKIPPED
    db.query(models.ScheduledSlot).filter(models.ScheduledSlot.task_id == task_id).delete(
        synchronize_session=False
    )
    db.commit()
    log_event(db, task.student_id, "skipped", task_id=task.id)
    db.refresh(task)
    return task
