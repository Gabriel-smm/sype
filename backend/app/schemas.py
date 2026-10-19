"""Pydantic request/response models.

Durations are minutes. Recurring block times cross the wire as "HH:MM".
"""
from datetime import datetime

from typing import Annotated, Literal

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, field_validator, model_validator

from .models import COLOR_KEYS, DEFAULT_CALENDAR_COLOR, EVENT_TYPES, TASK_TYPE_ROUTINE, TASK_TYPES
from .recurrence import validate_recurrence
from .timeutil import format_hhmm, parse_hhmm


def _check_color_key(value: str) -> str:
    if value not in COLOR_KEYS:
        raise ValueError(f"color_key must be one of {COLOR_KEYS}")
    return value


ColorKey = Annotated[str, AfterValidator(_check_color_key)]


class BlockBase(BaseModel):
    label: str = ""
    day_of_week: int | None = Field(None, ge=0, le=6, description="0=Mon, 6=Sun; null=every day")
    start_time: str = Field(..., examples=["09:00"])
    end_time: str = Field(..., examples=["11:00"])

    @field_validator("start_time", "end_time")
    @classmethod
    def _valid_time(cls, value: str) -> str:
        return format_hhmm(parse_hhmm(value))


class ProductiveWindowCreate(BlockBase):
    pass


class ProductiveWindowOut(ProductiveWindowCreate):
    id: int


class StudentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str


class StudentSettings(BaseModel):
    student: StudentOut
    productive_hours: list[ProductiveWindowOut]
    recurring_tasks: list["RecurringTaskOut"]
    weights: "WeightsOut"


class TaskCreate(BaseModel):
    title: str = Field(..., min_length=1)
    due_date: datetime
    estimated_duration: int = Field(..., gt=0, description="minutes")
    task_type: str = "other"
    grade_weight: float = Field(0.0, ge=0, le=100)
    stress_rating: int = Field(3, ge=1, le=5)
    time_invested: int = Field(0, ge=0, description="minutes")
    category_id: int | None = None
    color_key: ColorKey | None = None

    @field_validator("task_type")
    @classmethod
    def _valid_type(cls, value: str) -> str:
        if value not in TASK_TYPES:
            raise ValueError(f"task_type must be one of {TASK_TYPES}")
        return value


class TaskUpdate(BaseModel):
    title: str | None = None
    due_date: datetime | None = None
    estimated_duration: int | None = Field(None, gt=0)
    task_type: str | None = None
    grade_weight: float | None = Field(None, ge=0, le=100)
    stress_rating: int | None = Field(None, ge=1, le=5)
    time_invested: int | None = Field(None, ge=0)
    status: str | None = None
    category_id: int | None = None  # an explicit null clears the category
    color_key: ColorKey | None = None  # an explicit null clears the task's own colour


class SubtaskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    parent_task_id: int
    title: str
    due_by: datetime
    estimated_duration: int
    time_invested: int
    phase: str
    requires_focus: bool
    order_index: int
    status: str


class TaskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    student_id: int
    title: str
    due_date: datetime
    estimated_duration: int
    task_type: str
    grade_weight: float
    stress_rating: int
    time_invested: int
    status: str
    recurring_task_id: int | None = None
    category_id: int | None = None
    color_key: str | None = None
    subtasks: list[SubtaskOut] = []


class RecurringTaskBase(BaseModel):
    title: str = Field(..., min_length=1)
    task_type: str = TASK_TYPE_ROUTINE
    estimated_duration: int = Field(..., gt=0, description="minutes")
    grade_weight: float = Field(0.0, ge=0, le=100)
    stress_rating: int = Field(3, ge=1, le=5)
    weekdays: list[int] = Field(..., min_length=1, description="0=Mon .. 6=Sun")
    due_time: str = Field("23:59", examples=["18:00"])
    category_id: int | None = None

    @field_validator("task_type")
    @classmethod
    def _valid_type(cls, value: str) -> str:
        if value not in TASK_TYPES:
            raise ValueError(f"task_type must be one of {TASK_TYPES}")
        return value

    @field_validator("weekdays")
    @classmethod
    def _valid_weekdays(cls, value: list[int]) -> list[int]:
        if not all(0 <= d <= 6 for d in value):
            raise ValueError("weekdays entries must be 0 (Mon) through 6 (Sun)")
        return sorted(set(value))

    @field_validator("due_time")
    @classmethod
    def _valid_due_time(cls, value: str) -> str:
        return format_hhmm(parse_hhmm(value))


class RecurringTaskCreate(RecurringTaskBase):
    pass


class RecurringTaskUpdate(BaseModel):
    title: str | None = None
    task_type: str | None = None
    estimated_duration: int | None = Field(None, gt=0)
    grade_weight: float | None = Field(None, ge=0, le=100)
    stress_rating: int | None = Field(None, ge=1, le=5)
    weekdays: list[int] | None = Field(None, min_length=1)
    due_time: str | None = None
    active: bool | None = None
    category_id: int | None = None  # an explicit null clears the category

    @field_validator("task_type")
    @classmethod
    def _valid_type(cls, value: str | None) -> str | None:
        if value is not None and value not in TASK_TYPES:
            raise ValueError(f"task_type must be one of {TASK_TYPES}")
        return value

    @field_validator("weekdays")
    @classmethod
    def _valid_weekdays(cls, value: list[int] | None) -> list[int] | None:
        if value is not None and not all(0 <= d <= 6 for d in value):
            raise ValueError("weekdays entries must be 0 (Mon) through 6 (Sun)")
        return sorted(set(value)) if value is not None else None

    @field_validator("due_time")
    @classmethod
    def _valid_due_time(cls, value: str | None) -> str | None:
        return format_hhmm(parse_hhmm(value)) if value is not None else None


