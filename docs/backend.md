# Backend

FastAPI + SQLAlchemy + Pydantic on Python 3.12, backed by SQLite. Entry point:
`backend/app/main.py`. On startup it bootstraps the database and seeds student 1
(`seed.py`).

## Layout

| Path | Role |
|---|---|
| `app/scoring.py` | `priority_score` and `rank`. Pure functions. |
| `app/decompose.py` | Essay-phase and exam-session rules. Pure functions. |
| `app/scheduler.py` | Free-slot construction and greedy placement. Pure functions. |
| `app/recurrence.py` | Validates and expands RRULE/EXDATE/RDATE lines into occurrences. Pure. |
| `app/calendar_service.py` | `load_occurrences`, `busy_intervals`, `effective_color`. |
| `app/calendar_defaults.py` | Primary calendar, default categories, and the weekly sleep/lunch/class seed. |
| `app/migrations.py` | `add_missing_columns` and the `schema_migrations` data migrations. |
| `app/pipeline.py` | The only module that joins the above to SQLAlchemy. Also materialises recurring templates and writes the event log. |
| `app/models.py` | SQLAlchemy models plus the `TASK_TYPES`, `COLOR_KEYS` and `EVENT_TYPES` vocabularies. |
| `app/schemas.py` | Pydantic request/response models (mirrored in `frontend/src/types/api.ts`). |
| `app/chat.py` | Chat providers (echo stub, Anthropic). |
| `app/api/` | FastAPI routers, one per resource. |
| `app/db.py` | Engine/session. `TASK_SCHEDULER_DB` overrides the file path. |
| `seed_demo.py` | Loads demo tasks. |
| `requirements.txt` | Pinned dependencies. |

## API

Everything sits under `/api`, and Swagger is at `/docs`. `{sid}` is the student id (always `1`).

| Router | Endpoints |
|---|---|
| `students.py` | `GET /students/{sid}/settings` · `POST`/`DELETE` productive hours · `GET`/`PUT /students/{sid}/weights` · `POST …/weights/preview` |
| `tasks.py` | CRUD on `/students/{sid}/tasks` and `/tasks/{id}` · `POST /tasks/{id}/complete` and `/skip` · `POST /subtasks/{id}/complete` and `/skip` |
| `recurring.py` | CRUD on `/students/{sid}/recurring-tasks` and `/recurring-tasks/{id}` |
| `schedule.py` | `GET /students/{sid}/schedule` · `POST …/generate` · `POST …/slots/{id}/reschedule` |
| `calendar.py` | `GET`/`POST /students/{sid}/calendars` · `PATCH`/`DELETE /calendars/{id}` (not the primary) · `GET`/`POST /students/{sid}/categories` · `PATCH`/`DELETE /categories/{id}` (`?reassign_to=`) · `GET /students/{sid}/calendar-events?start&end[&calendar_ids]` (occurrences, max 120 days) · `POST /students/{sid}/calendar-events` · `GET`/`PATCH`/`DELETE /calendar-events/{id}` · `POST /calendar-events/{id}/restore` |
| `events.py` | `GET`/`POST /students/{sid}/events` |
| `chat.py` | `POST /students/{sid}/chat` (SSE) · `GET …/chat/provider` |

## Scoring (`scoring.py`)

```
score = w_urgency·(1 / max(days_until_due, 0.5))
      + w_grade·(grade_weight / 100)
      + w_stress·(stress_rating / 5)
      + w_effort_gap·clamp((estimate − invested) / estimate, 0, 1)
```

Default weights: urgency 0.4, grade 0.3, stress 0.15, effort gap 0.15 (editable per student).
Urgency is deliberately unbounded so work due within hours dominates. Ties break on the earlier
due date, then on id, so the order is reproducible.

## Decomposition (`decompose.py`)

- **Essay/project** longer than 3 h splits into research 20% · outline 10% · **draft 50%
  (needs a productive-hour slot)** · revise 20%. Phase deadlines are spaced evenly to the due date.
- **Exam study** becomes spaced sessions at 10 / 6 / 3 / 1 days before the exam. Sessions already
  in the past are dropped, and an imminent exam gets a single cram session.
- Other types are never decomposed. Subtasks are at least 15 minutes.

## Scheduling (`scheduler.py`)

