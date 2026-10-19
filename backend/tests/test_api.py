"""End-to-end tests over the API: input -> decompose -> score -> schedule."""
from datetime import datetime, time, timedelta

from app.models import COLOR_KEYS

STUDENT = 1


def iso(days=0, hours=0):
    return (datetime.now() + timedelta(days=days, hours=hours)).replace(
        microsecond=0
    ).isoformat()


def new_task(client, **overrides):
    payload = {
        "title": "Test task",
        "due_date": iso(days=5),
        "estimated_duration": 120,
        "task_type": "other",
        "grade_weight": 20,
        "stress_rating": 3,
    }
    payload.update(overrides)
    response = client.post(f"/api/students/{STUDENT}/tasks", json=payload)
    assert response.status_code == 201, response.text
    return response.json()


def test_health_and_seeded_student(client):
    assert client.get("/api/health").json() == {"status": "ok"}
    settings = client.get(f"/api/students/{STUDENT}/settings").json()
    assert settings["student"]["name"] == "Test Student"
    assert "fixed_blocks" not in settings
    assert settings["productive_hours"]
    assert settings["weights"]["w_urgency"] == 0.4
    meta = client.get("/api/meta").json()
    assert meta["colors"] == COLOR_KEYS
    assert "block_kinds" not in meta


def test_create_task_decomposes_a_long_essay(client):
    task = new_task(client, title="Ethics paper", task_type="essay_project",
                    estimated_duration=600, due_date=iso(days=12))
    assert [s["phase"] for s in task["subtasks"]] == ["research", "outline", "draft", "revise"]
    assert sum(s["estimated_duration"] for s in task["subtasks"]) == 600


def test_create_task_decomposes_exam_study_into_spaced_sessions(client):
    task = new_task(client, title="Bio midterm", task_type="exam_study",
                    estimated_duration=480, due_date=iso(days=14))
    assert len(task["subtasks"]) == 4
    assert all(s["requires_focus"] for s in task["subtasks"])


def test_plain_task_is_not_decomposed(client):
    assert new_task(client, task_type="problem_set")["subtasks"] == []


def test_editing_the_duration_rebuilds_the_subtasks(client):
    task = new_task(client, task_type="essay_project", estimated_duration=600,
                    due_date=iso(days=12))
    updated = client.patch(f"/api/tasks/{task['id']}",
                           json={"estimated_duration": 120}).json()
    assert updated["subtasks"] == []  # now under the 3-hour threshold


def test_editing_the_stress_rating_leaves_subtasks_alone(client):
    task = new_task(client, task_type="essay_project", estimated_duration=600,
                    due_date=iso(days=12))
    ids = [s["id"] for s in task["subtasks"]]
    updated = client.patch(f"/api/tasks/{task['id']}", json={"stress_rating": 5}).json()
    assert [s["id"] for s in updated["subtasks"]] == ids


def test_generate_schedule_places_work_without_double_booking(client):
    new_task(client, title="Ethics paper", task_type="essay_project",
             estimated_duration=600, due_date=iso(days=12), grade_weight=35)
    new_task(client, title="Bio midterm", task_type="exam_study",
             estimated_duration=240, due_date=iso(days=13), grade_weight=25)
    new_task(client, title="Problem set", task_type="problem_set",
             estimated_duration=90, due_date=iso(days=3))

    schedule = client.post(f"/api/students/{STUDENT}/schedule/generate").json()
    slots = sorted(schedule["slots"], key=lambda s: s["start_time"])
    assert slots
    for a, b in zip(slots, slots[1:]):
        assert a["end_time"] <= b["start_time"]
    for slot in slots:
        if slot["requires_focus"]:
            assert slot["in_productive_hours"]


def test_generated_schedule_is_readable_without_regenerating(client):
    new_task(client, estimated_duration=60)
    generated = client.post(f"/api/students/{STUDENT}/schedule/generate").json()
    fetched = client.get(f"/api/students/{STUDENT}/schedule").json()
    assert [s["id"] for s in fetched["slots"]] == [s["id"] for s in generated["slots"]]


