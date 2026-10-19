"""Calendars and categories endpoints."""
from datetime import datetime

from app import models
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
