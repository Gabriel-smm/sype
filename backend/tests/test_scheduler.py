"""Unit tests for the greedy scheduler against a fake week."""
from datetime import datetime, timedelta

import pytest

from app.scheduler import (
    BlockSpec,
    FreeSlot,
    build_free_slots,
    schedule,
)
from app.scoring import ScorableTask, Weights
from app.timeutil import parse_hhmm

# Monday 2026-03-02, 08:00.
NOW = datetime(2026, 3, 2, 8, 0)
WEIGHTS = Weights()


def hhmm(value):
    return parse_hhmm(value)


# A fake week: sleep every night, lunch every day, classes Mon/Wed/Fri mornings.
FIXED_BLOCKS = [
    BlockSpec(hhmm("23:00"), hhmm("07:00"), None, "sleep", "Sleep"),
    BlockSpec(hhmm("12:00"), hhmm("13:00"), None, "lunch", "Lunch"),
    BlockSpec(hhmm("09:00"), hhmm("11:00"), 0, "class", "Bio 101"),
    BlockSpec(hhmm("09:00"), hhmm("11:00"), 2, "class", "Bio 101"),
    BlockSpec(hhmm("09:00"), hhmm("11:00"), 4, "class", "Bio 101"),
]

# Two self-reported productive windows, every day.
PRODUCTIVE = [
    BlockSpec(hhmm("14:00"), hhmm("17:00"), None, label="Afternoon"),
    BlockSpec(hhmm("20:00"), hhmm("22:00"), None, label="Evening"),
]


def make(title, due_days, est, *, grade=20, stress=3, focus=False, invested=0):
    due = NOW + timedelta(days=due_days)
    return ScorableTask(
        id=title,
        title=title,
        days_until_due=due_days,
        grade_weight=grade,
        stress_rating=stress,
        estimated_duration=est,
        time_invested=invested,
        requires_focus=focus,
        due_date=due,
    )


def overlaps(a, b):
    return a.start < b.end and b.start < a.end


# --------------------------------------------------------------------------
# Free-slot construction
# --------------------------------------------------------------------------

def test_free_slots_never_overlap_and_are_ordered():
    slots = build_free_slots(FIXED_BLOCKS, PRODUCTIVE, now=NOW)
    assert slots
    for a, b in zip(slots, slots[1:]):
        assert a.start <= b.start
        assert not overlaps(a, b)


def test_free_slots_never_intersect_a_fixed_block():
    slots = build_free_slots(FIXED_BLOCKS, PRODUCTIVE, now=NOW)
    for slot in slots:
        cursor = slot.start
        while cursor < slot.end:
            minute_of_day = cursor.hour * 60 + cursor.minute
            assert not (minute_of_day >= hhmm("23:00") or minute_of_day < hhmm("07:00")), "sleep"
            assert not hhmm("12:00") <= minute_of_day < hhmm("13:00"), "lunch"
            if cursor.weekday() in (0, 2, 4):
                assert not hhmm("09:00") <= minute_of_day < hhmm("11:00"), "class"
            cursor += timedelta(minutes=5)


def test_sleep_block_wrapping_past_midnight_is_respected():
    slots = build_free_slots(FIXED_BLOCKS, PRODUCTIVE, now=NOW)
    tuesday_slots = [s for s in slots if s.start.date() == (NOW + timedelta(days=1)).date()]
    # First free moment on Tuesday is when sleep ends, not midnight.
    assert min(s.start for s in tuesday_slots).hour == 7


def test_slots_start_at_now_not_at_midnight():
    slots = build_free_slots(FIXED_BLOCKS, PRODUCTIVE, now=NOW)
    assert min(s.start for s in slots) == NOW


def test_productive_windows_are_tagged_and_split_out():
    slots = build_free_slots(FIXED_BLOCKS, PRODUCTIVE, now=NOW)
    productive = [s for s in slots if s.is_productive]
    assert productive
    for slot in productive:
        start_min = slot.start.hour * 60 + slot.start.minute
        assert (hhmm("14:00") <= start_min < hhmm("17:00")) or (
            hhmm("20:00") <= start_min < hhmm("22:00")
        )
    # Non-productive slots must not bleed into a productive window.
    for slot in slots:
        if slot.is_productive:
            continue
        assert not overlaps(slot, FreeSlot(
            slot.start.replace(hour=14, minute=0), slot.start.replace(hour=17, minute=0), True))


