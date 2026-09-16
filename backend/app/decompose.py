"""Rule-based task decomposition (Section 5 of the brief).

Pure functions - no DB, no LLM. Given a task-shaped input and a reference
time, return the subtasks it should be split into (empty list = leave whole).
"""
from dataclasses import dataclass
from datetime import datetime, timedelta

TASK_TYPE_ESSAY = "essay_project"
TASK_TYPE_EXAM = "exam_study"

# Essays longer than this get phased. 3 hours, per the brief.
ESSAY_DECOMPOSITION_THRESHOLD_MIN = 3 * 60

# (phase name, share of total duration, needs a productive-hour slot)
ESSAY_PHASES = [
    ("research", 0.20, False),
    ("outline", 0.10, False),
    ("draft", 0.50, True),
    ("revise", 0.20, False),
]

# Spaced-repetition sessions, in days before the exam.
EXAM_SESSION_OFFSETS_DAYS = [10, 6, 3, 1]

MIN_SUBTASK_MINUTES = 15


@dataclass
class SubtaskSpec:
    title: str
    due_by: datetime
    estimated_duration: int  # minutes
    phase: str
    requires_focus: bool
    order_index: int


def decompose(
    *,
    title: str,
    task_type: str,
    due_date: datetime,
    estimated_duration: int,
    now: datetime,
) -> list[SubtaskSpec]:
    """Dispatch to the right rule. Unknown types are never decomposed."""
    if task_type == TASK_TYPE_ESSAY:
        return _decompose_essay(title, due_date, estimated_duration, now)
    if task_type == TASK_TYPE_EXAM:
        return _decompose_exam(title, due_date, estimated_duration, now)
    return []


def _decompose_essay(
    title: str, due_date: datetime, estimated_duration: int, now: datetime
) -> list[SubtaskSpec]:
    if estimated_duration <= ESSAY_DECOMPOSITION_THRESHOLD_MIN:
        return []

    # Phase deadlines are spaced evenly across the runway; the last phase lands
    # on the real due date. A task due in the past gets a flat runway instead.
    span = max((due_date - now).total_seconds(), 0.0)

    specs: list[SubtaskSpec] = []
    allocated = 0
    for index, (phase, share, focus) in enumerate(ESSAY_PHASES):
        if index == len(ESSAY_PHASES) - 1:
            duration = estimated_duration - allocated  # absorb rounding drift
        else:
            duration = max(int(round(estimated_duration * share)), MIN_SUBTASK_MINUTES)
        allocated += duration

        fraction = (index + 1) / len(ESSAY_PHASES)
        specs.append(
            SubtaskSpec(
                title=f"{title} - {phase}",
                due_by=due_date - timedelta(seconds=span * (1 - fraction)),
                estimated_duration=duration,
                phase=phase,
                requires_focus=focus,
                order_index=index,
            )
        )
    return specs


def _decompose_exam(
    title: str, due_date: datetime, estimated_duration: int, now: datetime
) -> list[SubtaskSpec]:
    # Only sessions that still have runway left are worth generating.
    offsets = [d for d in EXAM_SESSION_OFFSETS_DAYS if due_date - timedelta(days=d) > now]
    if not offsets:
        # Exam is imminent (or past): one cram session due at the exam itself.
        offsets = [0]

    offsets.sort(reverse=True)  # earliest session first
    count = len(offsets)
    base = max(estimated_duration // count, MIN_SUBTASK_MINUTES)

    specs: list[SubtaskSpec] = []
    allocated = 0
    for index, offset in enumerate(offsets):
        duration = estimated_duration - allocated if index == count - 1 else base
        allocated += duration
        specs.append(
            SubtaskSpec(
                title=f"{title} - session {index + 1} of {count}",
                due_by=due_date - timedelta(days=offset),
                estimated_duration=duration,
                phase=f"study_session_{index + 1}",
                requires_focus=True,  # all exam study is high-focus work
                order_index=index,
            )
        )
    return specs
