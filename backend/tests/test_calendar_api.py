"""Calendars and categories endpoints."""
import json
from datetime import datetime, time, timedelta
from time import perf_counter

from app import models
from app.calendar_service import busy_intervals
from app.db import SessionLocal


def _categories(client):
    return {c["name"]: c for c in client.get("/api/students/1/categories").json()}


def test_seed_has_primary_calendar_and_default_categories(client):
    calendars = client.get("/api/students/1/calendars").json()
    assert len(calendars) == 1
    assert calendars[0]["name"] == "Sype"
    assert calendars[0]["is_primary"] is True
    assert calendars[0]["color_key"] == "sky"
    cats = _categories(client)
    assert cats["Classes"]["color_key"] == "sky"
    assert cats["Routine"]["color_key"] == "stone"


def test_create_rename_and_recolour_a_calendar(client):
    resp = client.post("/api/students/1/calendars", json={"name": "Club", "color_key": "mint"})
    assert resp.status_code == 201
    body = resp.json()
    assert body["is_primary"] is False and body["visible"] is True and body["source"] == "local"
    patched = client.patch(
        f"/api/calendars/{body['id']}",
        json={"name": "Chess", "color_key": "rose", "visible": False, "position": 4},
    )
    assert patched.status_code == 200
    assert patched.json()["name"] == "Chess"
    assert patched.json()["color_key"] == "rose"
    assert patched.json()["visible"] is False
    assert patched.json()["position"] == 4
    names = [c["name"] for c in client.get("/api/students/1/calendars").json()]
    assert names == ["Sype", "Chess"]  # primary first


def test_calendar_colour_defaults_to_sky(client):
    resp = client.post("/api/students/1/calendars", json={"name": "Club"})
    assert resp.json()["color_key"] == "sky"


def test_invalid_colour_key_is_rejected(client):
    assert client.post(
        "/api/students/1/calendars", json={"name": "X", "color_key": "neon"}
    ).status_code == 422
    assert client.post(
        "/api/students/1/categories", json={"name": "X", "color_key": "neon"}
    ).status_code == 422
    cal = client.post("/api/students/1/calendars", json={"name": "Club"}).json()
    assert client.patch(f"/api/calendars/{cal['id']}", json={"color_key": "neon"}).status_code == 422


def test_create_rename_and_recolour_a_category(client):
    resp = client.post("/api/students/1/categories", json={"name": "Gym", "color_key": "mint"})
    assert resp.status_code == 201
    cat = resp.json()
    patched = client.patch(
        f"/api/categories/{cat['id']}", json={"name": "Fitness", "color_key": "lilac"}
    )
    assert patched.status_code == 200
    assert patched.json()["name"] == "Fitness" and patched.json()["color_key"] == "lilac"
    assert "Fitness" in _categories(client)


def test_duplicate_category_name_is_a_conflict(client):
    assert client.post(
        "/api/students/1/categories", json={"name": "Classes", "color_key": "rose"}
    ).status_code == 409
    gym = client.post("/api/students/1/categories", json={"name": "Gym", "color_key": "mint"}).json()
    assert client.patch(f"/api/categories/{gym['id']}", json={"name": "Classes"}).status_code == 409
    # the failed rename left the session usable
    assert client.get("/api/students/1/categories").status_code == 200


def test_primary_calendar_cannot_be_deleted(client):
    primary = client.get("/api/students/1/calendars").json()[0]
    resp = client.delete(f"/api/calendars/{primary['id']}")
    assert resp.status_code == 409
    assert resp.json()["detail"] == "The primary calendar can't be deleted"


def test_deleting_a_calendar_deletes_its_events(client):
    cal = client.post("/api/students/1/calendars", json={"name": "Club"}).json()
    with SessionLocal() as db:
        db.add(models.CalendarEvent(
            student_id=1, calendar_id=cal["id"], title="Meet",
            start=datetime(2026, 10, 19, 9), end=datetime(2026, 10, 19, 10),
        ))
        db.commit()
    assert client.delete(f"/api/calendars/{cal['id']}").status_code == 204
    with SessionLocal() as db:
        assert db.query(models.CalendarEvent).filter_by(title="Meet").count() == 0
        assert db.get(models.Calendar, cal["id"]) is None
    assert len(client.get("/api/students/1/calendars").json()) == 1