def test_regenerating_replaces_rather_than_duplicates(client):
    new_task(client, estimated_duration=60)
    first = client.post(f"/api/students/{STUDENT}/schedule/generate").json()
    second = client.post(f"/api/students/{STUDENT}/schedule/generate").json()
    assert len(second["slots"]) == len(first["slots"])


def test_unschedulable_work_is_surfaced_with_a_reason(client):
    new_task(client, title="Impossible", estimated_duration=60 * 30, due_date=iso(days=4))
    schedule = client.post(f"/api/students/{STUDENT}/schedule/generate").json()
    assert schedule["unschedulable"]
    entry = schedule["unschedulable"][0]
    assert entry["title"] == "Impossible" and entry["reason"]


def test_weights_sliders_change_the_ordering_of_the_plan(client):
    new_task(client, title="Big essay", task_type="reading", estimated_duration=60,
             due_date=iso(days=6), grade_weight=90, stress_rating=1)
    new_task(client, title="Quick chore", task_type="admin", estimated_duration=60,
             due_date=iso(days=1), grade_weight=0, stress_rating=1)

    urgency_first = client.post(f"/api/students/{STUDENT}/schedule/generate").json()["slots"]
    assert urgency_first[0]["title"] == "Quick chore"

    client.put(f"/api/students/{STUDENT}/weights", json={
        "w_urgency": 0.0, "w_grade": 1.0, "w_stress": 0.0, "w_effort_gap": 0.0})
    grade_first = client.post(f"/api/students/{STUDENT}/schedule/generate").json()["slots"]
    assert grade_first[0]["title"] == "Big essay"


def test_completing_a_task_removes_it_from_the_plan_and_logs_the_event(client):
    task = new_task(client, estimated_duration=60)
    client.post(f"/api/students/{STUDENT}/schedule/generate")
    client.post(f"/api/tasks/{task['id']}/complete")

    remaining = client.get(f"/api/students/{STUDENT}/schedule").json()["slots"]
    assert all(s["task_id"] != task["id"] for s in remaining)

    events = client.get(f"/api/students/{STUDENT}/events").json()
    assert any(e["event_type"] == "completed" and e["task_id"] == task["id"] for e in events)


def test_skipping_a_subtask_logs_it_and_frees_the_slot(client):
    task = new_task(client, task_type="essay_project", estimated_duration=600,
                    due_date=iso(days=12))
    subtask = task["subtasks"][0]
    client.post(f"/api/students/{STUDENT}/schedule/generate")
    client.post(f"/api/subtasks/{subtask['id']}/skip")

    events = client.get(f"/api/students/{STUDENT}/events").json()
    assert any(e["event_type"] == "skipped" and e["subtask_id"] == subtask["id"] for e in events)


def test_completing_every_subtask_completes_the_parent(client):
    task = new_task(client, task_type="essay_project", estimated_duration=600,
                    due_date=iso(days=12))
    for subtask in task["subtasks"]:
        client.post(f"/api/subtasks/{subtask['id']}/complete")
    assert client.get(f"/api/tasks/{task['id']}").json()["status"] == "done"


def test_dragging_a_slot_logs_a_reschedule_event(client):
    new_task(client, estimated_duration=60)
    slots = client.post(f"/api/students/{STUDENT}/schedule/generate").json()["slots"]
    slot = slots[0]
    moved_start = iso(days=2, hours=1)
    moved_end = iso(days=2, hours=2)

    response = client.post(
        f"/api/students/{STUDENT}/schedule/slots/{slot['id']}/reschedule",
        json={"start_time": moved_start, "end_time": moved_end},
    )
    assert response.status_code == 200
    events = client.get(f"/api/students/{STUDENT}/events").json()
    assert any(e["event_type"] == "rescheduled" for e in events)


