"""Read/write access to the behavioural event log."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..db import get_db
from ..pipeline import log_event

router = APIRouter(prefix="/api/students/{student_id}/events", tags=["events"])


@router.get("", response_model=list[schemas.EventOut])
def list_events(student_id: int, limit: int = 200, db: Session = Depends(get_db)):
    return (
        db.query(models.EventLog)
        .filter(models.EventLog.student_id == student_id)
        .order_by(models.EventLog.timestamp.desc(), models.EventLog.id.desc())
        .limit(limit)
        .all()
    )


@router.post("", response_model=schemas.EventOut, status_code=201)
def create_event(student_id: int, payload: schemas.EventCreate, db: Session = Depends(get_db)):
    """Escape hatch for the UI to log anything the typed endpoints do not cover."""
    if db.get(models.Student, student_id) is None:
        raise HTTPException(404, f"No student {student_id}")
    return log_event(
        db, student_id, payload.event_type, task_id=payload.task_id,
        subtask_id=payload.subtask_id, details={"note": payload.details},
    )