def _seed_items(category_id):
    """An event, a task and a recurring task, all in the given category."""
    with SessionLocal() as db:
        primary = db.query(models.Calendar).filter_by(is_primary=True).one()
        event = models.CalendarEvent(
            student_id=1, calendar_id=primary.id, title="Lab", category_id=category_id,
            start=datetime(2026, 10, 19, 9), end=datetime(2026, 10, 19, 10),
        )
        task = models.Task(
            student_id=1, title="Essay", due_date=datetime(2026, 10, 30),
            estimated_duration=60, category_id=category_id,
        )
        rec = models.RecurringTask(
            student_id=1, title="Read", estimated_duration=30, weekdays="0",
            due_minute=600, category_id=category_id,
        )
        db.add_all([event, task, rec])
        db.commit()
        return event.id, task.id, rec.id


def test_deleting_a_category_keeps_its_colour_on_items(client):
    classes = _categories(client)["Classes"]
    event_id, task_id, rec_id = _seed_items(classes["id"])
    assert client.delete(f"/api/categories/{classes['id']}").status_code == 204
    with SessionLocal() as db:
        event = db.get(models.CalendarEvent, event_id)
        task = db.get(models.Task, task_id)
        rec = db.get(models.RecurringTask, rec_id)
        assert event.category_id is None and event.color_key == "sky"
        assert task.category_id is None and task.color_key == "sky"
        assert rec.category_id is None
        # the seeded class events lost the category but kept the colour
        bio = db.query(models.CalendarEvent).filter_by(title="Bio 101").first()
        assert bio.category_id is None and bio.color_key == "sky"
    assert "Classes" not in _categories(client)


def test_deleting_a_category_can_reassign_items(client):
    cats = _categories(client)
    event_id, task_id, rec_id = _seed_items(cats["Classes"]["id"])
    resp = client.delete(
        f"/api/categories/{cats['Classes']['id']}?reassign_to={cats['Routine']['id']}"
    )
    assert resp.status_code == 204
    routine_id = cats["Routine"]["id"]
    with SessionLocal() as db:
        assert db.get(models.CalendarEvent, event_id).category_id == routine_id
        assert db.get(models.Task, task_id).category_id == routine_id
        assert db.get(models.RecurringTask, rec_id).category_id == routine_id


def test_reassign_target_must_exist_and_differ(client):
    classes = _categories(client)["Classes"]
    assert client.delete(f"/api/categories/{classes['id']}?reassign_to=9999").status_code == 404
    assert client.delete(
        f"/api/categories/{classes['id']}?reassign_to={classes['id']}"
    ).status_code == 422
    with SessionLocal() as db:
        other = models.Student(name="Other")
        db.add(other)
        db.flush()
        foreign = models.Category(student_id=other.id, name="Theirs", color_key="rose")
        db.add(foreign)
        db.commit()
        foreign_id = foreign.id
    assert client.delete(
        f"/api/categories/{classes['id']}?reassign_to={foreign_id}"
    ).status_code == 404
    assert "Classes" in _categories(client)  # nothing was deleted


def test_unknown_ids_return_404(client):
    assert client.get("/api/students/99/calendars").status_code == 404
    assert client.post("/api/students/99/calendars", json={"name": "X"}).status_code == 404
    assert client.get("/api/students/99/categories").status_code == 404
    assert client.post(
        "/api/students/99/categories", json={"name": "X", "color_key": "sky"}
    ).status_code == 404
    assert client.patch("/api/calendars/9999", json={"name": "X"}).status_code == 404
    assert client.delete("/api/calendars/9999").status_code == 404
    assert client.patch("/api/categories/9999", json={"name": "X"}).status_code == 404
    assert client.delete("/api/categories/9999").status_code == 404


# --- calendar events ---------------------------------------------------------------------

EVENTS = "/api/students/1/calendar-events"


def _monday():
    today = datetime.now().date()
    return datetime.combine(today - timedelta(days=today.weekday()), time())


def _week(client, **params):
    start = _monday()
    params = {"start": start.isoformat(), "end": (start + timedelta(days=7)).isoformat(), **params}
    response = client.get(EVENTS, params=params)
    assert response.status_code == 200, response.text
    return response.json()


