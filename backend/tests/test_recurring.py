"""Recurring routine templates: CRUD, materialisation, and pipeline reuse."""
from datetime import datetime

STUDENT = 1
TODAY_WEEKDAY = datetime.now().weekday()


def new_recurring_task(client, **overrides):
    payload = {
        "title": "Gym",
        "task_type": "routine",
        "estimated_duration": 60,
        "grade_weight": 0,
        "stress_rating": 2,
        "weekdays": [TODAY_WEEKDAY],
        "due_time": "21:00",
    }
    payload.update(overrides)
    response = client.post(f"/api/students/{STUDENT}/recurring-tasks", json=payload)
    assert response.status_code == 201, response.text
    return response.json()


def test_create_recurring_task_returns_template(client):
    row = new_recurring_task(client, weekdays=[0, 2, 4], due_time="18:00")
    assert row["weekdays"] == [0, 2, 4]
    assert row["due_time"] == "18:00"
    assert row["active"] is True


def test_invalid_weekday_is_rejected(client):
    response = client.post(
        f"/api/students/{STUDENT}/recurring-tasks",
        json={
            "title": "Bad", "estimated_duration": 30, "weekdays": [7], "due_time": "12:00",
        },
    )
    assert response.status_code == 422


def test_creating_a_recurring_task_materializes_this_weeks_occurrence(client):
    template = new_recurring_task(client, title="Laundry")
    tasks = client.get(f"/api/students/{STUDENT}/tasks").json()
    matches = [t for t in tasks if t["title"] == "Laundry"]
    assert len(matches) == 1
    assert matches[0]["recurring_task_id"] == template["id"]
    assert matches[0]["task_type"] == "routine"


def test_materialization_is_idempotent_within_the_window(client):
    new_recurring_task(client, title="Meal prep")
    first = [t for t in client.get(f"/api/students/{STUDENT}/tasks").json() if t["title"] == "Meal prep"]
    second = [t for t in client.get(f"/api/students/{STUDENT}/tasks").json() if t["title"] == "Meal prep"]
    assert len(first) == len(second) == 1


def test_completed_instance_is_not_resurrected(client):
    new_recurring_task(client, title="Water plants")
    tasks = client.get(f"/api/students/{STUDENT}/tasks").json()
    task = next(t for t in tasks if t["title"] == "Water plants")

    client.post(f"/api/tasks/{task['id']}/complete")
    again = [t for t in client.get(f"/api/students/{STUDENT}/tasks").json() if t["title"] == "Water plants"]
    assert len(again) == 1
    assert again[0]["status"] == "done"


def test_pausing_stops_new_materialization_but_keeps_existing_instances(client):
    template = new_recurring_task(client, title="Call home")
    before = [t for t in client.get(f"/api/students/{STUDENT}/tasks").json() if t["title"] == "Call home"]
    assert len(before) == 1

    response = client.patch(f"/api/recurring-tasks/{template['id']}", json={"active": False})
    assert response.status_code == 200 and response.json()["active"] is False

    after = [t for t in client.get(f"/api/students/{STUDENT}/tasks").json() if t["title"] == "Call home"]
    assert len(after) == 1
    assert after[0]["id"] == before[0]["id"]


def test_deleting_a_template_leaves_materialized_tasks_as_standalone(client):
    template = new_recurring_task(client, title="Groceries")
    tasks = client.get(f"/api/students/{STUDENT}/tasks").json()
    task = next(t for t in tasks if t["title"] == "Groceries")

    response = client.delete(f"/api/recurring-tasks/{template['id']}")
    assert response.status_code == 204

    survivor = client.get(f"/api/tasks/{task['id']}")
    assert survivor.status_code == 200
    assert survivor.json()["recurring_task_id"] is None


def test_recurring_instances_flow_through_generate_schedule(client):
    new_recurring_task(client, title="Gym session", estimated_duration=45)
    schedule = client.post(f"/api/students/{STUDENT}/schedule/generate").json()
    matches = [s for s in schedule["slots"] if s["title"] == "Gym session"]
    assert matches
    assert matches[0]["recurring"] is True


def test_recurring_instances_are_scored_like_any_other_task(client):
    new_recurring_task(client, title="Big chore", grade_weight=80, stress_rating=1)
    preview = client.post(
        f"/api/students/{STUDENT}/weights/preview",
        json={"w_urgency": 0.0, "w_grade": 1.0, "w_stress": 0.0, "w_effort_gap": 0.0, "limit": 5},
    ).json()
    assert preview["ranked"][0]["title"] == "Big chore"


def test_unknown_recurring_task_is_a_404(client):
    assert client.get("/api/recurring-tasks/99999").status_code == 404
    assert client.patch("/api/recurring-tasks/99999", json={"active": False}).status_code == 404
    assert client.delete("/api/recurring-tasks/99999").status_code == 404


def test_recurring_task_scoped_to_unknown_student_is_a_404(client):
    response = client.post(
        "/api/students/99999/recurring-tasks",
        json={
            "title": "X", "estimated_duration": 30, "weekdays": [TODAY_WEEKDAY], "due_time": "12:00",
        },
    )
    assert response.status_code == 404
