"""Greedy scheduler (Section 6 of the brief).

Deterministic and DB-free: it takes plain specs for the student's fixed blocks
and productive windows plus a ranked list of work items, and returns
placements. No LLM is involved in any decision here.
"""
from dataclasses import dataclass, field
from datetime import datetime, timedelta

from .scoring import ScorableTask, Weights, rank
from .timeutil import MINUTES_PER_DAY, day_start

DEFAULT_HORIZON_DAYS = 7

# Free fragments shorter than this are not worth offering the student.
MIN_SLOT_MINUTES = 15

# An item whose deadline has already passed cannot, by definition, be placed
# "before its due date". Refusing to schedule it would bury the very work the
# priority ranking pushes to the top, so instead we place overdue items as
# early as possible and mark them. Flip this to False for strict Section 6
# behaviour (they then come back as unschedulable).
SCHEDULE_OVERDUE_ASAP = True


@dataclass(frozen=True)
class BlockSpec:
    """A weekly-recurring interval. day_of_week None = every day.

    end_minute <= start_minute means the block wraps past midnight.
    """

    start_minute: int
    end_minute: int
    day_of_week: int | None = None
    kind: str = "other"
    label: str = ""


@dataclass
class FreeSlot:
    start: datetime
    end: datetime
    is_productive: bool

    @property
    def minutes(self) -> float:
        return (self.end - self.start).total_seconds() / 60.0


@dataclass
class Placement:
    item: ScorableTask
    start: datetime
    end: datetime
    is_productive: bool
    score: float
    overdue: bool = False


@dataclass
class Unschedulable:
    item: ScorableTask
    score: float
    reason: str


@dataclass
class ScheduleResult:
    placements: list[Placement] = field(default_factory=list)
    unschedulable: list[Unschedulable] = field(default_factory=list)
    horizon_start: datetime | None = None
    horizon_end: datetime | None = None


# --------------------------------------------------------------------------
# Free-slot construction
# --------------------------------------------------------------------------

def _expand(blocks: list[BlockSpec], window_start: datetime, window_end: datetime
            ) -> list[tuple[datetime, datetime]]:
    """Weekly-recurring blocks -> absolute intervals clipped to the window."""
    intervals: list[tuple[datetime, datetime]] = []
    # Start a day early so a block that wraps past midnight still covers the
    # first morning of the window.
    cursor = day_start(window_start) - timedelta(days=1)
    last = day_start(window_end) + timedelta(days=1)

    while cursor <= last:
        for block in blocks:
            if block.day_of_week is not None and block.day_of_week != cursor.weekday():
                continue
            start = cursor + timedelta(minutes=block.start_minute)
            end_minute = block.end_minute
            if end_minute <= block.start_minute:
                end_minute += MINUTES_PER_DAY  # wraps past midnight
            end = cursor + timedelta(minutes=end_minute)

            start = max(start, window_start)
            end = min(end, window_end)
            if end > start:
                intervals.append((start, end))
        cursor += timedelta(days=1)
    return intervals


def _merge(intervals: list[tuple[datetime, datetime]]) -> list[tuple[datetime, datetime]]:
    if not intervals:
        return []
    intervals = sorted(intervals)
    merged = [intervals[0]]
    for start, end in intervals[1:]:
        last_start, last_end = merged[-1]
        if start <= last_end:
            merged[-1] = (last_start, max(last_end, end))
        else:
            merged.append((start, end))
    return merged


def _subtract(base: list[tuple[datetime, datetime]], cuts: list[tuple[datetime, datetime]]
              ) -> list[tuple[datetime, datetime]]:
    result = []
    for start, end in base:
        cursor = start
        for cut_start, cut_end in cuts:
            if cut_end <= cursor or cut_start >= end:
                continue
            if cut_start > cursor:
                result.append((cursor, min(cut_start, end)))
            cursor = max(cursor, cut_end)
            if cursor >= end:
                break
        if cursor < end:
            result.append((cursor, end))
    return result


def _intersect(base: list[tuple[datetime, datetime]], mask: list[tuple[datetime, datetime]]
               ) -> list[tuple[datetime, datetime]]:
    result = []
    for start, end in base:
        for mask_start, mask_end in mask:
            lo, hi = max(start, mask_start), min(end, mask_end)
            if hi > lo:
                result.append((lo, hi))
    return result


def build_free_slots(
    fixed_blocks: list[BlockSpec],
    productive_windows: list[BlockSpec],
    *,
    now: datetime,
    horizon_days: int = DEFAULT_HORIZON_DAYS,
    min_slot_minutes: int = MIN_SLOT_MINUTES,
) -> list[FreeSlot]:
    """The 24-hour day minus sleep/lunch/classes, tagged by productive hours."""
    window_start = now
    window_end = day_start(now) + timedelta(days=horizon_days)
    if window_end <= window_start:
        return []

    busy = _merge(_expand(fixed_blocks, window_start, window_end))
    free = _subtract([(window_start, window_end)], busy)

    productive = _merge(_expand(productive_windows, window_start, window_end))
    productive_free = _intersect(free, productive)
    plain_free = _subtract(free, productive)

    slots = [FreeSlot(s, e, True) for s, e in productive_free]
    slots += [FreeSlot(s, e, False) for s, e in plain_free]
    slots = [s for s in slots if s.minutes >= min_slot_minutes]
    # Productive slots first at equal start times, so focus work claims them.
    slots.sort(key=lambda s: (s.start, not s.is_productive))
    return slots