def test_reschedule_rejects_an_inverted_time_range(client):
    new_task(client, estimated_duration=60)
    slot = client.post(f"/api/students/{STUDENT}/schedule/generate").json()["slots"][0]
    response = client.post(
        f"/api/students/{STUDENT}/schedule/slots/{slot['id']}/reschedule",
        json={"start_time": iso(days=2, hours=3), "end_time": iso(days=2, hours=1)},
    )
    assert response.status_code == 422


def _today_at_midnight(days=0):
    start = datetime.combine(datetime.now().date(), time()) + timedelta(days=days)
    return start.isoformat()


def _busy_all_week(client, **overrides):
    payload = {"title": "Retreat", "start": _today_at_midnight(),
               "end": _today_at_midnight(days=8), "busy": True}
    payload.update(overrides)
    response = client.post(f"/api/students/{STUDENT}/calendar-events", json=payload)
    assert response.status_code == 201, response.text
    return response.json()


def test_a_busy_all_week_event_keeps_the_scheduler_out(client):
    _busy_all_week(client)
    new_task(client, estimated_duration=60)
    schedule = client.post(f"/api/students/{STUDENT}/schedule/generate").json()
    assert schedule["slots"] == []
    assert schedule["unschedulable"]


def test_a_free_event_does_not_block_the_scheduler(client):
    _busy_all_week(client, busy=False)
    new_task(client, estimated_duration=60)
    schedule = client.post(f"/api/students/{STUDENT}/schedule/generate").json()
    assert schedule["slots"]


def test_an_event_on_a_hidden_calendar_still_blocks(client):
    calendar = client.post(f"/api/students/{STUDENT}/calendars", json={"name": "Away"}).json()
    hidden = client.patch(f"/api/calendars/{calendar['id']}", json={"visible": False})
    assert hidden.status_code == 200 and hidden.json()["visible"] is False
    _busy_all_week(client, calendar_id=calendar["id"])
    new_task(client, estimated_duration=60)
    schedule = client.post(f"/api/students/{STUDENT}/schedule/generate").json()
    assert schedule["slots"] == []


def test_tonights_sleep_still_blocks_tomorrow_morning(client):
    """Review Focus 2 end to end: the seeded 23:30-07:30 Sleep blocks every night."""
    for index in range(30):
        new_task(client, title=f"Reading {index}", task_type="reading",
                 estimated_duration=90, due_date=iso(days=6))
    slots = client.post(f"/api/students/{STUDENT}/schedule/generate").json()["slots"]
    assert slots

    today = datetime.combine(datetime.now().date(), time())
    nights = [
        (today + timedelta(days=d, hours=23, minutes=30),
         today + timedelta(days=d + 1, hours=7, minutes=30))
        for d in range(-1, 9)
    ]
    for slot in slots:
        start = datetime.fromisoformat(slot["start_time"])
        end = datetime.fromisoformat(slot["end_time"])
        assert not time(7, 0) <= start.time() < time(7, 30), slot
        for night_start, night_end in nights:
            assert not (start < night_end and end > night_start), (slot, night_start)


def test_productive_windows_can_be_added_and_removed(client):
    created = client.post(f"/api/students/{STUDENT}/productive-hours", json={
        "label": "Dawn", "day_of_week": 1, "start_time": "05:00", "end_time": "07:00"}).json()
    assert created["start_time"] == "05:00"
    assert client.delete(
        f"/api/students/{STUDENT}/productive-hours/{created['id']}").status_code == 204


def test_invalid_task_type_is_rejected(client):
    response = client.post(f"/api/students/{STUDENT}/tasks", json={
        "title": "x", "due_date": iso(days=1), "estimated_duration": 60,
        "task_type": "nonsense"})
    assert response.status_code == 422


def test_invalid_stress_rating_is_rejected(client):
    response = client.post(f"/api/students/{STUDENT}/tasks", json={
        "title": "x", "due_date": iso(days=1), "estimated_duration": 60,
        "stress_rating": 9})
    assert response.status_code == 422


def test_unknown_student_is_a_404(client):
    assert client.get("/api/students/999/settings").status_code == 404