def test_horizon_covers_exactly_the_requested_days():
    slots = build_free_slots(FIXED_BLOCKS, PRODUCTIVE, now=NOW, horizon_days=7)
    assert max(s.end for s in slots) <= NOW.replace(hour=0) + timedelta(days=7)
    assert max(s.end for s in slots).date() == (NOW + timedelta(days=6)).date()


def test_fragments_shorter_than_the_minimum_are_dropped():
    blocks = [BlockSpec(hhmm("08:05"), hhmm("23:59"), None, "class", "Marathon lecture")]
    slots = build_free_slots(blocks, [], now=NOW, horizon_days=1, min_slot_minutes=15)
    # The 5-minute gap between NOW and 08:05 is not offered.
    assert all(s.minutes >= 15 for s in slots)


def test_a_fully_booked_day_yields_no_slots():
    blocks = [BlockSpec(hhmm("00:00"), hhmm("24:00"), None, "class", "All day")]
    assert build_free_slots(blocks, [], now=NOW, horizon_days=1) == []


# --------------------------------------------------------------------------
# Greedy placement
# --------------------------------------------------------------------------

def test_no_double_booking_across_a_full_week_of_tasks():
    slots = build_free_slots(FIXED_BLOCKS, PRODUCTIVE, now=NOW)
    items = [
        make("essay draft", 4, 120, grade=40, stress=5, focus=True),
        make("bio study", 3, 90, grade=30, stress=4, focus=True),
        make("problem set", 2, 60, grade=15, stress=3),
        make("reading", 5, 45, grade=5, stress=2),
        make("laundry", 6, 30, grade=0, stress=1),
        make("lab report", 3, 180, grade=25, stress=4),
    ]
    result = schedule(items, WEIGHTS, slots, now=NOW)
    assert result.placements
    placed = sorted(result.placements, key=lambda p: p.start)
    for a, b in zip(placed, placed[1:]):
        assert a.end <= b.start, f"{a.item.title} overlaps {b.item.title}"


def test_placements_never_land_inside_a_fixed_block():
    slots = build_free_slots(FIXED_BLOCKS, PRODUCTIVE, now=NOW)
    items = [make(f"task {i}", 5, 60) for i in range(10)]
    result = schedule(items, WEIGHTS, slots, now=NOW)
    for placement in result.placements:
        cursor = placement.start
        while cursor < placement.end:
            minute_of_day = cursor.hour * 60 + cursor.minute
            assert not (minute_of_day >= hhmm("23:00") or minute_of_day < hhmm("07:00"))
            assert not hhmm("12:00") <= minute_of_day < hhmm("13:00")
            if cursor.weekday() in (0, 2, 4):
                assert not hhmm("09:00") <= minute_of_day < hhmm("11:00")
            cursor += timedelta(minutes=5)


def test_high_focus_work_only_lands_in_productive_hours():
    slots = build_free_slots(FIXED_BLOCKS, PRODUCTIVE, now=NOW)
    items = [
        make("draft", 4, 120, grade=40, stress=5, focus=True),
        make("study", 3, 90, grade=30, stress=4, focus=True),
        make("chore", 2, 30, grade=0, stress=1),
    ]
    result = schedule(items, WEIGHTS, slots, now=NOW)
    for placement in result.placements:
        if placement.item.requires_focus:
            assert placement.is_productive, f"{placement.item.title} placed outside focus hours"


def test_higher_priority_task_is_placed_earlier():
    slots = build_free_slots(FIXED_BLOCKS, PRODUCTIVE, now=NOW)
    urgent = make("urgent", 1, 60, grade=40, stress=5)
    relaxed = make("relaxed", 6, 60, grade=5, stress=1)
    result = schedule([relaxed, urgent], WEIGHTS, slots, now=NOW)
    by_title = {p.item.title: p for p in result.placements}
    assert by_title["urgent"].start < by_title["relaxed"].start


def test_every_item_is_either_placed_or_explained():
    slots = build_free_slots(FIXED_BLOCKS, PRODUCTIVE, now=NOW)
    items = [make(f"t{i}", 5, 120) for i in range(40)]
    result = schedule(items, WEIGHTS, slots, now=NOW)
    assert len(result.placements) + len(result.unschedulable) == len(items)
    assert all(u.reason for u in result.unschedulable)