# --------------------------------------------------------------------------
# Greedy placement
# --------------------------------------------------------------------------

def _deadline_for(item: ScorableTask, now: datetime) -> datetime | None:
    """Latest moment work on this item may end. None = unconstrained."""
    if item.due_date is None:
        return None
    if item.due_date <= now and SCHEDULE_OVERDUE_ASAP:
        return None
    return item.due_date


def _diagnose(item: ScorableTask, slots: list[FreeSlot], deadline: datetime | None,
              horizon_days: int, earliest: datetime) -> str:
    needed = item.estimated_duration
    usable = [FreeSlot(max(s.start, earliest), s.end, s.is_productive) for s in slots]
    long_enough = [s for s in usable if s.minutes >= needed]
    if not long_enough:
        longest = max((s.minutes for s in usable), default=0)
        return (
            f"Needs an unbroken {needed:.0f}-min block; the longest free gap in the next "
            f"{horizon_days} days is {longest:.0f} min. Split it or shorten the estimate."
        )
    if item.requires_focus:
        focused = [s for s in long_enough if s.is_productive]
        if not focused:
            longest = max((s.minutes for s in usable if s.is_productive), default=0)
            return (
                f"High-focus work needs a {needed:.0f}-min block inside your productive hours; "
                f"the longest productive gap left is {longest:.0f} min. Widen your productive "
                f"windows or split this task."
            )
        long_enough = focused
    if deadline is not None and all(s.start + timedelta(minutes=needed) > deadline
                                    for s in long_enough):
        return (
            f"No free block big enough before the {deadline:%a %d %b %H:%M} deadline - "
            f"the next one that fits starts too late."
        )
    return f"Could not place {needed:.0f} min of work in the next {horizon_days} days."


def _precedence_order(
    ranked: list[tuple[ScorableTask, float]]
) -> list[tuple[ScorableTask, float]]:
    """Priority order, except a predecessor always precedes its successors.

    A stable topological sort: it preserves the score ranking wherever the
    precedence graph does not force a swap. Cycles (which the decomposer never
    produces) degrade gracefully to plain priority order.
    """
    by_id = {item.id: pair for pair in ranked for item in [pair[0]]}
    ordered: list[tuple[ScorableTask, float]] = []
    done: set[str] = set()

    def visit(item_id: str, stack: set[str]) -> None:
        if item_id in done or item_id not in by_id or item_id in stack:
            return
        stack.add(item_id)
        item, _ = by_id[item_id]
        for predecessor in item.predecessor_ids:
            visit(predecessor, stack)
        stack.discard(item_id)
        done.add(item_id)
        ordered.append(by_id[item_id])

    for item, _ in ranked:
        visit(item.id, set())
    return ordered


def schedule(
    items: list[ScorableTask],
    weights: Weights,
    slots: list[FreeSlot],
    *,
    now: datetime,
    horizon_days: int = DEFAULT_HORIZON_DAYS,
    min_slot_minutes: int = MIN_SLOT_MINUTES,
) -> ScheduleResult:
    """Rank the items, then walk them into the earliest slot that fits."""
    ranked = rank(items, weights)
    # Working copy; slots get split as they are consumed.
    open_slots = sorted(
        (FreeSlot(s.start, s.end, s.is_productive) for s in slots),
        key=lambda s: (s.start, not s.is_productive),
    )
    result = ScheduleResult(
        horizon_start=now, horizon_end=day_start(now) + timedelta(days=horizon_days)
    )
    finished_at: dict[str, datetime] = {}

    for item, score in _precedence_order(ranked):
        needed = timedelta(minutes=item.estimated_duration)
        if item.estimated_duration <= 0:
            result.unschedulable.append(
                Unschedulable(item, score, "Estimated duration is zero - nothing to schedule.")
            )
            continue

        # Never start before the work this depends on has finished.
        earliest = max(
            [now] + [finished_at[p] for p in item.predecessor_ids if p in finished_at]
        )
        deadline = _deadline_for(item, now)

        chosen = None
        for index, slot in enumerate(open_slots):
            if item.requires_focus and not slot.is_productive:
                continue
            start = max(slot.start, earliest)
            if slot.end - start < needed:
                continue
            if deadline is not None and start + needed > deadline:
                continue
            chosen = (index, start)
            break

        if chosen is None:
            result.unschedulable.append(
                Unschedulable(
                    item, score, _diagnose(item, open_slots, deadline, horizon_days, earliest)
                )
            )
            continue

        index, start = chosen
        slot = open_slots[index]
        end = start + needed
        result.placements.append(
            Placement(
                item=item,
                start=start,
                end=end,
                is_productive=slot.is_productive,
                score=score,
                overdue=item.due_date is not None and item.due_date <= now,
            )
        )
        finished_at[item.id] = end

        # Consume the slot, keeping any usable remainder on either side.
        remainders = [
            FreeSlot(slot.start, start, slot.is_productive),
            FreeSlot(end, slot.end, slot.is_productive),
        ]
        keep = [r for r in remainders if r.minutes >= min_slot_minutes]
        open_slots[index : index + 1] = keep

    result.placements.sort(key=lambda p: p.start)
    return result