def _create(client, **overrides):
    start = _monday() + timedelta(days=1, hours=14)
    payload = {"title": "Study group", "start": start.isoformat(),
               "end": (start + timedelta(hours=2)).isoformat()}
    payload.update(overrides)
    response = client.post(EVENTS, json=payload)
    assert response.status_code == 201, response.text
    return response.json()


def test_create_an_event_and_read_it_back(client):
    created = _create(client, description="Library", location="Room 4", category_id=None)
    primary = client.get("/api/students/1/calendars").json()[0]
    assert created["calendar_id"] == primary["id"]  # None means the primary calendar
    assert created["busy"] is True and created["kind"] == "default"
    assert created["status"] == "confirmed" and created["recurrence"] == []
    assert created["color_key"] is None and created["recurring_event_id"] is None
    fetched = client.get(f"/api/calendar-events/{created['id']}")
    assert fetched.status_code == 200 and fetched.json() == created
    assert fetched.json()["location"] == "Room 4"


def test_week_has_seeded_classes_and_sleep(client):
    occurrences = _week(client)
    monday = _monday()
    bio = [o for o in occurrences if o["title"] == "Bio 101"]
    assert sorted(datetime.fromisoformat(o["start"]) for o in bio) == [
        monday + timedelta(hours=9), monday + timedelta(days=2, hours=9),
    ]
    assert all(o["color_key"] == "sky" and o["kind"] == "default" for o in bio)
    assert all(o["recurring"] and o["original_start"] == o["start"] for o in bio)
    assert all(o["id"] == f"{o['event_id']}_{o['start'][:16].replace('-', '').replace(':', '')}"
               for o in bio)
    sleep = [o for o in occurrences if o["title"] == "Sleep"]
    assert sleep and all(o["kind"] == "routine" and o["color_key"] == "stone" for o in sleep)


def test_one_off_occurrence_is_not_recurring(client):
    created = _create(client)
    [one] = [o for o in _week(client) if o["event_id"] == created["id"]]
    assert one["id"] == str(created["id"])
    assert one["recurring"] is False and one["original_start"] is None
    assert one["busy"] is True and one["color_key"] == "sky"  # the calendar's colour


def test_all_day_event_defaults_to_free(client):
    start = _monday()
    created = _create(client, all_day=True, start=start.isoformat(),
                      end=(start + timedelta(days=1)).isoformat())
    assert created["busy"] is False
    forced = _create(client, all_day=True, busy=True, start=start.isoformat(),
                     end=(start + timedelta(days=1)).isoformat())
    assert forced["busy"] is True
    timed = _create(client, busy=False)
    assert timed["busy"] is False


def test_invalid_recurrence_is_422(client):
    for lines in (["RRULE:FREQ=SOMETIMES"], ["DTSTART:20260101T000000"], ["nonsense"]):
        assert client.post(EVENTS, json={
            "title": "X", "start": "2026-03-02T09:00", "end": "2026-03-02T10:00",
            "recurrence": lines,
        }).status_code == 422, lines


def test_sub_daily_recurrence_is_422(client):
    response = client.post(EVENTS, json={
        "title": "X", "start": "2026-03-02T09:00", "end": "2026-03-02T10:00",
        "recurrence": ["RRULE:FREQ=HOURLY"],
    })
    assert response.status_code == 422


def test_interval_zero_and_intra_day_by_parts_are_422(client):
    for lines in (["RRULE:FREQ=DAILY;INTERVAL=0"], ["RRULE:FREQ=DAILY;BYHOUR=1,2,3,4,5"],
                  ["RRULE:FREQ=DAILY;BYMINUTE=0,30"], ["RRULE:FREQ=WEEKLY;BYSECOND=0,1"]):
        assert client.post(EVENTS, json={
            "title": "X", "start": "2026-03-02T09:00", "end": "2026-03-02T10:00",
            "recurrence": lines,
        }).status_code == 422, lines


