"""Deterministic priority scoring (Section 4 of the brief).

This module is deliberately free of DB and framework imports: it operates on
plain dataclasses so the ranking can be unit tested and eyeballed in isolation.
"""
from dataclasses import dataclass, field
from datetime import datetime

DEFAULT_WEIGHTS = {
    "w_urgency": 0.4,
    "w_grade": 0.3,
    "w_stress": 0.15,
    "w_effort_gap": 0.15,
}


@dataclass(frozen=True)
class Weights:
    w_urgency: float = DEFAULT_WEIGHTS["w_urgency"]
    w_grade: float = DEFAULT_WEIGHTS["w_grade"]
    w_stress: float = DEFAULT_WEIGHTS["w_stress"]
    w_effort_gap: float = DEFAULT_WEIGHTS["w_effort_gap"]


@dataclass
class ScorableTask:
    """Flattened view of a Task or Subtask, ready to be scored.

    `days_until_due` is precomputed against a fixed reference time so that
    scoring itself stays a pure function of its inputs.
    """

    id: str
    title: str
    days_until_due: float
    grade_weight: float  # percent, 0-100
    stress_rating: int  # 1-5
    estimated_duration: float  # minutes
    time_invested: float = 0.0  # minutes
    requires_focus: bool = False
    due_date: datetime | None = None
    task_id: int | None = None
    subtask_id: int | None = None
    # Ids of items that must finish before this one starts (essay phases,
    # study sessions). Scoring ignores these; the scheduler enforces them.
    predecessor_ids: list[str] = field(default_factory=list)


def days_until(due_date: datetime, now: datetime) -> float:
    return (due_date - now).total_seconds() / 86400.0


def priority_score(task: ScorableTask, weights: Weights) -> float:
    """Weighted sum of four normalised 0-1-ish components.

    urgency is unbounded above (it is 1/days), which is intentional: a task due
    within hours should be able to dominate the ranking.
    """
    urgency = 1 / max(task.days_until_due, 0.5)
    grade_component = task.grade_weight / 100
    stress_component = task.stress_rating / 5

    if task.estimated_duration <= 0:
        effort_gap = 0.0
    else:
        remaining = task.estimated_duration - task.time_invested
        # Clamped: a task logged as over-worked contributes 0, never negative.
        effort_gap = min(max(remaining / task.estimated_duration, 0.0), 1.0)

    return (
        weights.w_urgency * urgency
        + weights.w_grade * grade_component
        + weights.w_stress * stress_component
        + weights.w_effort_gap * effort_gap
    )


def rank(tasks: list[ScorableTask], weights: Weights) -> list[tuple[ScorableTask, float]]:
    """Tasks paired with their score, highest priority first.

    Ties break on the earlier due date, then on id, so the ordering is stable
    and reproducible across runs.
    """
    scored = [(t, priority_score(t, weights)) for t in tasks]
    scored.sort(key=lambda pair: (-pair[1], pair[0].days_until_due, str(pair[0].id)))
    return scored
