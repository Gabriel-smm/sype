import time
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


@pytest.mark.parametrize("freq", ["SECONDLY", "MINUTELY", "HOURLY", "hourly"])
def test_validate_recurrence_rejects_sub_daily_frequencies(freq):
    with pytest.raises(RecurrenceError, match="daily"):
        validate_recurrence([f"RRULE:FREQ={freq};COUNT=3"], MON)


@pytest.mark.parametrize("freq", ["DAILY", "WEEKLY", "MONTHLY", "YEARLY"])
def test_validate_recurrence_accepts_daily_or_coarser(freq):
    validate_recurrence([f"RRULE:FREQ={freq};COUNT=3"], MON)


def test_weekly_rule_strings():
    assert weekly_rule(None) == "RRULE:FREQ=DAILY"
    assert weekly_rule([3, 1]) == "RRULE:FREQ=WEEKLY;BYDAY=TU,TH"


def _finishes_within(seconds, fn):
    """Run `fn` in a daemon thread so a regression fails instead of hanging the suite."""
    import threading

    outcome = {}

    def run():
        try:
            outcome["value"] = fn()
        except BaseException as exc:  # noqa: BLE001 - handed back to the test
            outcome["error"] = exc

    thread = threading.Thread(target=run, daemon=True)
    thread.start()
    thread.join(seconds)
    assert not thread.is_alive(), f"did not finish within {seconds}s"
    if "error" in outcome:
        raise outcome["error"]
    return outcome.get("value")


@pytest.mark.parametrize("interval", ["0", "-1"])
def test_validate_recurrence_rejects_interval_below_one(interval):
    # INTERVAL=0 used to pass validation and then make every expansion loop forever.
    with pytest.raises(RecurrenceError, match="INTERVAL"):
        _finishes_within(5, lambda: validate_recurrence(
            [f"RRULE:FREQ=WEEKLY;INTERVAL={interval}"], MON))


def test_expand_rejects_a_stored_interval_zero_instead_of_looping():
    ev = EventSpec(1, MON.replace(hour=9), MON.replace(hour=10), ("RRULE:FREQ=DAILY;INTERVAL=0",))
    with pytest.raises(RecurrenceError):
        _finishes_within(5, lambda: expand(ev, [], MON, MON + timedelta(days=7)))


@pytest.mark.parametrize("part", ["BYHOUR=1,2,3,4,5", "BYMINUTE=0,30", "BYSECOND=0,1", "byhour=9"])
def test_validate_recurrence_rejects_intra_day_by_parts(part):
    with pytest.raises(RecurrenceError, match="daily"):
        validate_recurrence([f"RRULE:FREQ=DAILY;{part}"], MON)


def test_never_matching_rule_is_rejected_quickly():
    t0 = time.perf_counter()
    with pytest.raises(RecurrenceError, match="no occurrence"):
        _finishes_within(10, lambda: validate_recurrence(
            ["RRULE:FREQ=DAILY;BYMONTH=2;BYMONTHDAY=30"], MON))
    assert time.perf_counter() - t0 < 2
    with pytest.raises(RecurrenceError, match="no occurrence"):
        _finishes_within(10, lambda: validate_recurrence(
            ["RRULE:FREQ=DAILY;BYMONTH=2;BYMONTHDAY=30;COUNT=3"], MON))


def test_sparse_rules_with_an_occurrence_within_five_years_are_accepted():
    leap_day = ["RRULE:FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=29"]
    validate_recurrence(leap_day, MON)  # next is 2028-02-29
    ev = EventSpec(1, MON.replace(hour=9), MON.replace(hour=10), tuple(leap_day))
    occ = expand(ev, [], datetime(2028, 2, 1), datetime(2028, 3, 1))
    assert [o.start for o in occ] == [datetime(2028, 2, 29, 9)]
    validate_recurrence(["RRULE:FREQ=DAILY;UNTIL=20260304T090000"], MON.replace(hour=9))
    validate_recurrence(["RRULE:FREQ=DAILY;COUNT=2;BYMONTH=3"], MON)


def test_expanding_a_long_running_daily_series_is_fast_and_correct():
    ev = EventSpec(
        1, datetime(2016, 1, 4, 23), datetime(2016, 1, 5, 7), (weekly_rule(None),)
    )
    window_start = datetime(2026, 3, 2, 6)
    t0 = time.perf_counter()
    occ = _finishes_within(10, lambda: expand(ev, [], window_start, window_start + timedelta(days=120)))
    assert time.perf_counter() - t0 < 1
    # the night that began at 23:00 the day before still covers 06:00
    assert occ[0].start == datetime(2026, 3, 1, 23)
    assert len(occ) == 121
    assert occ[-1].start == datetime(2026, 6, 29, 23)


_SMUGGLED = [
    "RRULE:FREQ=DAILY;INTERVAL=0",
    "RRULE:FREQ=DAILY;BYMONTH=2;BYMONTHDAY=30",
    "RRULE:FREQ=MINUTELY",
]


