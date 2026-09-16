"""End-to-end tests over the API: input -> decompose -> score -> schedule."""
from datetime import datetime, timedelta

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
    assert settings["fixed_blocks"] and settings["productive_hours"]
    assert settings["weights"]["w_urgency"] == 0.4


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


def test_adding_a_fixed_block_keeps_the_scheduler_out_of_it(client):
    client.post(f"/api/students/{STUDENT}/fixed-blocks", json={
        "kind": "class", "label": "All-day retreat", "day_of_week": None,
        "start_time": "00:00", "end_time": "23:59"})
    new_task(client, estimated_duration=60)
    schedule = client.post(f"/api/students/{STUDENT}/schedule/generate").json()
    assert schedule["slots"] == []
    assert schedule["unschedulable"]


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