def test_smuggled_lines_too_many_lines_and_old_series_are_422(client):
    def post(lines, start="2026-03-02T09:00", end="2026-03-02T10:00"):
        return client.post(EVENTS, json={"title": "X", "start": start, "end": end,
                                          "recurrence": lines}).status_code

    for rule in ("RRULE:FREQ=DAILY;INTERVAL=0", "RRULE:FREQ=DAILY;BYMONTH=2;BYMONTHDAY=30",
                 "RRULE:FREQ=MINUTELY"):
        assert post([f"EXDATE:20200101T090000\n{rule}"]) == 422, rule
        assert post([f"EXDATE:20200101T090000 {rule}"]) == 422, rule
    assert post(["RRULE:FREQ=DAILY\nRRULE:FREQ=WEEKLY"]) == 422
    assert post(["RRULE:FREQ=DAILY"] + ["EXDATE:20300101T090000"] * 100) == 422
    assert post(["RRULE:FREQ=DAILY"], "1969-12-31T09:00", "1969-12-31T10:00") == 422
    assert post([], "1969-12-31T09:00", "1969-12-31T10:00") == 201
    created = _create(client)
    url = f"/api/calendar-events/{created['id']}"
    assert client.patch(url, json={"recurrence": ["EXDATE:20200101T090000\nRRULE:FREQ=MINUTELY"]}
                        ).status_code == 422


def test_timezone_aware_dates_and_too_many_values_are_422(client):
    def post(lines):
        return client.post(EVENTS, json={"title": "X", "start": "2026-03-02T09:00",
                                          "end": "2026-03-02T10:00", "recurrence": lines})

    for lines in (["RRULE:FREQ=DAILY", "EXDATE:20260303T090000Z"],
                  ["RRULE:FREQ=DAILY", "RDATE:20260310T090000Z"]):
        assert post(lines).status_code == 422, lines
    days = ",".join((datetime(2026, 3, 3, 9) + timedelta(days=i)).strftime("%Y%m%dT%H%M%S")
                    for i in range(1001))
    t0 = perf_counter()
    assert post(["RRULE:FREQ=DAILY", f"EXDATE:{days}"]).status_code == 422
    assert perf_counter() - t0 < 2


def test_never_matching_recurrence_is_a_fast_422(client):
    t0 = perf_counter()
    response = client.post(EVENTS, json={
        "title": "X", "start": "2026-03-02T09:00", "end": "2026-03-02T10:00",
        "recurrence": ["RRULE:FREQ=DAILY;BYMONTH=2;BYMONTHDAY=30"],
    })
    assert response.status_code == 422
    assert perf_counter() - t0 < 2


def test_a_malformed_stored_series_does_not_break_reads_or_scheduling(client):
    good = _create(client, title="Seminar")
    with SessionLocal() as db:
        primary = db.query(models.Calendar).filter_by(is_primary=True).one()
        db.add(models.CalendarEvent(
            student_id=1, calendar_id=primary.id, title="Broken",
            start=_monday() + timedelta(hours=9), end=_monday() + timedelta(hours=10),
            recurrence=json.dumps(["RRULE:FREQ=SOMETIMES"]),
        ))
        db.commit()
    titles = {o["title"] for o in _week(client)}
    assert "Seminar" in titles and "Broken" not in titles
    assert good["id"] in {o["event_id"] for o in _week(client)}
    assert client.post("/api/students/1/schedule/generate").status_code == 200


def test_recurring_event_expands_across_the_week(client):
    start = _monday() + timedelta(hours=18)
    created = _create(client, title="Gym", start=start.isoformat(),
                      end=(start + timedelta(hours=1)).isoformat(),
                      recurrence=["RRULE:FREQ=DAILY;COUNT=3"])
    gym = [o for o in _week(client) if o["event_id"] == created["id"]]
    assert len(gym) == 3 and all(o["recurring"] for o in gym)


def test_end_must_be_after_start(client):
    base = {"title": "X", "start": "2026-03-02T10:00"}
    assert client.post(EVENTS, json={**base, "end": "2026-03-02T10:00"}).status_code == 422
    assert client.post(EVENTS, json={**base, "end": "2026-03-02T09:00"}).status_code == 422
    assert client.post(EVENTS, json={**base, "end": "2026-03-02T11:00", "title": ""}).status_code == 422
    assert client.post(EVENTS, json={**base, "end": "2026-03-02T11:00Z"}).status_code == 422
    assert client.post(EVENTS, json={**base, "end": "2026-03-02T11:00", "kind": "x"}).status_code == 422