def test_essay_phases_are_scheduled_in_order_end_to_end(client):
    task = new_task(client, title="Ethics paper", task_type="essay_project",
                    estimated_duration=300, due_date=iso(days=10), grade_weight=35)
    schedule = client.post(f"/api/students/{STUDENT}/schedule/generate").json()

    by_subtask = {s["subtask_id"]: s for s in schedule["slots"]}
    placed = [by_subtask[s["id"]] for s in task["subtasks"] if s["id"] in by_subtask]
    # Phases appear on the calendar in the same order the decomposer emitted them.
    for earlier, later in zip(placed, placed[1:]):
        assert earlier["end_time"] <= later["start_time"]


def test_weights_preview_ranks_without_saving(client):
    new_task(client, title="Low stakes", grade_weight=0, stress_rating=1, due_date=iso(days=9))
    new_task(client, title="High stakes", grade_weight=90, stress_rating=5, due_date=iso(days=9))

    before = client.get(f"/api/students/{STUDENT}/weights").json()
    body = client.post(f"/api/students/{STUDENT}/weights/preview", json={
        "w_urgency": 0.0, "w_grade": 1.0, "w_stress": 0.0, "w_effort_gap": 0.0}).json()

    assert body["ranked"][0]["title"] == "High stakes"
    assert body["total_pending"] == 2
    # A preview is a question, not a change.
    assert client.get(f"/api/students/{STUDENT}/weights").json() == before


def test_weights_preview_follows_the_sliders(client):
    new_task(client, title="Due soon", grade_weight=0, stress_rating=1, due_date=iso(days=1))
    new_task(client, title="Heavy but distant", grade_weight=90, stress_rating=1,
             due_date=iso(days=20))

    urgency_first = client.post(f"/api/students/{STUDENT}/weights/preview", json={
        "w_urgency": 1.0, "w_grade": 0.0, "w_stress": 0.0, "w_effort_gap": 0.0}).json()
    grade_first = client.post(f"/api/students/{STUDENT}/weights/preview", json={
        "w_urgency": 0.0, "w_grade": 1.0, "w_stress": 0.0, "w_effort_gap": 0.0}).json()

    assert urgency_first["ranked"][0]["title"] == "Due soon"
    assert grade_first["ranked"][0]["title"] == "Heavy but distant"


def test_weights_preview_names_the_parent_of_a_subtask(client):
    client.post(f"/api/students/{STUDENT}/tasks", json={
        "title": "Ethics paper", "due_date": iso(days=10), "estimated_duration": 300,
        "task_type": "essay_project", "grade_weight": 35})

    body = client.post(f"/api/students/{STUDENT}/weights/preview", json={
        "w_urgency": 0.4, "w_grade": 0.3, "w_stress": 0.15, "w_effort_gap": 0.15}).json()

    top = body["ranked"][0]
    assert top["subtask_id"] is not None
    assert top["parent_title"] == "Ethics paper"
    assert top["task_type"] == "essay_project"


def test_weights_preview_honours_the_limit(client):
    for index in range(6):
        new_task(client, title=f"Task {index}")
    body = client.post(f"/api/students/{STUDENT}/weights/preview", json={
        "w_urgency": 0.4, "w_grade": 0.3, "w_stress": 0.15, "w_effort_gap": 0.15,
        "limit": 3}).json()
    assert len(body["ranked"]) == 3
    assert body["total_pending"] == 6


def test_weights_preview_on_an_empty_week(client):
    body = client.post(f"/api/students/{STUDENT}/weights/preview", json={
        "w_urgency": 0.4, "w_grade": 0.3, "w_stress": 0.15, "w_effort_gap": 0.15}).json()
    assert body == {"ranked": [], "total_pending": 0}


def _category(client, name):
    return {c["name"]: c for c in client.get(f"/api/students/{STUDENT}/categories").json()}[name]


