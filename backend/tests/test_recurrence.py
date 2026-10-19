from datetime import datetime, timedelta

import pytest

from app.recurrence import (
    EventSpec,
    ExceptionSpec,
    Occurrence,
    RecurrenceError,
    expand,
    validate_recurrence,
    weekly_rule,
)

MON = datetime(2026, 3, 2)


def test_single_event_inside_window_is_one_occurrence():
    ev = EventSpec(1, MON.replace(hour=9), MON.replace(hour=10))
    assert expand(ev, [], MON, MON + timedelta(days=1)) == [
        Occurrence(1, MON.replace(hour=9), MON.replace(hour=10), True)
    ]


def test_event_straddling_window_edge_is_included():
    ev = EventSpec(1, MON.replace(hour=23), MON + timedelta(days=1, hours=1))
    assert len(expand(ev, [], MON + timedelta(days=1), MON + timedelta(days=2))) == 1


def test_event_outside_window_is_excluded():
    ev = EventSpec(1, MON.replace(hour=9), MON.replace(hour=10))
    # end == window_start -> excluded (end is exclusive)
    assert expand(ev, [], MON.replace(hour=10), MON + timedelta(days=1)) == []
    # start == window_end -> excluded
    assert expand(ev, [], MON - timedelta(days=1), MON.replace(hour=9)) == []


def test_busy_flag_is_carried_through():
    ev = EventSpec(1, MON.replace(hour=9), MON.replace(hour=10), busy=False)
    assert expand(ev, [], MON, MON + timedelta(days=1))[0].busy is False


def test_weekly_byday_expands_to_matching_days():
    ev = EventSpec(1, MON.replace(hour=9), MON.replace(hour=10, minute=15), (weekly_rule([0, 2]),))
    occ = expand(ev, [], MON, MON + timedelta(days=14))
    assert [o.start.weekday() for o in occ] == [0, 2, 0, 2]
    assert all(o.original_start == o.start for o in occ)
    assert all(o.end - o.start == timedelta(hours=1, minutes=15) for o in occ)
    assert all(o.exception_id is None for o in occ)


def test_overnight_daily_occurrence_from_previous_day_covers_morning():
    sleep = EventSpec(
        1,
        MON.replace(hour=23, minute=30),
        MON + timedelta(days=1, hours=7, minutes=30),
        (weekly_rule(None),),
    )
    occ = expand(sleep, [], MON + timedelta(days=3, hours=8), MON + timedelta(days=4, hours=8))
    assert occ[0].start == MON + timedelta(days=3, hours=23, minutes=30)
    # the night that ended at 07:30 is before the 08:00 window start
    assert len(occ) == 1
    occ2 = expand(sleep, [], MON + timedelta(days=3, hours=6), MON + timedelta(days=3, hours=12))
    assert occ2[0].start == MON + timedelta(days=2, hours=23, minutes=30)


def test_until_and_count_are_respected():
    count = EventSpec(1, MON.replace(hour=9), MON.replace(hour=10), ("RRULE:FREQ=DAILY;COUNT=3",))
    assert len(expand(count, [], MON, MON + timedelta(days=10))) == 3
    until = EventSpec(
        1, MON.replace(hour=9), MON.replace(hour=10), ("RRULE:FREQ=DAILY;UNTIL=20260304T090000",)
    )
    assert len(expand(until, [], MON, MON + timedelta(days=10))) == 3


def test_exdate_removes_an_instance():
    lines = (weekly_rule(None), "EXDATE:20260303T090000")
    ev = EventSpec(1, MON.replace(hour=9), MON.replace(hour=10), lines)
    occ = expand(ev, [], MON, MON + timedelta(days=3))
    assert len(occ) == 2
    assert datetime(2026, 3, 3, 9) not in [o.start for o in occ]


def _daily_series() -> EventSpec:
    return EventSpec(1, MON.replace(hour=9), MON.replace(hour=10), (weekly_rule(None),))


def test_cancelled_exception_removes_and_moved_exception_replaces():
    a = ExceptionSpec(
        10, datetime(2026, 3, 3, 9), datetime(2026, 3, 3, 9), datetime(2026, 3, 3, 10), cancelled=True
    )
    b = ExceptionSpec(
        11, datetime(2026, 3, 4, 9), datetime(2026, 3, 4, 15), datetime(2026, 3, 4, 16)
    )
    occ = expand(_daily_series(), [a, b], MON, datetime(2026, 3, 5))
    assert [o.start for o in occ] == [datetime(2026, 3, 2, 9), datetime(2026, 3, 4, 15)]
    moved = occ[1]
    assert moved.exception_id == 11
    assert moved.original_start == datetime(2026, 3, 4, 9)
    assert moved.end == datetime(2026, 3, 4, 16)
    assert occ[0].exception_id is None


def test_moved_exception_outside_original_window_still_appears():
    b = ExceptionSpec(
        11, datetime(2026, 3, 10, 9), datetime(2026, 3, 4, 15), datetime(2026, 3, 4, 16)
    )
    occ = expand(_daily_series(), [b], datetime(2026, 3, 4, 12), datetime(2026, 3, 4, 20))
    assert len(occ) == 1
    assert occ[0].start == datetime(2026, 3, 4, 15)
    assert occ[0].exception_id == 11


def test_exception_moved_out_of_window_is_not_returned():
    b = ExceptionSpec(
        11, datetime(2026, 3, 4, 9), datetime(2026, 3, 9, 15), datetime(2026, 3, 9, 16)
    )
    occ = expand(_daily_series(), [b], datetime(2026, 3, 4), datetime(2026, 3, 5))
    assert occ == []


def test_exception_busy_flag_overrides_series():
    b = ExceptionSpec(
        11, datetime(2026, 3, 4, 9), datetime(2026, 3, 4, 9), datetime(2026, 3, 4, 10), busy=False
    )
    occ = expand(_daily_series(), [b], datetime(2026, 3, 4), datetime(2026, 3, 5))
    assert [o.busy for o in occ] == [False]


def test_wall_clock_time_is_kept_across_dst_date():
    ev = EventSpec(
        1, datetime(2026, 10, 26, 9), datetime(2026, 10, 26, 10), ("RRULE:FREQ=WEEKLY",)
    )
    occ = expand(ev, [], datetime(2026, 11, 2), datetime(2026, 11, 3))
    assert [o.start for o in occ] == [datetime(2026, 11, 2, 9)]


def test_validate_recurrence_rejects_garbage():
    with pytest.raises(RecurrenceError):
        validate_recurrence(["RRULE:FREQ=SOMETIMES"], MON)
    with pytest.raises(RecurrenceError):
        validate_recurrence(["DTSTART:20260101T000000"], MON)
    validate_recurrence([weekly_rule([0]), "EXDATE:20260303T090000"], MON)
    validate_recurrence([], MON)


def test_weekly_rule_strings():
    assert weekly_rule(None) == "RRULE:FREQ=DAILY"
    assert weekly_rule([3, 1]) == "RRULE:FREQ=WEEKLY;BYDAY=TU,TH"