def test_occurrence_range_is_validated(client):
    def get(**params):
        return client.get(EVENTS, params=params).status_code

    assert get() == 422
    assert get(start="2026-03-02T00:00") == 422
    assert get(start="2026-03-02T00:00", end="2026-03-02T00:00") == 422
    assert get(start="2026-03-03T00:00", end="2026-03-02T00:00") == 422
    assert get(start="2026-03-02T00:00", end="2026-07-01T00:00") == 422  # over 120 days
    assert get(start="2026-03-02T00:00", end="2026-06-30T00:00") == 200  # exactly 120 days
    assert get(start="2026-03-02T00:00Z", end="2026-03-03T00:00") == 422
    assert get(start="2026-03-02T00:00", end="2026-03-03T00:00", calendar_ids="a") == 422


def test_calendar_ids_filters_occurrences(client):
    club = client.post("/api/students/1/calendars", json={"name": "Club"}).json()
    created = _create(client, calendar_id=club["id"])
    primary = client.get("/api/students/1/calendars").json()[0]
    only_club = _week(client, calendar_ids=str(club["id"]))
    assert [o["event_id"] for o in only_club] == [created["id"]]
    assert created["id"] not in [o["event_id"] for o in _week(client, calendar_ids=str(primary["id"]))]
    both = _week(client, calendar_ids=f"{primary['id']},{club['id']}")
    assert created["id"] in [o["event_id"] for o in both] and len(both) > 1
    assert created["id"] in [o["event_id"] for o in _week(client)]


def test_setting_a_colour_clears_the_category(client):
    classes = _categories(client)["Classes"]
    created = _create(client, category_id=classes["id"])
    assert created["category_id"] == classes["id"]
    [occ] = [o for o in _week(client) if o["event_id"] == created["id"]]
    assert occ["color_key"] == "sky" and occ["category_id"] == classes["id"]

    routine = _categories(client)["Routine"]
    patched = client.patch(f"/api/calendar-events/{created['id']}", json={"color_key": "rose"})
    assert patched.status_code == 200
    assert patched.json()["category_id"] is None and patched.json()["color_key"] == "rose"
    [occ] = [o for o in _week(client) if o["event_id"] == created["id"]]
    assert occ["color_key"] == "rose" and occ["category_id"] is None

    both = client.patch(f"/api/calendar-events/{created['id']}",
                        json={"color_key": "mint", "category_id": routine["id"]})
    assert both.json()["category_id"] == routine["id"] and both.json()["color_key"] == "mint"

    cleared = client.patch(f"/api/calendar-events/{created['id']}", json={"category_id": None})
    assert cleared.json()["category_id"] is None and cleared.json()["color_key"] == "mint"
    assert client.patch(f"/api/calendar-events/{created['id']}",
                        json={"color_key": "neon"}).status_code == 422


def test_creating_with_a_colour_stores_no_category(client):
    created = _create(client, color_key="lilac")
    assert created["category_id"] is None and created["color_key"] == "lilac"


def test_patch_updates_fields_and_revalidates(client):
    created = _create(client)
    url = f"/api/calendar-events/{created['id']}"
    start = datetime.fromisoformat(created["start"])
    patched = client.patch(url, json={"title": "Exam prep", "busy": False,
                                      "end": (start + timedelta(hours=3)).isoformat()})
    assert patched.status_code == 200
    body = patched.json()
    assert body["title"] == "Exam prep" and body["busy"] is False
    assert datetime.fromisoformat(body["end"]) == start + timedelta(hours=3)

    # Moving only the start past the stored end leaves end <= start.
    assert client.patch(url, json={"start": (start + timedelta(hours=9)).isoformat()}
                        ).status_code == 422
    assert client.patch(url, json={"end": start.isoformat()}).status_code == 422
    assert client.patch(url, json={"recurrence": ["RRULE:FREQ=SOMETIMES"]}).status_code == 422
    assert client.patch(url, json={"recurrence": ["RRULE:FREQ=MINUTELY"]}).status_code == 422
    assert client.patch(url, json={"title": ""}).status_code == 422
    assert client.get(url).json()["title"] == "Exam prep"  # nothing half-applied

    ok = client.patch(url, json={"recurrence": ["RRULE:FREQ=WEEKLY"]})
    assert ok.status_code == 200 and ok.json()["recurrence"] == ["RRULE:FREQ=WEEKLY"]
    assert client.patch(url, json={"recurrence": []}).json()["recurrence"] == []


