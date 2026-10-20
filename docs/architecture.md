# Architecture

The technical reference for Sype. Area-specific detail lives in [backend.md](backend.md),
[frontend.md](frontend.md) and [ml.md](ml.md). How to run it is in [setup.md](setup.md).

## Core principle

**No LLM decides the schedule.** Prioritisation, decomposition and placement are deterministic,
rule-based Python, unit-tested in isolation. The chat is a deliberate, opt-in exception:
it reads and writes tasks, but placement always stays deterministic.

## System overview

```
React SPA (Vite, :5173) ──/api proxy──▶ FastAPI (:8000) ──▶ SQLite (SQLAlchemy)
                                            │
                                  pipeline.py (only DB-aware module)
                                   ├─ decompose.py   pure
                                   ├─ scoring.py     pure
                                   └─ scheduler.py   pure
```

The three algorithm modules import nothing from FastAPI or SQLAlchemy. `pipeline.py` is the
only module that joins them to the database.

## Scheduling pipeline

```
Task input (form / capture)      Recurring routine template
        ↓                            ↓ (materialised lazily, per day)
        └──────────────┬─────────────┘
                       ↓
[Rule-based decomposer]      essay -> research / outline / draft / revise
        ↓                    exam  -> spaced sessions 10/6/3/1 days out
[Deterministic priority scorer]   weighted urgency / grade / stress / effort gap
        ↓
[Greedy scheduler]           walks free slots, respects Busy events,
        ↓                    puts high-focus work in productive hours
Overview (week view planned)
```

1. **Materialise** active recurring templates into ordinary `Task` rows (idempotent, one
   instance per template per calendar day). This happens whenever tasks or the schedule are read,
   so there is no background job.
2. **Decompose** large essays and exams into ordered subtasks.
3. **Score** every pending task/subtask and rank them, with stable tie-breaks.
4. **Place** greedily into free slots, the week minus Busy event occurrences, honouring phase order and
   productive windows. Anything that can't be placed comes back as *unschedulable* with a reason.

## Data model

`Student` owns `Calendar`s, colour `Category`s, `CalendarEvent`s, `ProductiveWindow`s, `Weights`,
`Task`s (with `Subtask`s), `RecurringTask` templates (and their `RecurringTaskInstance`
bookkeeping), `ScheduledSlot`s and an append-only `EventLog`.

- **Calendar events** are the source of busy time. An event belongs to a calendar, has a start,
  an exclusive end (all-day = midnight to midnight), an optional category, `transparency`
  (`opaque` = Busy, `transparent` = Free; the API exposes `busy`), a `status` (`confirmed` or
  `cancelled`) and an optional `recurrence` (RRULE/EXDATE/RDATE lines, expanded by the pure
  `recurrence.py`). Edits to one occurrence are override rows pointing at their series
  (`recurring_event_id`). Google-style sync fields (`external_id`, `etag`, ...) are stored but
  unused. `kind` is `default` or `routine`. Events are seeded (`calendar_defaults.py`) and no UI
  edits them: the intended source is a Google Calendar sync, with this table as its local cache.
- **Busy time = opaque, confirmed occurrences** from every calendar. Hidden calendars still
  block; Free and cancelled events don't. The occurrence that started last night (sleep) still
  blocks this morning.
- **Colour** is one of 11 keys (`COLOR_KEYS`). Effective colour: category colour, else the item's
  own `color_key`, else the calendar colour. Tasks and routines carry a category and colour too.
- **Migrations** (`migrations.py`): `add_missing_columns` adds new columns to an existing SQLite
  file; data migrations run once each, recorded in `schema_migrations`. The first,
  `fixed_blocks_to_events`, turns the old fixed blocks into weekly recurring events starting on
  the Monday of the week before the current one. `FixedBlock` is now legacy: kept as a rollback
  copy, read only by the one-time migration.
- **The schedule is derived state.** Regenerating wipes and rebuilds every `ScheduledSlot`.
- **EventLog** records created / scheduled / rescheduled / skipped / completed / unschedulable.
  Nothing reads it yet. It is kept as future training data (see [ml.md](ml.md)).

## Conventions

- **Durations are minutes** everywhere in the API and database. The task form accepts hours.
- **Productive windows recur weekly; busy time comes from calendar events.** `day_of_week` is `0`=Monday..`6`=Sunday,
  or `null` for every day. An `end_time` at or before `start_time` runs overnight. A band
  that spills off Sunday night is drawn on Monday morning too.
- **Datetimes are naive local time.** That's fine for a single timezone; revisit before anyone travels.
- **No auth.** Everything operates on student 1.
- **API types are mirrored by hand**: `frontend/src/types/api.ts` ↔ `backend/app/schemas.py`.

## Decisions taken beyond the brief

- **Phase precedence is enforced.** Ranking by score alone could schedule "revise" before the
  "draft" it revises. Subtasks of a task now run in `order_index` order (`predecessor_ids` in
  `scheduler.py`). An unschedulable phase does not block the ones after it.
- **Overdue work is scheduled as soon as possible** instead of being reported unschedulable.
  Set `SCHEDULE_OVERDUE_ASAP = False` in `scheduler.py` for strict behaviour.
- **`effort_gap` is clamped to [0, 1]**, so over-worked tasks contribute zero, never a negative.

## Known limitations

- **Long phases often don't fit.** The draft phase is 50% of an essay, so a 10-hour essay needs
  one unbroken 5-hour block. These show up as *unschedulable* with a reason rather than failing
  silently.
- The event log is written but never read, on purpose (future training data).
- **Busy time can't be edited in the app yet.** It comes from seeded calendar events until Google
  Calendar sync lands. The in-app calendar editor was dropped (#61).