Builds free slots over a 7-day horizon (`build_free_slots(busy, productive_windows, ...)`: the day
minus absolute busy intervals, minimum 15 min). `pipeline` supplies the busy intervals from
`calendar_service.busy_intervals`; `expand_weekly` still expands the weekly productive windows. Then it places
ranked items greedily: focus work (essays, exams) goes into productive windows, subtasks respect
`predecessor_ids` order, and overdue work is placed ASAP when `SCHEDULE_OVERDUE_ASAP` is set. An
item that can't be placed is returned as unschedulable with a diagnosed reason.

## Calendar events

- `GET …/calendar-events` returns **occurrences** in a range, including ones that straddle its
  edges. Series are expanded in `recurrence.py`; a malformed `recurrence` is a 422.
- **Recurrence rules** (`validate_recurrence`, run on create/PATCH): at most 100 items and at most
  1000 EXDATE + RDATE values in total (comma-separated values count individually), each item one
  `RRULE:`, `EXDATE:` or `RDATE:` line with no whitespace or control characters (rrulestr would
  re-split them into extra, unchecked lines); a recurring event starts in 1970 or later; `FREQ`
  daily or coarser, with no `BYHOUR`/`BYMINUTE`/`BYSECOND` (nothing repeats within a day) and no
  `BYEASTER`; `INTERVAL` ≥ 1 (dateutil loops forever on 0). Each RRULE must have an instance within
  5 years of `start`, so never-matching rules (Feb 30) are rejected. The probe runs on the rule
  moved by whole 400-year Gregorian cycles to near year 9999, because dateutil scans to 9999 for a
  rule with no match, even past `UNTIL`/`COUNT`; worst case ~0.25 s. Finally the whole set is
  iterated once (bounded by then), which rejects timezone-aware (`Z`/offset) EXDATE/RDATE values:
  all datetimes are naive local time. `expand` repeats only the cheap static checks and turns
  iteration errors into `RecurrenceError`. A stored series that fails is skipped with a warning in
  `calendar_service.load_occurrences`, so one bad row can't break the calendar or scheduling.
- **DELETE is a soft delete** (`status=cancelled`); `/restore` reverses it. Hidden calendars
  (`visible=false`) still block scheduling; Free events don't.
- **Colour rule** (`effective_color`): category colour, else the event's `color_key`, else the
  calendar colour. Setting `color_key` without `category_id` clears the category. Deleting a
  category without `reassign_to` copies its colour onto its events and tasks.
- **Upgrades:** startup runs `add_missing_columns`, then each unrecorded data migration. Seeded
  and migrated series start on the Monday of the week before the current week.
- `/meta` returns `colors`. The fixed-block routes and `settings.fixed_blocks` are gone.

## Recurring tasks (`pipeline.materialize_recurring_tasks`)

Routine templates (title, duration, weekdays, due time) are rolled forward into ordinary `Task`
rows whenever the task list or schedule is read. This is lazy and idempotent, keyed on one
instance per template per calendar day. `recurring_task_id` on the response marks generated
tasks. Pausing a template stops future instances. Deleting one leaves past instances as ordinary
tasks.

## Chat (`chat.py`)

`CHAT_PROVIDER` selects a provider from `PROVIDERS`. The default `echo` is a no-network stub that
names the fields it recognised. `anthropic` uses `AnthropicProvider` (needs `ANTHROPIC_API_KEY`
and the SDK). An unknown name is an error, never a silent fallback. A provider is any class with
`stream(messages) -> Iterator[str]`. The endpoint emits provider-independent SSE events (`delta`
/ `done` / `error`), so the frontend doesn't change when the provider does. Chat never touches
placement.

## Tests

`cd backend && ../.venv/bin/python -m pytest -q`

| File | Covers |
|---|---|
| `test_scoring.py`, `test_decompose.py`, `test_scheduler.py` | Algorithm modules in isolation (no DB, no HTTP). |
| `test_api.py` | The wired pipeline through the HTTP API. |
| `test_recurring.py` | Template materialisation. |
| `test_recurrence.py` | Pure RRULE/EXDATE/RDATE expansion. |
| `test_calendar_api.py`, `test_calendar_events.py` | Calendars, categories, events, colour rule, soft delete, scheduler busy time. |
| `test_migrations.py` | In-place upgrade of an old database; migrations run once. |
| `test_chat.py` | Provider contract and SSE format. |

Any behaviour change in the algorithm modules comes with tests, and those modules must stay free
of DB/HTTP imports.