def test_task_too_long_for_any_gap_is_flagged_not_dropped():
    slots = build_free_slots(FIXED_BLOCKS, PRODUCTIVE, now=NOW)
    monster = make("write entire thesis", 5, 60 * 20)
    result = schedule([monster], WEIGHTS, slots, now=NOW)
    assert result.placements == []
    assert len(result.unschedulable) == 1
    assert "unbroken" in result.unschedulable[0].reason


def test_focus_task_larger_than_any_productive_window_is_flagged():
    slots = build_free_slots(FIXED_BLOCKS, PRODUCTIVE, now=NOW)
    # Productive windows max out at 3 hours; ask for 4 of focused work.
    result = schedule([make("mega draft", 5, 240, focus=True)], WEIGHTS, slots, now=NOW)
    assert result.placements == []
    assert "productive hours" in result.unschedulable[0].reason


def test_deadline_is_respected_and_missed_deadline_is_flagged():
    slots = build_free_slots(FIXED_BLOCKS, PRODUCTIVE, now=NOW)
    # 4 hours of work due in 3. It would fit later in the week, just not in
    # time - so the diagnosis must be about the deadline, not about capacity.
    tight = ScorableTask(
        id="tight", title="tight", days_until_due=0.125, grade_weight=50, stress_rating=5,
        estimated_duration=240, due_date=NOW + timedelta(hours=3),
    )
    result = schedule([tight], WEIGHTS, slots, now=NOW)
    assert result.placements == []
    assert "deadline" in result.unschedulable[0].reason


def test_work_is_always_placed_before_its_deadline():
    slots = build_free_slots(FIXED_BLOCKS, PRODUCTIVE, now=NOW)
    items = [make(f"t{i}", days, 60) for i, days in enumerate([1, 2, 2, 3, 4, 5])]
    result = schedule(items, WEIGHTS, slots, now=NOW)
    for placement in result.placements:
        assert placement.end <= placement.item.due_date


def test_nothing_is_scheduled_in_the_past():
    slots = build_free_slots(FIXED_BLOCKS, PRODUCTIVE, now=NOW)
    result = schedule([make(f"t{i}", 5, 60) for i in range(5)], WEIGHTS, slots, now=NOW)
    assert all(p.start >= NOW for p in result.placements)


def test_overdue_work_is_scheduled_asap_and_marked():
    slots = build_free_slots(FIXED_BLOCKS, PRODUCTIVE, now=NOW)
    late = ScorableTask(
        id="late", title="late", days_until_due=-2, grade_weight=30, stress_rating=5,
        estimated_duration=60, due_date=NOW - timedelta(days=2),
    )
    result = schedule([late], WEIGHTS, slots, now=NOW)
    assert len(result.placements) == 1
    assert result.placements[0].overdue is True
    assert result.placements[0].start >= NOW


def test_zero_duration_item_is_flagged_rather_than_placed():
    slots = build_free_slots(FIXED_BLOCKS, PRODUCTIVE, now=NOW)
    empty = make("empty", 3, 0)
    result = schedule([empty], WEIGHTS, slots, now=NOW)
    assert result.placements == []
    assert "zero" in result.unschedulable[0].reason


def test_leftover_slot_time_is_reused_by_later_tasks():
    slot = FreeSlot(NOW, NOW + timedelta(hours=3), False)
    items = [make("a", 5, 60), make("b", 5, 60), make("c", 5, 60)]
    result = schedule(items, WEIGHTS, [slot], now=NOW)
    assert len(result.placements) == 3
    assert result.placements[0].start == NOW
    assert result.placements[-1].end == NOW + timedelta(hours=3)


def test_scheduling_is_deterministic():
    slots = build_free_slots(FIXED_BLOCKS, PRODUCTIVE, now=NOW)
    items = [make(f"t{i}", (i % 5) + 1, 60 + i * 10, grade=i * 5) for i in range(12)]
    first = schedule(items, WEIGHTS, slots, now=NOW)
    second = schedule(list(reversed(items)), WEIGHTS, slots, now=NOW)
    assert [(p.item.id, p.start) for p in first.placements] == [
        (p.item.id, p.start) for p in second.placements
    ]


def test_empty_input_produces_an_empty_schedule():
    slots = build_free_slots(FIXED_BLOCKS, PRODUCTIVE, now=NOW)
    result = schedule([], WEIGHTS, slots, now=NOW)
    assert result.placements == [] and result.unschedulable == []


# --------------------------------------------------------------------------
# Precedence between decomposed phases
# --------------------------------------------------------------------------

