"""Calendars and colour categories: list/create per student, update/delete by id."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .. import models, schemas
from ..db import get_db

router = APIRouter(prefix="/api", tags=["calendar"])


def _get_student(db: Session, student_id: int) -> models.Student:
    student = db.get(models.Student, student_id)
    if student is None:
        raise HTTPException(404, f"No student {student_id}")
    return student


def _get_calendar(db: Session, calendar_id: int) -> models.Calendar:
    row = db.get(models.Calendar, calendar_id)
    if row is None:
        raise HTTPException(404, f"No calendar {calendar_id}")
    return row


def _get_category(db: Session, category_id: int) -> models.Category:
    row = db.get(models.Category, category_id)
    if row is None:
        raise HTTPException(404, f"No category {category_id}")
    return row


# --- calendars ---------------------------------------------------------------------------


@router.get("/students/{student_id}/calendars", response_model=list[schemas.CalendarOut])
def list_calendars(student_id: int, db: Session = Depends(get_db)):
    _get_student(db, student_id)
    return (
        db.query(models.Calendar)
        .filter(models.Calendar.student_id == student_id)
        .order_by(models.Calendar.is_primary.desc(), models.Calendar.position, models.Calendar.id)
        .all()
    )


@router.post(
    "/students/{student_id}/calendars", response_model=schemas.CalendarOut, status_code=201
)
def create_calendar(
    student_id: int, payload: schemas.CalendarCreate, db: Session = Depends(get_db)
):
    _get_student(db, student_id)
    last = (
        db.query(models.Calendar.position)
        .filter(models.Calendar.student_id == student_id)
        .order_by(models.Calendar.position.desc())
        .first()
    )
    row = models.Calendar(
        student_id=student_id,
        name=payload.name,
        color_key=payload.color_key,
        position=(last[0] + 1) if last else 0,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.patch("/calendars/{calendar_id}", response_model=schemas.CalendarOut)
def update_calendar(
    calendar_id: int, payload: schemas.CalendarUpdate, db: Session = Depends(get_db)
):
    row = _get_calendar(db, calendar_id)
    for field, value in payload.model_dump(exclude_unset=True, exclude_none=True).items():
        setattr(row, field, value)
    db.commit()
    db.refresh(row)
    return row


@router.delete("/calendars/{calendar_id}", status_code=204)
def delete_calendar(calendar_id: int, db: Session = Depends(get_db)):
    row = _get_calendar(db, calendar_id)
    if row.is_primary:
        raise HTTPException(409, "The primary calendar can't be deleted")
    # Instance overrides point at their series; delete them first so the FK order holds.
    db.query(models.CalendarEvent).filter(
        models.CalendarEvent.calendar_id == calendar_id,
        models.CalendarEvent.recurring_event_id.is_not(None),
    ).delete(synchronize_session=False)
    db.expire(row, ["events"])
    db.delete(row)
    db.commit()


# --- categories --------------------------------------------------------------------------


@router.get("/students/{student_id}/categories", response_model=list[schemas.CategoryOut])
def list_categories(student_id: int, db: Session = Depends(get_db)):
    _get_student(db, student_id)
    return (
        db.query(models.Category)
        .filter(models.Category.student_id == student_id)
        .order_by(models.Category.position, models.Category.id)
        .all()
    )


@router.post(
    "/students/{student_id}/categories", response_model=schemas.CategoryOut, status_code=201
)
def create_category(
    student_id: int, payload: schemas.CategoryCreate, db: Session = Depends(get_db)
):
    _get_student(db, student_id)
    last = (
        db.query(models.Category.position)
        .filter(models.Category.student_id == student_id)
        .order_by(models.Category.position.desc())
        .first()
    )
    row = models.Category(
        student_id=student_id,
        name=payload.name,
        color_key=payload.color_key,
        position=(last[0] + 1) if last else 0,
    )
    db.add(row)
    return _commit_category(db, row)


@router.patch("/categories/{category_id}", response_model=schemas.CategoryOut)
def update_category(
    category_id: int, payload: schemas.CategoryUpdate, db: Session = Depends(get_db)
):
    row = _get_category(db, category_id)
    for field, value in payload.model_dump(exclude_unset=True, exclude_none=True).items():
        setattr(row, field, value)
    return _commit_category(db, row)


def _commit_category(db: Session, row: models.Category) -> models.Category:
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "A category with that name already exists") from None
    db.refresh(row)
    return row


@router.delete("/categories/{category_id}", status_code=204)
def delete_category(
    category_id: int, reassign_to: int | None = None, db: Session = Depends(get_db)
):
    row = _get_category(db, category_id)
    target = None
    if reassign_to is not None:
        if reassign_to == category_id:
            raise HTTPException(422, "reassign_to must differ from the deleted category")
        target = db.get(models.Category, reassign_to)
        if target is None or target.student_id != row.student_id:
            raise HTTPException(404, f"No category {reassign_to}")

    # Done in code, not via FK actions: upgraded databases have no FK on these columns.
    for model in (models.CalendarEvent, models.Task):
        items = db.query(model).filter(model.category_id == category_id)
        if target is not None:
            items.update({"category_id": target.id}, synchronize_session=False)
        else:
            items.update(
                {"color_key": row.color_key, "category_id": None}, synchronize_session=False
            )
    recurring = db.query(models.RecurringTask).filter(
        models.RecurringTask.category_id == category_id
    )
    recurring.update(
        {"category_id": target.id if target is not None else None}, synchronize_session=False
    )
    db.delete(row)
    db.commit()