def test_delete_then_restore_round_trips(client):
    start = _monday() + timedelta(days=-1)  # the event covers the whole week
    created = _create(client, title="Retreat", start=start.isoformat(),
                      end=(start + timedelta(days=9)).isoformat())
    url = f"/api/calendar-events/{created['id']}"
    ids = lambda: [o["event_id"] for o in _week(client)]  # noqa: E731
    assert created["id"] in ids()

    assert client.delete(url).status_code == 204
    assert created["id"] not in ids()
    assert client.get(url).json()["status"] == "cancelled"
    assert client.delete(url).status_code == 204  # idempotent

    window = (_monday(), _monday() + timedelta(days=7))
    with SessionLocal() as db:
        assert not any(s <= window[0] and e >= window[1] for s, e in busy_intervals(db, 1, *window))

    restored = client.post(f"{url}/restore")
    assert restored.status_code == 200 and restored.json()["status"] == "confirmed"
    assert created["id"] in ids()
    with SessionLocal() as db:
        assert any(s <= window[0] and e >= window[1] for s, e in busy_intervals(db, 1, *window))


def test_event_ids_and_references_are_checked(client):
    assert client.get("/api/calendar-events/9999").status_code == 404
    assert client.patch("/api/calendar-events/9999", json={"title": "X"}).status_code == 404
    assert client.delete("/api/calendar-events/9999").status_code == 404
    assert client.post("/api/calendar-events/9999/restore").status_code == 404
    assert client.get("/api/students/99/calendar-events",
                      params={"start": "2026-03-02T00:00", "end": "2026-03-03T00:00"}
                      ).status_code == 404
    body = {"title": "X", "start": "2026-03-02T09:00", "end": "2026-03-02T10:00"}
    assert client.post("/api/students/99/calendar-events", json=body).status_code == 404
    assert client.post(EVENTS, json={**body, "calendar_id": 9999}).status_code == 404
    assert client.post(EVENTS, json={**body, "category_id": 9999}).status_code == 404
    created = _create(client)
    url = f"/api/calendar-events/{created['id']}"
    assert client.patch(url, json={"calendar_id": 9999}).status_code == 404
    assert client.patch(url, json={"category_id": 9999}).status_code == 404


def test_another_students_calendar_or_category_is_404(client):
    with SessionLocal() as db:
        other = models.Student(name="Other")
        db.add(other)
        db.flush()
        calendar = models.Calendar(student_id=other.id, name="Theirs", color_key="rose")
        category = models.Category(student_id=other.id, name="Theirs", color_key="rose")
        db.add_all([calendar, category])
        db.commit()
        calendar_id, category_id = calendar.id, category.id
    body = {"title": "X", "start": "2026-03-02T09:00", "end": "2026-03-02T10:00"}
    assert client.post(EVENTS, json={**body, "calendar_id": calendar_id}).status_code == 404
    assert client.post(EVENTS, json={**body, "category_id": category_id}).status_code == 404
    created = _create(client)
    url = f"/api/calendar-events/{created['id']}"
    assert client.patch(url, json={"calendar_id": calendar_id}).status_code == 404
    assert client.patch(url, json={"category_id": category_id}).status_code == 404


def test_edited_instance_reports_the_series_id(client):
    start = _monday() + timedelta(hours=18)
    series = _create(client, title="Gym", start=start.isoformat(),
                     end=(start + timedelta(hours=1)).isoformat(),
                     recurrence=["RRULE:FREQ=DAILY;COUNT=3"])
    second = start + timedelta(days=1)
    with SessionLocal() as db:
        parent = db.get(models.CalendarEvent, series["id"])
        db.add(models.CalendarEvent(
            student_id=1, calendar_id=parent.calendar_id, title="Gym (moved)",
            start=second + timedelta(hours=2), end=second + timedelta(hours=3),
            recurring_event_id=parent.id, original_start_time=second,
        ))
        db.commit()
    gym = [o for o in _week(client) if o["event_id"] == series["id"]]
    assert len(gym) == 3
    [moved] = [o for o in gym if o["title"] == "Gym (moved)"]
    assert moved["id"] == f"{series['id']}_{second:%Y%m%dT%H%M}"
    assert moved["recurring"] is True and datetime.fromisoformat(moved["original_start"]) == second
    assert datetime.fromisoformat(moved["start"]) == second + timedelta(hours=2)
