"""Calendars, colour categories and calendar events: list/create per student, the rest by id."""
import json
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .. import models, schemas
from ..calendar_defaults import ensure_primary_calendar
from ..calendar_service import STATUS_CANCELLED, effective_color, load_occurrences
from ..db import get_db
from ..recurrence import Occurrence, RecurrenceError, validate_recurrence

MAX_RANGE = timedelta(days=120)
MIN_YEAR, MAX_YEAR = 1970, 2200
SEARCH_SPAN = timedelta(days=365)
STATUS_CONFIRMED = "confirmed"
OPAQUE, TRANSPARENT = "opaque", "transparent"

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


def _get_event(db: Session, event_id: int) -> models.CalendarEvent:
    row = db.get(models.CalendarEvent, event_id)
    if row is None:
        raise HTTPException(404, f"No calendar event {event_id}")
    return row


def _own_calendar(db: Session, student_id: int, calendar_id: int) -> models.Calendar:
    row = db.get(models.Calendar, calendar_id)
    if row is None or row.student_id != student_id:
        raise HTTPException(404, f"No calendar {calendar_id}")
    return row


def _own_category(db: Session, student_id: int, category_id: int) -> models.Category:
    row = db.get(models.Category, category_id)
    if row is None or row.student_id != student_id:
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


# --- calendar events ---------------------------------------------------------------------


def _event_out(row: models.CalendarEvent) -> schemas.CalendarEventOut:
    return schemas.CalendarEventOut(
        id=row.id, calendar_id=row.calendar_id, category_id=row.category_id,
        color_key=row.color_key, title=row.title, description=row.description,
        location=row.location, start=row.start, end=row.end, all_day=row.all_day,
        busy=row.transparency == OPAQUE, kind=row.kind, status=row.status,
        recurrence=row.recurrence_lines, recurring_event_id=row.recurring_event_id,
        original_start_time=row.original_start_time,
    )


def _occurrence_out(row: models.CalendarEvent, occurrence: Occurrence) -> schemas.OccurrenceOut:
    # `row` is the instance's own row for an edited instance, so event_id comes from the
    # occurrence (the series), while the details come from the row.
    original = occurrence.original_start
    return schemas.OccurrenceOut(
        id=(
            f"{occurrence.event_id}_{original:%Y%m%dT%H%M}"
            if original is not None
            else str(occurrence.event_id)
        ),
        event_id=occurrence.event_id, calendar_id=row.calendar_id, category_id=row.category_id,
        color_key=effective_color(row), title=row.title, description=row.description,
        location=row.location, start=occurrence.start, end=occurrence.end,
        all_day=row.all_day, busy=occurrence.busy, kind=row.kind,
        recurring=original is not None, original_start=original,
    )


def _check_timing(start: datetime, end: datetime, recurrence: list[str]) -> None:
    if end <= start:
        raise HTTPException(422, "end must be after start")
    try:
        validate_recurrence(recurrence, start)
    except RecurrenceError as exc:
        raise HTTPException(422, str(exc)) from None


def _parse_ids(value: str | None) -> list[int] | None:
    if value is None or not value.strip():
        return None
    try:
        return [int(part) for part in value.split(",")]
    except ValueError:
        raise HTTPException(422, "calendar_ids must be comma-separated integers") from None


@router.get(
    "/students/{student_id}/calendar-events", response_model=list[schemas.OccurrenceOut]
)
def list_event_occurrences(
    student_id: int,
    start: schemas.NaiveDatetime,
    end: schemas.NaiveDatetime,
    calendar_ids: str | None = Query(None, description="Comma-separated calendar ids"),
    db: Session = Depends(get_db),
):
    _get_student(db, student_id)
    if end <= start:
        raise HTTPException(422, "end must be after start")
    if end - start > MAX_RANGE:
        raise HTTPException(422, f"Range is limited to {MAX_RANGE.days} days")
    if start.year < MIN_YEAR or end.year > MAX_YEAR:
        raise HTTPException(422, f"Dates must fall between {MIN_YEAR} and {MAX_YEAR}")
    pairs = load_occurrences(db, student_id, start, end, calendar_ids=_parse_ids(calendar_ids))
    return [_occurrence_out(row, occurrence) for row, occurrence in pairs]