def chain(titles, *, due_days, est, focus=()):
    """Build a dependent chain: each item waits on the one before it."""
    items = []
    previous = None
    for index, title in enumerate(titles):
        items.append(ScorableTask(
            id=title, title=title, days_until_due=due_days[index],
            grade_weight=40, stress_rating=4, estimated_duration=est[index],
            requires_focus=title in focus,
            due_date=NOW + timedelta(days=due_days[index]),
            predecessor_ids=[previous] if previous else [],
        ))
        previous = title
    return items


def test_dependent_phases_are_scheduled_in_order():
    slots = build_free_slots(FIXED_BLOCKS, PRODUCTIVE, now=NOW)
    items = chain(["research", "outline", "draft", "revise"],
                  due_days=[2, 3, 4, 5], est=[60, 30, 90, 60], focus=("draft",))
    result = schedule(items, WEIGHTS, slots, now=NOW)
    placed = {p.item.title: p for p in result.placements}
    assert len(placed) == 4
    assert placed["research"].end <= placed["outline"].start
    assert placed["outline"].end <= placed["draft"].start
    assert placed["draft"].end <= placed["revise"].start


def test_revise_waits_even_when_the_draft_is_pushed_into_late_productive_hours():
    """The regression this precedence handling exists for.

    With productive hours only late in the evening, a greedy scheduler that
    ignored precedence placed 'revise' at 09:12 and 'draft' at 21:00.
    """
    slots = build_free_slots([], [BlockSpec(hhmm("21:00"), hhmm("23:00"), None)], now=NOW)
    items = chain(["research", "outline", "draft", "revise"],
                  due_days=[2, 3, 4, 6], est=[48, 24, 120, 48], focus=("draft",))
    result = schedule(items, WEIGHTS, slots, now=NOW)
    placed = {p.item.title: p for p in result.placements}
    assert "draft" in placed and "revise" in placed
    assert placed["draft"].end <= placed["revise"].start


def test_a_phase_can_start_partway_into_a_slot_it_shares_with_its_predecessor():
    slot = FreeSlot(NOW, NOW + timedelta(hours=4), False)
    items = chain(["first", "second"], due_days=[3, 4], est=[60, 60])
    result = schedule(items, WEIGHTS, [slot], now=NOW)
    placed = {p.item.title: p for p in result.placements}
    assert placed["first"].start == NOW
    assert placed["second"].start == placed["first"].end


def test_precedence_does_not_reorder_independent_tasks():
    slots = build_free_slots(FIXED_BLOCKS, PRODUCTIVE, now=NOW)
    urgent = make("urgent", 1, 60, grade=40, stress=5)
    relaxed = make("relaxed", 6, 60, grade=5, stress=1)
    result = schedule([relaxed, urgent], WEIGHTS, slots, now=NOW)
    placed = {p.item.title: p for p in result.placements}
    assert placed["urgent"].start < placed["relaxed"].start


def test_an_unschedulable_predecessor_does_not_block_its_successor():
    slots = build_free_slots(FIXED_BLOCKS, PRODUCTIVE, now=NOW)
    items = chain(["giant", "small"], due_days=[4, 5], est=[60 * 30, 60])
    result = schedule(items, WEIGHTS, slots, now=NOW)
    assert [u.item.title for u in result.unschedulable] == ["giant"]
    assert [p.item.title for p in result.placements] == ["small"]


def test_a_dependency_cycle_degrades_to_plain_priority_order():
    slots = build_free_slots(FIXED_BLOCKS, PRODUCTIVE, now=NOW)
    a = make("a", 3, 60)
    b = make("b", 4, 60)
    a.predecessor_ids = ["b"]
    b.predecessor_ids = ["a"]
    result = schedule([a, b], WEIGHTS, slots, now=NOW)
    assert len(result.placements) == 2  # no hang, no dropped work


def test_gap_before_a_dependent_task_is_reused_by_other_work():
    slot = FreeSlot(NOW, NOW + timedelta(hours=5), False)
    items = chain(["first", "second"], due_days=[3, 4], est=[60, 60])
    filler = make("filler", 5, 60)
    result = schedule(items + [filler], WEIGHTS, [slot], now=NOW)
    assert len(result.placements) == 3
    placed = sorted(result.placements, key=lambda p: p.start)
    for x, y in zip(placed, placed[1:]):
        assert x.end <= y.start
