"""Unit tests for priority_score, run before it is wired into anything."""
from datetime import datetime, timedelta

import pytest

from app.scoring import DEFAULT_WEIGHTS, ScorableTask, Weights, days_until, priority_score, rank

NOW = datetime(2026, 3, 2, 9, 0)


def make(title, days, grade, stress, est=120, invested=0, **kw):
    return ScorableTask(
        id=title,
        title=title,
        days_until_due=days,
        grade_weight=grade,
        stress_rating=stress,
        estimated_duration=est,
        time_invested=invested,
        **kw,
    )


# Five fake tasks covering the interesting corners of the formula.
FIXTURES = {
    # Due tomorrow, worth a lot, stressful -> should top the list.
    "midterm_tomorrow": make("midterm_tomorrow", days=1, grade=30, stress=5, est=300),
    # Due in two weeks, worth the most of any task, but no time pressure.
    "final_essay": make("final_essay", days=14, grade=40, stress=4, est=600),
    # Due in three days, trivial weight, low stress.
    "reading_quiz": make("reading_quiz", days=3, grade=5, stress=2, est=60),
    # Ungraded admin chore due in two days.
    "fafsa_form": make("fafsa_form", days=2, grade=0, stress=3, est=30),
    # Already overdue -> urgency saturates at the 0.5-day floor.
    "overdue_lab": make("overdue_lab", days=-1, grade=10, stress=4, est=90),
}

WEIGHTS = Weights()


def test_default_weights_match_the_brief():
    assert (WEIGHTS.w_urgency, WEIGHTS.w_grade, WEIGHTS.w_stress, WEIGHTS.w_effort_gap) == (
        0.4,
        0.3,
        0.15,
        0.15,
    )
    assert sum(DEFAULT_WEIGHTS.values()) == pytest.approx(1.0)


def test_score_is_computed_by_hand_correctly():
    task = make("t", days=2, grade=30, stress=4, est=120, invested=30)
    expected = 0.4 * (1 / 2) + 0.3 * 0.30 + 0.15 * 0.8 + 0.15 * 0.75
    assert priority_score(task, WEIGHTS) == pytest.approx(expected)


def test_urgency_is_floored_so_overdue_tasks_do_not_explode():
    overdue = make("overdue", days=-5, grade=10, stress=3)
    just_due = make("just_due", days=0.5, grade=10, stress=3)
    # 1 / max(days, 0.5) caps urgency at 2.0 rather than going negative.
    assert priority_score(overdue, WEIGHTS) == pytest.approx(priority_score(just_due, WEIGHTS))
    assert priority_score(overdue, WEIGHTS) > 0


def test_effort_gap_shrinks_as_time_is_invested():
    fresh = make("fresh", days=5, grade=20, stress=3, est=200, invested=0)
    half = make("half", days=5, grade=20, stress=3, est=200, invested=100)
    done = make("done", days=5, grade=20, stress=3, est=200, invested=200)
    assert priority_score(fresh, WEIGHTS) > priority_score(half, WEIGHTS) > priority_score(done, WEIGHTS)


def test_effort_gap_is_clamped_when_overworked():
    over = make("over", days=5, grade=20, stress=3, est=100, invested=250)
    done = make("done", days=5, grade=20, stress=3, est=100, invested=100)
    assert priority_score(over, WEIGHTS) == pytest.approx(priority_score(done, WEIGHTS))


def test_zero_duration_task_does_not_divide_by_zero():
    assert priority_score(make("z", days=3, grade=10, stress=1, est=0), WEIGHTS) > 0


def test_ranking_of_the_five_fixtures_is_intuitive():
    order = [t.title for t, _ in rank(list(FIXTURES.values()), WEIGHTS)]

    # The overdue lab and the midterm due tomorrow are the two fires to put out.
    assert set(order[:2]) == {"overdue_lab", "midterm_tomorrow"}
    # The big essay is not urgent yet, so it sits mid-pack despite its 40% weight.
    assert order.index("final_essay") > order.index("midterm_tomorrow")
    # A 5%-of-grade quiz is the least pressing thing on the list.
    assert order[-1] == "reading_quiz"


def test_raising_the_grade_weight_slider_promotes_the_heaviest_task():
    tasks = list(FIXTURES.values())
    default_pos = [t.title for t, _ in rank(tasks, WEIGHTS)].index("final_essay")

    grade_heavy = Weights(w_urgency=0.1, w_grade=0.8, w_stress=0.05, w_effort_gap=0.05)
    heavy_pos = [t.title for t, _ in rank(tasks, grade_heavy)].index("final_essay")
    assert heavy_pos < default_pos  # 4th -> 2nd

    grade_only = Weights(w_urgency=0.0, w_grade=1.0, w_stress=0.0, w_effort_gap=0.0)
    assert rank(tasks, grade_only)[0][0].title == "final_essay"


def test_urgency_outweighs_grade_until_the_slider_is_pushed_hard():
    """Documents a real property of the Section 4 formula.

    urgency is 1/days and so ranges up to 2.0, while grade_component is capped
    at 1.0. A task due tomorrow therefore still beats a 40%-of-grade essay due
    in two weeks even at w_grade=0.8 - you have to go near grade-only weights
    to flip it. Intentional for an MVP, but the reason the sliders feel
    unresponsive at the low end.
    """
    tasks = list(FIXTURES.values())
    grade_heavy = Weights(w_urgency=0.1, w_grade=0.8, w_stress=0.05, w_effort_gap=0.05)
    assert rank(tasks, grade_heavy)[0][0].title == "midterm_tomorrow"


def test_a_zero_weight_chore_can_outrank_a_heavy_essay_when_due_sooner():
    """Also a property worth watching in real student testing.

    Under default weights the ungraded FAFSA form (due in 2 days) edges out the
    40% final essay (due in 14). Defensible - deadlines are real - but if
    students complain about this, w_urgency is the dial to turn down.
    """
    order = [t.title for t, _ in rank(list(FIXTURES.values()), WEIGHTS)]
    assert order.index("fafsa_form") < order.index("final_essay")


def test_raising_the_stress_slider_promotes_the_most_stressful_task():
    stress_heavy = Weights(w_urgency=0.05, w_grade=0.05, w_stress=0.85, w_effort_gap=0.05)
    top = rank(list(FIXTURES.values()), stress_heavy)[0][0]
    assert top.stress_rating == 5


def test_rank_is_deterministic_for_identical_tasks():
    a = make("a", days=3, grade=10, stress=3)
    b = make("b", days=3, grade=10, stress=3)
    assert [t.id for t, _ in rank([a, b], WEIGHTS)] == [t.id for t, _ in rank([b, a], WEIGHTS)]


def test_days_until_converts_a_real_deadline():
    assert days_until(NOW + timedelta(days=2, hours=12), NOW) == pytest.approx(2.5)