def test_task_category_and_colour_round_trip(client):
    classes = _category(client, "Classes")
    created = new_task(client, category_id=classes["id"], color_key="mint")
    assert created["category_id"] == classes["id"]
    assert created["color_key"] == "mint"

    fetched = client.get(f"/api/tasks/{created['id']}").json()
    assert (fetched["category_id"], fetched["color_key"]) == (classes["id"], "mint")

    plain = new_task(client)
    assert plain["category_id"] is None and plain["color_key"] is None

    assert client.patch(f"/api/tasks/{plain['id']}", json={"category_id": classes["id"]}
                        ).json()["category_id"] == classes["id"]
    assert client.patch(f"/api/tasks/{plain['id']}", json={"category_id": None}
                        ).json()["category_id"] is None


def test_setting_a_task_colour_clears_its_category(client):
    classes = _category(client, "Classes")
    task = new_task(client, category_id=classes["id"])
    updated = client.patch(f"/api/tasks/{task['id']}", json={"color_key": "lilac"}).json()
    assert updated["color_key"] == "lilac"
    assert updated["category_id"] is None

    # Sending both keeps both.
    both = client.patch(f"/api/tasks/{task['id']}",
                        json={"color_key": "rose", "category_id": classes["id"]}).json()
    assert (both["color_key"], both["category_id"]) == ("rose", classes["id"])


def test_task_rejects_bad_colour_and_foreign_or_unknown_category(client):
    from app import models
    from app.db import SessionLocal

    task = new_task(client)
    assert client.patch(f"/api/tasks/{task['id']}", json={"color_key": "neon"}).status_code == 422
    assert client.patch(f"/api/tasks/{task['id']}", json={"category_id": 9999}).status_code == 404

    with SessionLocal() as db:
        other = models.Student(name="Other")
        db.add(other)
        db.flush()
        foreign = models.Category(student_id=other.id, name="Theirs", color_key="rose")
        db.add(foreign)
        db.commit()
        foreign_id = foreign.id
    assert client.patch(f"/api/tasks/{task['id']}", json={"category_id": foreign_id}
                        ).status_code == 404
    response = client.post(f"/api/students/{STUDENT}/tasks", json={
        "title": "x", "due_date": iso(days=5), "estimated_duration": 60,
        "category_id": foreign_id,
    })
    assert response.status_code == 404
    assert client.get(f"/api/tasks/{task['id']}").json()["category_id"] is None


def test_changing_task_colour_keeps_subtasks(client):
    task = new_task(client, task_type="essay_project", estimated_duration=600,
                    due_date=iso(days=12))
    ids = [s["id"] for s in task["subtasks"]]
    assert ids
    updated = client.patch(f"/api/tasks/{task['id']}", json={"color_key": "aqua"}).json()
    assert [s["id"] for s in updated["subtasks"]] == ids
    classes = _category(client, "Classes")
    updated = client.patch(f"/api/tasks/{task['id']}", json={"category_id": classes["id"]}).json()
    assert [s["id"] for s in updated["subtasks"]] == ids


def test_slot_reports_task_colour_and_category(client):
    classes = next(
        c for c in client.get(f"/api/students/{STUDENT}/categories").json() if c["name"] == "Classes"
    )
    new_task(client, title="In class", category_id=classes["id"])
    new_task(client, title="Minty", color_key="mint")
    new_task(client, title="Plain")
    slots = client.post(f"/api/students/{STUDENT}/schedule/generate").json()["slots"]
    by_title = {s["title"]: s for s in slots}
    assert by_title["In class"]["color_key"] == "sky"
    assert by_title["In class"]["category_id"] == classes["id"]
    assert by_title["Minty"]["color_key"] == "mint" and by_title["Minty"]["category_id"] is None
    assert by_title["Plain"]["color_key"] is None and by_title["Plain"]["category_id"] is None


def test_subtask_slots_use_the_parent_task_colour(client):
    new_task(client, title="Big essay", task_type="essay_project", estimated_duration=600,
             due_date=iso(days=12), color_key="rose")
    slots = client.post(f"/api/students/{STUDENT}/schedule/generate").json()["slots"]
    sub = [s for s in slots if s["subtask_id"] is not None]
    assert sub and all(s["color_key"] == "rose" for s in sub)