class RecurringTaskOut(RecurringTaskBase):
    id: int
    student_id: int
    active: bool


class WeightsUpdate(BaseModel):
    w_urgency: float = Field(..., ge=0, le=1)
    w_grade: float = Field(..., ge=0, le=1)
    w_stress: float = Field(..., ge=0, le=1)
    w_effort_gap: float = Field(..., ge=0, le=1)


class WeightsOut(WeightsUpdate):
    model_config = ConfigDict(from_attributes=True)

    student_id: int


class WeightsPreviewRequest(WeightsUpdate):
    """Hypothetical weights, scored but never saved."""

    limit: int = Field(5, ge=1, le=20)


class RankedItemOut(BaseModel):
    task_id: int | None
    subtask_id: int | None
    title: str
    parent_title: str | None
    task_type: str
    priority_score: float
    due_date: datetime


class WeightsPreviewOut(BaseModel):
    ranked: list[RankedItemOut]
    total_pending: int


class ScheduledSlotOut(BaseModel):
    id: int
    task_id: int | None
    subtask_id: int | None
    title: str
    parent_title: str | None
    task_type: str
    start_time: datetime
    end_time: datetime
    in_productive_hours: bool
    requires_focus: bool
    recurring: bool
    priority_score: float
    due_date: datetime
    overdue: bool
    category_id: int | None
    color_key: str | None


class UnschedulableOut(BaseModel):
    task_id: int | None
    subtask_id: int | None
    title: str
    priority_score: float
    estimated_duration: int
    due_date: datetime
    reason: str


class ScheduleOut(BaseModel):
    horizon_start: datetime
    horizon_end: datetime
    generated_at: datetime
    slots: list[ScheduledSlotOut]
    unschedulable: list[UnschedulableOut]


class ChatMessage(BaseModel):
    role: str
    content: str

    @field_validator("role")
    @classmethod
    def _valid_role(cls, value: str) -> str:
        if value not in {"user", "assistant"}:
            raise ValueError("role must be 'user' or 'assistant'")
        return value


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(..., min_length=1)


class EventCreate(BaseModel):
    event_type: str
    task_id: int | None = None
    subtask_id: int | None = None
    details: str = ""

    @field_validator("event_type")
    @classmethod
    def _valid_event(cls, value: str) -> str:
        if value not in EVENT_TYPES:
            raise ValueError(f"event_type must be one of {EVENT_TYPES}")
        return value


class EventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    student_id: int
    task_id: int | None
    subtask_id: int | None
    event_type: str
    timestamp: datetime
    details: str


class CalendarCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=80)
    color_key: ColorKey = DEFAULT_CALENDAR_COLOR


class CalendarUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=80)
    color_key: ColorKey | None = None
    visible: bool | None = None
    position: int | None = None


class CalendarOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    source: str
    is_primary: bool
    visible: bool
    color_key: str
    position: int


class CategoryCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=40)
    color_key: ColorKey


class CategoryUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=40)
    color_key: ColorKey | None = None
    position: int | None = None


class CategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    color_key: str
    position: int


def _naive(value: datetime) -> datetime:
    if value.tzinfo is not None:
        raise ValueError("Datetimes are naive local time; drop the UTC offset")
    return value


NaiveDatetime = Annotated[datetime, AfterValidator(_naive)]
EventKind = Literal["default", "routine"]


class CalendarEventCreate(BaseModel):
    calendar_id: int | None = None  # None = the student's primary calendar
    title: str = Field(..., min_length=1)
    description: str = ""
    location: str = ""
    start: NaiveDatetime
    end: NaiveDatetime  # exclusive
    all_day: bool = False
    busy: bool | None = None  # None = busy unless all-day
    kind: EventKind = "default"
    category_id: int | None = None
    color_key: ColorKey | None = None
    recurrence: list[str] = []

    @model_validator(mode="after")
    def _check_times_and_recurrence(self):
        if self.end <= self.start:
            raise ValueError("end must be after start")
        validate_recurrence(self.recurrence, self.start)  # RecurrenceError is a ValueError
        return self


class CalendarEventUpdate(BaseModel):
    """Every field optional. The routes re-validate the merged times and recurrence."""

    calendar_id: int | None = None
    title: str | None = Field(None, min_length=1)
    description: str | None = None
    location: str | None = None
    start: NaiveDatetime | None = None
    end: NaiveDatetime | None = None
    all_day: bool | None = None
    busy: bool | None = None
    kind: EventKind | None = None
    category_id: int | None = None  # an explicit null clears the category
    color_key: ColorKey | None = None  # an explicit null clears the event's own colour
    recurrence: list[str] | None = None


class CalendarEventOut(BaseModel):
    id: int
    calendar_id: int
    category_id: int | None
    color_key: str | None  # the event's own colour; the effective one is on OccurrenceOut
    title: str
    description: str
    location: str
    start: datetime
    end: datetime
    all_day: bool
    busy: bool
    kind: str
    status: str
    recurrence: list[str]
    recurring_event_id: int | None
    original_start_time: datetime | None


class OccurrenceOut(BaseModel):
    """One concrete occurrence in a window; `event_id` is the series for an instance."""

    id: str
    event_id: int
    calendar_id: int
    category_id: int | None
    color_key: str  # effective colour: category, else own, else calendar
    title: str
    description: str
    location: str
    start: datetime
    end: datetime
    all_day: bool
    busy: bool
    kind: str
    recurring: bool
    original_start: datetime | None


StudentSettings.model_rebuild()
