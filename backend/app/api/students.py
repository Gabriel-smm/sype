"""Student settings: fixed blocks, productive hours, priority weights."""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..db import get_db
from ..pipeline import collect_scorable
from ..scoring import Weights as ScoringWeights
from ..scoring import rank
from ..timeutil import format_hhmm, parse_hhmm

router = APIRouter(prefix="/api/students", tags=["students"])


def _get_student(db: Session, student_id: int) -> models.Student:
    student = db.get(models.Student, student_id)
    if student is None:
        raise HTTPException(404, f"No student {student_id}")
    return student


def _block_out(row) -> dict:
    return {
        "id": row.id,
        "label": row.label or "",
        "day_of_week": row.day_of_week,
        "start_time": format_hhmm(row.start_minute),
        "end_time": format_hhmm(row.end_minute),
    }


@router.get("/{student_id}/settings", response_model=schemas.StudentSettings)
def get_settings(student_id: int, db: Session = Depends(get_db)):
    student = _get_student(db, student_id)
    weights = db.get(models.Weights, student_id)
    if weights is None:
        weights = models.Weights(student_id=student_id)
        db.add(weights)
        db.commit()
    return {
        "student": student,
        "fixed_blocks": [
            {**_block_out(b), "kind": b.kind}
            for b in sorted(student.fixed_blocks, key=lambda b: (b.day_of_week is not None, b.start_minute))
        ],
        "productive_hours": [
            _block_out(w)
            for w in sorted(student.productive_hours, key=lambda w: (w.day_of_week is not None, w.start_minute))
        ],
        "weights": weights,
    }


@router.post("/{student_id}/fixed-blocks", response_model=schemas.FixedBlockOut, status_code=201)
def add_fixed_block(
    student_id: int, payload: schemas.FixedBlockCreate, db: Session = Depends(get_db)
):
    _get_student(db, student_id)
    block = models.FixedBlock(
        student_id=student_id,
        kind=payload.kind,
        label=payload.label,
        day_of_week=payload.day_of_week,
        start_minute=parse_hhmm(payload.start_time),
        end_minute=parse_hhmm(payload.end_time),
    )
    db.add(block)
    db.commit()
    db.refresh(block)
    return {**_block_out(block), "kind": block.kind}


@router.delete("/{student_id}/fixed-blocks/{block_id}", status_code=204)
def delete_fixed_block(student_id: int, block_id: int, db: Session = Depends(get_db)):
    block = db.get(models.FixedBlock, block_id)
    if block is None or block.student_id != student_id:
        raise HTTPException(404, "No such fixed block")
    db.delete(block)
    db.commit()


@router.post(
    "/{student_id}/productive-hours", response_model=schemas.ProductiveWindowOut, status_code=201
)
def add_productive_window(
    student_id: int, payload: schemas.ProductiveWindowCreate, db: Session = Depends(get_db)
):
    _get_student(db, student_id)
    window = models.ProductiveWindow(
        student_id=student_id,
        label=payload.label,
        day_of_week=payload.day_of_week,
        start_minute=parse_hhmm(payload.start_time),
        end_minute=parse_hhmm(payload.end_time),
    )
    db.add(window)
    db.commit()
    db.refresh(window)
    return _block_out(window)


@router.delete("/{student_id}/productive-hours/{window_id}", status_code=204)
def delete_productive_window(student_id: int, window_id: int, db: Session = Depends(get_db)):
    window = db.get(models.ProductiveWindow, window_id)
    if window is None or window.student_id != student_id:
        raise HTTPException(404, "No such productive window")
    db.delete(window)
    db.commit()


@router.get("/{student_id}/weights", response_model=schemas.WeightsOut)
def get_weights(student_id: int, db: Session = Depends(get_db)):
    _get_student(db, student_id)
    weights = db.get(models.Weights, student_id)
    if weights is None:
        weights = models.Weights(student_id=student_id)
        db.add(weights)
        db.commit()
        db.refresh(weights)
    return weights


@router.put("/{student_id}/weights", response_model=schemas.WeightsOut)
def update_weights(
    student_id: int, payload: schemas.WeightsUpdate, db: Session = Depends(get_db)
):
    """Level 1 personalisation: the student moves these sliders by hand."""
    _get_student(db, student_id)
    weights = db.get(models.Weights, student_id)
    if weights is None:
        weights = models.Weights(student_id=student_id)
        db.add(weights)
    for field, value in payload.model_dump().items():
        setattr(weights, field, value)
    db.commit()
    db.refresh(weights)
    return weights


@router.post("/{student_id}/weights/preview", response_model=schemas.WeightsPreviewOut)
def preview_weights(
    student_id: int, payload: schemas.WeightsPreviewRequest, db: Session = Depends(get_db)
):
    """Rank the student's pending work under hypothetical weights.

    Nothing is written. This exists so the settings sliders can show their
    effect using the same `scoring.rank` the scheduler uses, rather than the
    frontend reimplementing the formula and drifting from it.
    """
    _get_student(db, student_id)
    now = datetime.now().replace(second=0, microsecond=0)

    items = collect_scorable(db, student_id, now)
    weights = ScoringWeights(
        payload.w_urgency, payload.w_grade, payload.w_stress, payload.w_effort_gap
    )

    ranked = []
    for item, score in rank(items, weights)[: payload.limit]:
        parent = db.get(models.Task, item.task_id) if item.task_id else None
        ranked.append(
            {
                "task_id": item.task_id,
                "subtask_id": item.subtask_id,
                "title": item.title,
                "parent_title": parent.title if (parent and item.subtask_id) else None,
                "task_type": parent.task_type if parent else "other",
                "priority_score": round(score, 4),
                "due_date": item.due_date,
            }
        )

    return {"ranked": ranked, "total_pending": len(items)}
