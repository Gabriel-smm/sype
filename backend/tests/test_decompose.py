"""Unit tests for the decomposition rules, against sample long tasks."""
from datetime import datetime, timedelta

import pytest

from app.decompose import (
    ESSAY_DECOMPOSITION_THRESHOLD_MIN,
    EXAM_SESSION_OFFSETS_DAYS,
    decompose,
)

NOW = datetime(2026, 3, 2, 9, 0)


def test_short_essay_is_left_whole():
    assert decompose(
        title="Reading response",
        task_type="essay_project",
        due_date=NOW + timedelta(days=5),
        estimated_duration=ESSAY_DECOMPOSITION_THRESHOLD_MIN,
        now=NOW,
    ) == []


def test_long_essay_splits_into_the_four_phases_in_order():
    specs = decompose(
        title="Ethics paper",
        task_type="essay_project",
        due_date=NOW + timedelta(days=12),
        estimated_duration=600,  # 10 hours
        now=NOW,
    )
    assert [s.phase for s in specs] == ["research", "outline", "draft", "revise"]
    assert [s.order_index for s in specs] == [0, 1, 2, 3]
    assert specs[0].title == "Ethics paper - research"


def test_essay_phase_durations_match_the_20_10_50_20_split_and_sum_exactly():
    specs = decompose(
        title="Ethics paper",
        task_type="essay_project",
        due_date=NOW + timedelta(days=12),
        estimated_duration=600,
        now=NOW,
    )
    assert [s.estimated_duration for s in specs] == [120, 60, 300, 120]
    assert sum(s.estimated_duration for s in specs) == 600


@pytest.mark.parametrize("total", [190, 247, 313, 599, 1000])
def test_essay_phase_durations_always_sum_to_the_original_estimate(total):
    specs = decompose(
        title="P",
        task_type="essay_project",
        due_date=NOW + timedelta(days=10),
        estimated_duration=total,
        now=NOW,
    )
    assert sum(s.estimated_duration for s in specs) == total


def test_essay_phase_deadlines_are_evenly_spaced_and_end_on_the_due_date():
    due = NOW + timedelta(days=12)
    specs = decompose(
        title="P", task_type="essay_project", due_date=due, estimated_duration=600, now=NOW
    )
    assert specs[-1].due_by == due
    assert specs[0].due_by == NOW + timedelta(days=3)
    assert specs[1].due_by == NOW + timedelta(days=6)
    assert specs[2].due_by == NOW + timedelta(days=9)
    # Strictly increasing, and nothing due before the student can start.
    assert all(a.due_by < b.due_by for a, b in zip(specs, specs[1:]))
    assert all(s.due_by >= NOW for s in specs)


def test_only_the_drafting_phase_requires_productive_hours():
    specs = decompose(
        title="P", task_type="essay_project", due_date=NOW + timedelta(days=9),
        estimated_duration=600, now=NOW,
    )
    assert [s.requires_focus for s in specs] == [False, False, True, False]


def test_essay_already_past_due_still_decomposes_without_crashing():
    due = NOW - timedelta(days=1)
    specs = decompose(
        title="Late paper", task_type="essay_project", due_date=due,
        estimated_duration=600, now=NOW,
    )
    assert len(specs) == 4
    assert all(s.due_by == due for s in specs)  # zero runway -> all due now


def test_exam_study_generates_the_full_spaced_sequence_when_there_is_runway():
    due = NOW + timedelta(days=14)
    specs = decompose(
        title="Bio midterm", task_type="exam_study", due_date=due,
        estimated_duration=480, now=NOW,
    )
    assert len(specs) == len(EXAM_SESSION_OFFSETS_DAYS)
    assert [s.due_by for s in specs] == [due - timedelta(days=d) for d in [10, 6, 3, 1]]
    assert [s.estimated_duration for s in specs] == [120, 120, 120, 120]
    assert all(s.requires_focus for s in specs)


def test_exam_sessions_sum_to_the_original_estimate_when_not_divisible():
    specs = decompose(
        title="Bio", task_type="exam_study", due_date=NOW + timedelta(days=14),
        estimated_duration=470, now=NOW,
    )
    assert sum(s.estimated_duration for s in specs) == 470


def test_exam_in_five_days_drops_the_sessions_that_no_longer_fit():
    due = NOW + timedelta(days=5)
    specs = decompose(
        title="Bio", task_type="exam_study", due_date=due, estimated_duration=300, now=NOW
    )
    # Only the 3-day and 1-day sessions still land in the future.
    assert [s.due_by for s in specs] == [due - timedelta(days=3), due - timedelta(days=1)]
    assert sum(s.estimated_duration for s in specs) == 300
    assert all(s.due_by > NOW for s in specs)


def test_exam_tomorrow_collapses_to_a_single_cram_session():
    due = NOW + timedelta(hours=20)
    specs = decompose(
        title="Bio", task_type="exam_study", due_date=due, estimated_duration=180, now=NOW
    )
    assert len(specs) == 1
    assert specs[0].due_by == due
    assert specs[0].estimated_duration == 180


def test_short_exam_study_is_still_decomposed():
    """Unlike essays, exam study has no duration threshold - spacing is the point."""
    specs = decompose(
        title="Quiz", task_type="exam_study", due_date=NOW + timedelta(days=14),
        estimated_duration=60, now=NOW,
    )
    assert len(specs) == 4


@pytest.mark.parametrize("task_type", ["reading", "problem_set", "admin", "other"])
def test_other_task_types_are_never_decomposed(task_type):
    assert decompose(
        title="T", task_type=task_type, due_date=NOW + timedelta(days=10),
        estimated_duration=1200, now=NOW,
    ) == []