@router.get(
    "/students/{student_id}/calendar-events/search", response_model=list[schemas.OccurrenceOut]
)
def search_event_occurrences(
    student_id: int,
    q: str = Query(..., description="Matched against title, location and description"),
    limit: int = Query(25, ge=1, le=100),
    db: Session = Depends(get_db),
):
    _get_student(db, student_id)
    needle = q.strip().casefold()
    if not 1 <= len(needle) <= 100:
        raise HTTPException(422, "q must be 1 to 100 characters")
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    pairs = load_occurrences(db, student_id, today - SEARCH_SPAN, today + SEARCH_SPAN)
    matches = [
        (row, occurrence)
        for row, occurrence in pairs
        if any(needle in field.casefold() for field in (row.title, row.location, row.description))
    ]
    # Upcoming matches first (soonest first), then past ones (most recent first).
    upcoming = sorted((p for p in matches if p[1].start >= today), key=lambda p: p[1].start)
    past = sorted(
        (p for p in matches if p[1].start < today), key=lambda p: p[1].start, reverse=True
    )
    return [_occurrence_out(row, occurrence) for row, occurrence in (upcoming + past)[:limit]]


@router.post(
    "/students/{student_id}/calendar-events",
    response_model=schemas.CalendarEventOut,
    status_code=201,
)
def create_event(
    student_id: int, payload: schemas.CalendarEventCreate, db: Session = Depends(get_db)
):
    _get_student(db, student_id)
    if payload.calendar_id is None:
        calendar = ensure_primary_calendar(db, student_id)
    else:
        calendar = _own_calendar(db, student_id, payload.calendar_id)
    if payload.category_id is not None:
        _own_category(db, student_id, payload.category_id)
    busy = (not payload.all_day) if payload.busy is None else payload.busy
    row = models.CalendarEvent(
        student_id=student_id, calendar_id=calendar.id, category_id=payload.category_id,
        color_key=payload.color_key, title=payload.title, description=payload.description,
        location=payload.location, start=payload.start, end=payload.end,
        all_day=payload.all_day, transparency=OPAQUE if busy else TRANSPARENT,
        kind=payload.kind, status=STATUS_CONFIRMED, recurrence=json.dumps(payload.recurrence),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _event_out(row)


@router.get("/calendar-events/{event_id}", response_model=schemas.CalendarEventOut)
def get_event(event_id: int, db: Session = Depends(get_db)):
    return _event_out(_get_event(db, event_id))


@router.patch("/calendar-events/{event_id}", response_model=schemas.CalendarEventOut)
def update_event(
    event_id: int, payload: schemas.CalendarEventUpdate, db: Session = Depends(get_db)
):
    row = _get_event(db, event_id)
    sent = payload.model_fields_set
    data = payload.model_dump(exclude_unset=True)

    # Validate everything before touching the row, so a 4xx leaves it unchanged.
    if data.get("calendar_id") is not None:
        _own_calendar(db, row.student_id, data["calendar_id"])
    if data.get("category_id") is not None:
        _own_category(db, row.student_id, data["category_id"])
    start = data.get("start") or row.start
    end = data.get("end") or row.end
    recurrence = data["recurrence"] if data.get("recurrence") is not None else row.recurrence_lines
    if sent & {"start", "end", "recurrence"}:
        _check_timing(start, end, recurrence)

    # Columns that can't be null ignore an explicit null.
    for field in ("calendar_id", "title", "description", "location", "start", "end",
                  "all_day", "kind"):
        if data.get(field) is not None:
            setattr(row, field, data[field])
    if data.get("recurrence") is not None:
        row.recurrence = json.dumps(data["recurrence"])
    if data.get("busy") is not None:
        row.transparency = OPAQUE if data["busy"] else TRANSPARENT
    if "category_id" in sent:
        row.category_id = data["category_id"]
    if "color_key" in sent:
        row.color_key = data["color_key"]
        if data["color_key"] is not None and "category_id" not in sent:
            row.category_id = None  # a chosen colour replaces the category's
    db.commit()
    db.refresh(row)
    return _event_out(row)


@router.delete("/calendar-events/{event_id}", status_code=204)
def delete_event(event_id: int, db: Session = Depends(get_db)):
    row = _get_event(db, event_id)
    row.status = STATUS_CANCELLED  # soft delete: /restore brings it back
    db.commit()


@router.post("/calendar-events/{event_id}/restore", response_model=schemas.CalendarEventOut)
def restore_event(event_id: int, db: Session = Depends(get_db)):
    row = _get_event(db, event_id)
    row.status = STATUS_CONFIRMED
    db.commit()
    db.refresh(row)
    return _event_out(row)