@pytest.mark.parametrize("rule", _SMUGGLED)
@pytest.mark.parametrize("sep", ["\n", "\r\n", "\r", " ", "\t", "\x0b", " "])
def test_a_rule_smuggled_inside_another_item_is_rejected(rule, sep):
    # rrulestr re-splits the joined text on whitespace, so one item could carry a second line.
    with pytest.raises(RecurrenceError):
        _finishes_within(5, lambda: validate_recurrence([f"EXDATE:20200101T090000{sep}{rule}"], MON))


@pytest.mark.parametrize("rule", _SMUGGLED)
def test_expand_rejects_a_stored_smuggled_rule_before_iterating(rule):
    ev = EventSpec(1, MON.replace(hour=9), MON.replace(hour=10),
                   (f"EXDATE:20200101T090000\n{rule}",))
    with pytest.raises(RecurrenceError):
        _finishes_within(5, lambda: expand(ev, [], MON, MON + timedelta(days=7)))


def test_control_characters_are_rejected():
    for line in ("RRULE:FREQ=DAILY\x00", "RRULE:FREQ=DAILY\x7f", "RRULE:FREQ=\x1bDAILY"):
        with pytest.raises(RecurrenceError):
            validate_recurrence([line], MON)


def test_probe_rejects_an_item_that_parses_to_several_rules():
    from app.recurrence import _probe_first_occurrence

    with pytest.raises(RecurrenceError):
        _probe_first_occurrence("RRULE:FREQ=DAILY\nRRULE:FREQ=WEEKLY", MON)


def test_expand_turns_iteration_errors_into_recurrence_errors(monkeypatch):
    from dateutil.rrule import rruleset

    def boom(*args, **kwargs):
        raise ValueError("year 10000 is out of range")

    monkeypatch.setattr(rruleset, "between", boom)
    with pytest.raises(RecurrenceError):
        expand(_daily_series(), [], MON, MON + timedelta(days=1))


def test_at_most_100_recurrence_lines():
    exdates = [f"EXDATE:{(MON + timedelta(days=i)).strftime('%Y%m%dT090000')}" for i in range(1, 100)]
    validate_recurrence([weekly_rule(None), *exdates], MON.replace(hour=9))  # exactly 100
    with pytest.raises(RecurrenceError, match="100"):
        validate_recurrence([weekly_rule(None), *exdates, "EXDATE:20300101T090000"], MON)


def test_recurring_series_must_start_in_1970_or_later():
    validate_recurrence([weekly_rule(None)], datetime(1970, 1, 1))
    with pytest.raises(RecurrenceError, match="1970"):
        validate_recurrence([weekly_rule(None)], datetime(1969, 12, 31, 23))
    validate_recurrence([], datetime(1900, 1, 1))  # a one-off event is not a series
    old = EventSpec(1, datetime(1900, 1, 1, 9), datetime(1900, 1, 1, 10), (weekly_rule(None),))
    with pytest.raises(RecurrenceError, match="1970"):
        expand(old, [], MON, MON + timedelta(days=1))


@pytest.mark.parametrize("lines", [
    ["RRULE:FREQ=DAILY", "EXDATE:20260303T090000Z"],
    ["RRULE:FREQ=DAILY", "RDATE:20260310T090000Z"],
    ["RDATE:20260310T090000Z"],
    ["RRULE:FREQ=DAILY", "EXDATE:20260303T090000+0100"],
])
def test_timezone_aware_dates_are_rejected(lines):
    with pytest.raises(RecurrenceError):
        _finishes_within(5, lambda: validate_recurrence(lines, MON.replace(hour=9)))


def test_at_most_1000_exdate_and_rdate_values_in_total():
    days = [(MON + timedelta(days=i)).strftime("%Y%m%dT090000") for i in range(1, 1002)]
    validate_recurrence(
        [weekly_rule(None), "EXDATE:" + ",".join(days[:600]), "RDATE:" + ",".join(days[600:1000])],
        MON.replace(hour=9),
    )  # exactly 1000 values
    t0 = time.perf_counter()
    with pytest.raises(RecurrenceError, match="1000"):
        validate_recurrence([weekly_rule(None), "EXDATE:" + ",".join(days)], MON.replace(hour=9))
    with pytest.raises(RecurrenceError, match="1000"):
        validate_recurrence(
            [weekly_rule(None), "EXDATE:" + ",".join(days[:600]), "RDATE:" + ",".join(days[600:])],
            MON.replace(hour=9),
        )
    many = EventSpec(1, MON.replace(hour=9), MON.replace(hour=10),
                     (weekly_rule(None), "EXDATE:" + ",".join(days * 50)))
    with pytest.raises(RecurrenceError, match="1000"):
        expand(many, [], MON, MON + timedelta(days=1))
    assert time.perf_counter() - t0 < 1
