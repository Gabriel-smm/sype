# Calendar data model (PR 1 of 5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace weekly fixed blocks with dated, optionally recurring calendar events, plus calendars and colour categories. The scheduler's busy time comes only from events marked Busy.

**Architecture:**
- A pure `recurrence.py` (python-dateutil) expands events into occurrences for a date range.
- A DB glue module `calendar_service.py` loads events and feeds absolute busy intervals to
  `scheduler.build_free_slots`.
- A small additive migration layer upgrades existing SQLite files in place: it adds missing
  columns, then runs one-off data migrations recorded in `schema_migrations`.
- On the frontend, the week grid only switches its data source from `settings.fixed_blocks` to
  event occurrences. The new UI is PR 2.

**Tech Stack:** FastAPI, SQLAlchemy 2, Pydantic 2, python-dateutil, pytest. React 19 + TS + Vitest.

**Spec:** `docs/superpowers/specs/2026-10-18-gcal-calendar-design.md` (section "PR 1"). Issue #54.
Branch: `feat/54-calendar-data-model`.

## Global Constraints

- Datetimes are **naive local time** everywhere. An event's `end` is exclusive. All-day events
  run from midnight to midnight.
- Durations stay in **minutes** in the API.
- No auth: student 1. Routes follow the existing split: list and create under
  `/api/students/{sid}/…`, item routes under `/api/<things>/{id}`.
- `scheduler.py`, `scoring.py`, `decompose.py` and `recurrence.py` must not import DB or HTTP
  code (`docs/backend.md`).
- `frontend/src/types/api.ts` mirrors `backend/app/schemas.py` by hand. Change both together.
- Colour keys, in this exact order: `COLOR_KEYS = ["rose", "peach", "butter", "pistachio", "mint",
  "aqua", "sky", "periwinkle", "lilac", "blush", "stone"]`.
  - The default calendar colour is `"sky"`.
- Effective colour = the category's colour if a category is set, otherwise the item's own
  `color_key`, otherwise the calendar's colour.
  - Setting a `color_key` without a `category_id` clears the category.
  - Deleting a category with no reassignment copies its colour onto its items.
- The API exposes `busy: bool`. The DB stores Google's `transparency`: `"opaque"` (Busy) or
  `"transparent"` (Free).
  - `busy` defaults to `not all_day`.
- `kind` is `"default"` or `"routine"`. `status` is `"confirmed"` or `"cancelled"`.
  DELETE is a soft delete (`cancelled`), which `/restore` reverses.
- Hidden calendars still block scheduling.
- Run backend commands from `backend/` with `../.venv/bin/python`. Never read `.venv/`,
  `node_modules/`, `frontend/dist/` or `backend/task_scheduler.db`.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Upgrading a real, pre-existing DB:**
   - Columns get added.
   - Fixed blocks become events exactly once.
   - A second `bootstrap()` creates nothing new.

   Tests in Task 3.
2. **The overnight sleep event:** the occurrence that started last night must still block this
   morning, even though the query window starts today. Tests in Tasks 1 and 4.
3. **An event straddling the edge of the requested range** is returned and blocks the scheduler.
   Test in Task 1.
4. **A malformed `recurrence` line** (e.g. `"RRULE:FREQ=SOMETIMES"`) returns 422, never 500.
   Test in Task 6.
5. **Deleting a category** never leaves an item with a category but no colour. Test in Task 5.

---

### Task 1: Pure recurrence expansion

**Files:**
- Create: `backend/app/recurrence.py`
- Modify: `backend/requirements.txt` (add `python-dateutil==2.9.0.post0`)
- Test: `backend/tests/test_recurrence.py`

**Interfaces:**
- Produces:
  ```python
  @dataclass(frozen=True)
  class EventSpec:
      id: int; start: datetime; end: datetime; recurrence: tuple[str, ...] = (); busy: bool = True
  @dataclass(frozen=True)
  class ExceptionSpec:          # one edited/cancelled instance of a series (Google's recurringEventId model)
      id: int; original_start: datetime; start: datetime; end: datetime; busy: bool = True; cancelled: bool = False
  @dataclass(frozen=True)
  class Occurrence:
      event_id: int; start: datetime; end: datetime; busy: bool
      original_start: datetime | None = None   # set for instances of a series
      exception_id: int | None = None
  class RecurrenceError(ValueError): ...
  def validate_recurrence(lines: Sequence[str], start: datetime) -> None   # raises RecurrenceError
  def expand(event: EventSpec, exceptions: Sequence[ExceptionSpec], window_start: datetime, window_end: datetime) -> list[Occurrence]
  def weekly_rule(days_of_week: Sequence[int] | None) -> str   # None -> "RRULE:FREQ=DAILY"; [0,2] -> "RRULE:FREQ=WEEKLY;BYDAY=MO,WE"
  ```

- [ ] **Step 1: Add the dependency and install it**

  Add `python-dateutil==2.9.0.post0` to `requirements.txt`, then run
  `../.venv/bin/python -m pip install -r requirements.txt`.

  Expected: the output ends with `Successfully installed python-dateutil` or `Requirement already
  satisfied`.

- [ ] **Step 2: Write the failing tests** in `tests/test_recurrence.py`. Fixtures are anchored on
  Monday 2026-03-02.

  ```python
  MON = datetime(2026, 3, 2)
  def test_single_event_inside_window_is_one_occurrence():
      ev = EventSpec(1, MON.replace(hour=9), MON.replace(hour=10))
      assert expand(ev, [], MON, MON + timedelta(days=1)) == [Occurrence(1, MON.replace(hour=9), MON.replace(hour=10), True)]
  def test_event_straddling_window_edge_is_included():           # Review Focus 3
      ev = EventSpec(1, MON.replace(hour=23), MON + timedelta(days=1, hours=1))
      assert len(expand(ev, [], MON + timedelta(days=1), MON + timedelta(days=2))) == 1
  def test_event_outside_window_is_excluded(): ...                # end == window_start -> []
  def test_weekly_byday_expands_to_matching_days():
      ev = EventSpec(1, MON.replace(hour=9), MON.replace(hour=10, minute=15), (weekly_rule([0, 2]),))
      starts = [o.start for o in expand(ev, [], MON, MON + timedelta(days=14))]
      assert [s.weekday() for s in starts] == [0, 2, 0, 2]
      assert all(o.original_start == o.start for o in expand(ev, [], MON, MON + timedelta(days=14)))
  def test_overnight_daily_occurrence_from_previous_day_covers_morning():   # Review Focus 2
      sleep = EventSpec(1, MON.replace(hour=23, minute=30), MON + timedelta(days=1, hours=7, minutes=30), (weekly_rule(None),))
      occ = expand(sleep, [], MON + timedelta(days=3, hours=8), MON + timedelta(days=4, hours=8))
      assert occ[0].start == MON + timedelta(days=3, hours=23, minutes=30)  # and nothing earlier, since the 2nd-night one ended at 07:30 < 08:00
      occ2 = expand(sleep, [], MON + timedelta(days=3, hours=6), MON + timedelta(days=3, hours=12))
      assert occ2[0].start == MON + timedelta(days=2, hours=23, minutes=30)
  def test_until_and_count_are_respected(): ...                   # "RRULE:FREQ=DAILY;COUNT=3" -> 3 occurrences over 10 days
  def test_exdate_removes_an_instance():
      lines = (weekly_rule(None), "EXDATE:20260303T090000")
      # 3-day window -> 2 occurrences, none on 2026-03-03
  def test_cancelled_exception_removes_and_moved_exception_replaces():
      # series daily 09:00-10:00; exception A cancelled for 03-03 09:00; exception B moves 03-04 09:00 -> 03-04 15:00
      # result for 03-02..03-05: starts == [03-02 09:00, 03-04 15:00]; B's occurrence has exception_id set and original_start 03-04 09:00
  def test_moved_exception_outside_original_window_still_appears(): ...  # original 03-10 09:00 moved to 03-04 15:00; window 03-04 only -> 1 occurrence
  def test_wall_clock_time_is_kept_across_dst_date():
      # naive local time: a weekly 09:00 event starting 2026-10-26 still starts at 09:00 on 2026-11-02
  def test_validate_recurrence_rejects_garbage():
      with pytest.raises(RecurrenceError): validate_recurrence(["RRULE:FREQ=SOMETIMES"], MON)
      with pytest.raises(RecurrenceError): validate_recurrence(["DTSTART:20260101T000000"], MON)  # only RRULE/EXDATE/RDATE allowed
  def test_weekly_rule_strings():
      assert weekly_rule(None) == "RRULE:FREQ=DAILY"
      assert weekly_rule([3, 1]) == "RRULE:FREQ=WEEKLY;BYDAY=TU,TH"
  ```

- [ ] **Step 3: Run the tests and check they fail.**

  Run: `../.venv/bin/python -m pytest tests/test_recurrence.py -q`

  Expected: `ModuleNotFoundError: app.recurrence`.

- [ ] **Step 4: Implement `recurrence.py`.**
  - Build a set with
    `rrulestr("DTSTART:" + start.strftime("%Y%m%dT%H%M%S") + "\n" + "\n".join(lines), forceset=True)`.
  - Expand with `.between(window_start - duration, window_end, inc=True)`.
  - Keep only occurrences where `start < window_end and end > window_start`.
  - Exceptions are keyed by `original_start`:
    - A cancelled exception drops its occurrence.
    - A moved exception replaces it.
    - Exceptions whose own `[start, end)` overlaps the window are always included.
  - Sort the result by `start`.
  - `validate_recurrence` lets only `RRULE:`, `EXDATE:` and `RDATE:` prefixes through, and wraps
    any dateutil `ValueError` in a `RecurrenceError`.

- [ ] **Step 5: Run the tests and check they pass.**

  Run: `../.venv/bin/python -m pytest tests/test_recurrence.py -q`

  Expected: all passed.

- [ ] **Step 6: Commit** `requirements.txt`, `app/recurrence.py` and `tests/test_recurrence.py`
  with the message "Add pure recurrence expansion for calendar events".

---

### Task 2: Scheduler takes absolute busy intervals

**Files:**
- Modify: `backend/app/scheduler.py:80-104` (rename `_expand` to `expand_weekly`) and `:150-176`
  (`build_free_slots`)
- Modify: `backend/app/pipeline.py:219-224` (temporary adapter, replaced in Task 4)
- Test: `backend/tests/test_scheduler.py`

**Interfaces:**
- Produces:
  - `expand_weekly(blocks: list[BlockSpec], window_start: datetime, window_end: datetime) -> list[tuple[datetime, datetime]]`.
    It is public and its body is unchanged.
  - `build_free_slots(busy: list[tuple[datetime, datetime]], productive_windows: list[BlockSpec], *, now: datetime, horizon_days: int = DEFAULT_HORIZON_DAYS, min_slot_minutes: int = MIN_SLOT_MINUTES) -> list[FreeSlot]`.
    It clips `busy` to the window, then merges.

- [ ] **Step 1: Update the tests.**
  - In `test_scheduler.py`, add
    `BUSY = expand_weekly(FIXED_BLOCKS, NOW - timedelta(days=1), NOW + timedelta(days=15))`.
  - Replace every `build_free_slots(FIXED_BLOCKS, …)` with `build_free_slots(BUSY, …)`.
  - The two single-block tests (L120 and L127) wrap their blocks the same way.
  - Add these tests:
  ```python
  def test_busy_intervals_outside_the_window_are_ignored():
      far = [(NOW + timedelta(days=30), NOW + timedelta(days=31))]
      assert build_free_slots(far, [], now=NOW, horizon_days=1) == build_free_slots([], [], now=NOW, horizon_days=1)
  def test_one_off_busy_interval_blocks_only_that_day():
      busy = [(NOW + timedelta(hours=2), NOW + timedelta(hours=4))]
      slots = build_free_slots(busy, [], now=NOW, horizon_days=2)
      assert all(s.end <= busy[0][0] or s.start >= busy[0][1] for s in slots)
      assert any(s.start <= NOW + timedelta(days=1, hours=3) < s.end for s in slots)
  ```

- [ ] **Step 2: Run the tests and check they fail.**

  Run: `../.venv/bin/python -m pytest tests/test_scheduler.py -q`

  Expected: `ImportError: cannot import name 'expand_weekly'`.

- [ ] **Step 3: Implement the rename and the new signature.**
  - Update the module docstring: busy time arrives as absolute intervals.
  - In `pipeline.generate_schedule`, pass
    `expand_weekly(_block_specs(student.fixed_blocks), now - timedelta(days=1), now + timedelta(days=horizon_days + 1))`
    for now, so the full suite stays green until Task 4.

- [ ] **Step 4: Run the whole backend suite.**

  Run: `../.venv/bin/python -m pytest -q`

  Expected: all passed.

- [ ] **Step 5: Commit** with the message "Let the scheduler take absolute busy intervals".

---

### Task 3: Models, the additive migration helper, and the fixed-block migration

**Files:**
- Modify: `backend/app/models.py`. Add `COLOR_KEYS`, `Calendar`, `Category`, `CalendarEvent`
  and `SchemaMigration`. Add `category_id` and `color_key` to `Task`, and `category_id` to
  `RecurringTask`. Add the `Student.calendars` and `Student.categories` relationships.
- Create: `backend/app/calendar_defaults.py`
- Create: `backend/app/migrations.py`
- Modify: `backend/app/seed.py`. `ensure_schema` gains `add_missing_columns`. `seed_student`
  seeds events instead of fixed blocks. `bootstrap` runs `run_data_migrations` after
  `seed_student`.
- Test: `backend/tests/test_migrations.py`

**Interfaces:**
- Produces, in `models.py`:
  - `Calendar(id, student_id, name, source="local", is_primary=False, visible=True, color_key="sky", position=0, external_id, sync_token, etag, last_synced_at, ics_filename, imported_at)`.
    The last six are nullable. `events` relationship with `cascade="all, delete-orphan"`.
  - `Category(id, student_id, name, color_key, position=0, created_at)`, with
    `UniqueConstraint(student_id, name)`.
  - `CalendarEvent(id, student_id, calendar_id, category_id?, color_key?, title, description="", location="", start, end, all_day=False, transparency="opaque", kind="default", status="confirmed", recurrence="[]" (JSON text), recurring_event_id? (FK self), original_start_time?, ical_uid?, external_id?, etag?, sequence=0, created_at, updated_at)`.
    `UniqueConstraint(recurring_event_id, original_start_time)`.
    Helper property `recurrence_lines -> list[str]`.
  - `SchemaMigration(name PK, applied_at)`.
- Produces, in `calendar_defaults.py`:
  ```python
  PRIMARY_CALENDAR_NAME = "Sype"
  DEFAULT_CATEGORIES = [("Classes", "sky"), ("Routine", "stone")]
  ROUTINE_KINDS = {"sleep", "lunch"}
  @dataclass(frozen=True)
  class WeeklyBlock: kind: str; label: str; day_of_week: int | None; start_minute: int; end_minute: int
  def ensure_primary_calendar(db: Session, student_id: int) -> models.Calendar
  def ensure_default_categories(db: Session, student_id: int) -> dict[str, models.Category]
  def events_from_weekly_blocks(db: Session, student_id: int, blocks: Sequence[WeeklyBlock], *, today: date) -> list[models.CalendarEvent]
  ```
  `events_from_weekly_blocks` works like this:
  - Group by `(kind, label, start_minute, end_minute)`. A group containing any
    `day_of_week=None` becomes `weekly_rule(None)`; otherwise `weekly_rule(sorted days)`.
  - DTSTART is the first matching day on or after the Monday of `today`'s week, at
    `start_minute`.
  - `end = start + ((end_minute - start_minute) % 1440 or 1440)` minutes.
  - Sleep and lunch get `kind="routine"` and the "Routine" category. `class` gets "Classes".
    `other` gets no category.
  - Every event is opaque. It flushes but doesn't commit.
- Produces, in `migrations.py`:
  - `add_missing_columns(engine: Engine) -> list[str]` returns the `"table.column"` names it
    added. It raises `RuntimeError` on a NOT NULL column with no `server_default`.
  - `migrate_fixed_blocks(db: Session) -> None` converts each student's `FixedBlock` rows through
    `events_from_weekly_blocks(today=date.today())`. The `FixedBlock` rows stay untouched.
  - `DATA_MIGRATIONS: list[tuple[str, Callable[[Session], None]]] = [("fixed_blocks_to_events", migrate_fixed_blocks)]`.
  - `run_data_migrations(db: Session) -> list[str]` returns the names it applied.
- The new `Task`/`RecurringTask` columns are nullable (`category_id` an FK to `categories.id`,
  `color_key` a String), so the helper can add them.

- [ ] **Step 1: Write the failing tests** in `tests/test_migrations.py`. These use their own
  temporary SQLite engine, not the shared `client` fixture.

  ```python
  def test_add_missing_columns_adds_new_nullable_columns(tmp_path):
      # create an old-shape `tasks` table via raw SQL (the columns before this PR), then:
      added = add_missing_columns(engine)
      assert "tasks.category_id" in added and "tasks.color_key" in added
      assert add_missing_columns(engine) == []                 # idempotent
  def test_add_missing_columns_refuses_not_null_without_default(): ...  # a throwaway MetaData table with a NOT NULL extra column -> RuntimeError
  def test_fixed_blocks_become_grouped_recurring_events(db_session):
      # student with Sleep(None, 23:30-07:30), Bio 101 Mon+Wed 09:00-10:15, Lunch(None, 12:00-13:00)
      run_data_migrations(db_session)
      events = db_session.query(CalendarEvent).all()
      assert len(events) == 3
      bio = next(e for e in events if e.title == "Bio 101")
      assert bio.recurrence_lines == ["RRULE:FREQ=WEEKLY;BYDAY=MO,WE"] and bio.kind == "default"
      sleep = next(e for e in events if e.title == "Sleep")
      assert sleep.kind == "routine" and (sleep.end - sleep.start) == timedelta(hours=8)
      assert {c.name for c in db_session.query(Category)} == {"Classes", "Routine"}
      assert db_session.query(Calendar).filter_by(is_primary=True).count() == 1
  def test_data_migrations_run_once(db_session):                  # Review Focus 1
      assert run_data_migrations(db_session) == ["fixed_blocks_to_events"]
      assert run_data_migrations(db_session) == []
      # event count unchanged after the second call
  def test_bootstrap_on_a_fresh_db_seeds_events_not_fixed_blocks(client):
      # via the client fixture: FixedBlock count == 0 and CalendarEvent count == 5
  ```

  The fresh seed collapses to 5 events: Sleep, Lunch, Bio 101 (MO,WE), Stats 210 (TU,TH) and
  Writing Seminar (FR).

- [ ] **Step 2: Run the tests and check they fail.**

  Run: `../.venv/bin/python -m pytest tests/test_migrations.py -q`

  Expected: an ImportError.

- [ ] **Step 3: Implement the models, `calendar_defaults.py`, `migrations.py` and the
  `seed.py` changes.**
  - `add_missing_columns` compares `sqlalchemy.inspect(engine).get_columns(table)` with
    `Base.metadata`.
  - It issues `ALTER TABLE <t> ADD COLUMN <CreateColumn(col).compile(dialect=engine.dialect)>`.
  - `seed_student` converts `DEFAULT_FIXED_BLOCKS` into `WeeklyBlock`s and calls
    `ensure_primary_calendar`, `ensure_default_categories` and `events_from_weekly_blocks`.

- [ ] **Step 4: Run the whole backend suite.**

  Run: `../.venv/bin/python -m pytest -q`

  Expected: everything passes except tests that read `settings.fixed_blocks` from the fresh seed
  (`test_api.py::test_health_and_seeded_student`). Task 4 fixes that. Note the expected failures
  in the commit body.

- [ ] **Step 5: Commit** with the message "Add calendars, categories and calendar events with an
  in-place migration".

---

### Task 4: Busy time comes from events; retire the fixed-block API

**Files:**
- Create: `backend/app/calendar_service.py`
- Modify:
  - `backend/app/pipeline.py:36-46, 219-224`: `_block_specs` stays for productive windows only,
    and busy time comes from `busy_intervals`.
  - `backend/app/api/students.py`: delete the fixed-block routes (L60-85) and `fixed_blocks` in
    `get_settings`.
  - `backend/app/schemas.py`: delete `FixedBlockCreate`/`Out` and `StudentSettings.fixed_blocks`.
  - `backend/app/main.py:8,56`: `/meta` returns `"colors": COLOR_KEYS` and drops `block_kinds`.
  - `backend/app/models.py`: delete `BLOCK_KINDS`. The `FixedBlock` model stays (with a
    docstring saying it's a legacy table) for the migration.
- Test: `backend/tests/test_api.py` (rewrite L28-34 and L182-189), `backend/tests/test_calendar_events.py`

**Interfaces:**
- Consumes: `recurrence.EventSpec/ExceptionSpec/expand` (Task 1), the models (Task 3).
- Produces, in `calendar_service.py`:
  ```python
  def load_occurrences(db: Session, student_id: int, start: datetime, end: datetime,
                       *, calendar_ids: Sequence[int] | None = None) -> list[tuple[models.CalendarEvent, Occurrence]]
      # confirmed series rows (recurring_event_id IS NULL) + their exception rows, expanded; sorted by occurrence start
  def busy_intervals(db: Session, student_id: int, start: datetime, end: datetime) -> list[tuple[datetime, datetime]]
      # every calendar, visible or not; only Occurrence.busy
  def effective_color(event: models.CalendarEvent) -> str   # category -> own -> calendar
  ```
  The pipeline calls
  `busy_intervals(db, student_id, now - timedelta(days=1), day_start(now) + timedelta(days=horizon_days + 1))`.

- [ ] **Step 1: Write the failing tests.**

  ```python
  # test_api.py
  def test_health_and_seeded_student(client):   # settings no longer has fixed_blocks; /meta has "colors" == COLOR_KEYS
  def test_a_busy_all_week_event_keeps_the_scheduler_out(client):   # replaces the fixed-block test
      # POST a calendar event: start today 00:00, end today+8d 00:00, busy=True; new_task; generate -> slots == [] and unschedulable non-empty
  def test_a_free_event_does_not_block_the_scheduler(client):
      # same event with busy=False -> slots non-empty
  def test_an_event_on_a_hidden_calendar_still_blocks(client):
      # create calendar, PATCH visible=False, busy all-week event on it -> slots == []
  def test_tonights_sleep_still_blocks_tomorrow_morning(client):     # Review Focus 2, end to end
      # generate; no slot starts in [07:00, 07:30) on any day or overlaps 23:30-07:30
  ```

  The API tests depend on the event routes from Task 6. Write them now, mark them
  `@pytest.mark.skip(reason="routes land in Task 6")`, and unskip them in Task 6. The fixed-block
  test is deleted.

- [ ] **Step 2: Run the tests and check they fail.**

  Run: `../.venv/bin/python -m pytest tests/test_api.py -q`

  Expected: `test_health_and_seeded_student` fails on `colors`.

- [ ] **Step 3: Implement `calendar_service.py`, the pipeline wiring and the removals.**

- [ ] **Step 4: Run the whole backend suite.**

  Run: `../.venv/bin/python -m pytest -q`

  Expected: all pass, with the skips noted.

- [ ] **Step 5: Commit** with the message "Take busy time from calendar events instead of fixed
  blocks".

---

### Task 5: Calendars and categories API

**Files:**
- Create: `backend/app/api/calendar.py` (one router, `tags=["calendar"]`). Register it in
  `main.py`.
- Modify: `backend/app/schemas.py`
- Test: `backend/tests/test_calendar_api.py`

**Interfaces:**
- Schemas:
  - `CalendarCreate(name: str (1-80), color_key: ColorKey = "sky")`
  - `CalendarUpdate(name?, color_key?, visible?: bool, position?: int)`
  - `CalendarOut(id, name, source, is_primary, visible, color_key, position)`
  - `CategoryCreate(name: str (1-40), color_key: ColorKey)`
  - `CategoryUpdate(name?, color_key?, position?)`
  - `CategoryOut(id, name, color_key, position)`
  - `ColorKey` is a `str` that a validator checks against `COLOR_KEYS`.
- Routes:
  | Method | Path | Behaviour |
  |---|---|---|
  | GET | `/api/students/{sid}/calendars` | Ordered by `(not is_primary, position, id)` |
  | POST | `/api/students/{sid}/calendars` | Returns 201 |
  | PATCH | `/api/calendars/{id}` | |
  | DELETE | `/api/calendars/{id}` | 409 `"The primary calendar can't be deleted"` for the primary; otherwise 204 and its events are deleted |
  | GET | `/api/students/{sid}/categories` | |
  | POST | `/api/students/{sid}/categories` | 201; a duplicate name returns 409 |
  | PATCH | `/api/categories/{id}` | |
  | DELETE | `/api/categories/{id}?reassign_to={id}` | 204 |
- Without `reassign_to`, every event and task in the category gets `color_key = category.color_key`
  and `category_id = None`. With it, they move to the other category. A missing or foreign
  `reassign_to` returns 404.

- [ ] **Step 1: Write the failing tests.**
  - The seed has the primary calendar and the categories Classes/sky and Routine/stone.
  - Create, rename and recolour work.
  - An invalid `color_key` returns 422.
  - A duplicate category returns 409.
  - Deleting the primary calendar returns 409.
  - Deleting another calendar also deletes its events.
  - `test_deleting_a_category_keeps_its_colour_on_items` (Review Focus 5): the event in "Classes"
    ends up with `category_id is None` and `color_key == "sky"`.
  - `test_deleting_a_category_can_reassign_items`.
  - Unknown ids return 404.

- [ ] **Step 2: Run the tests and check they fail.**

  Run: `../.venv/bin/python -m pytest tests/test_calendar_api.py -q`

  Expected: 404s or an ImportError.

- [ ] **Step 3: Implement the routes and schemas.**

- [ ] **Step 4: Run the tests and check they pass.**

  Run: `../.venv/bin/python -m pytest tests/test_calendar_api.py -q`

  Expected: all passed.

- [ ] **Step 5: Commit** with the message "Add calendars and categories endpoints".

---

### Task 6: Calendar events API

**Files:**
- Modify: `backend/app/api/calendar.py`, `backend/app/schemas.py`
- Test: `backend/tests/test_calendar_api.py`. Also remove the skips added in Task 4.

**Interfaces:**
- Schemas:
  - `CalendarEventCreate`:
    - `calendar_id: int | None = None` (None means the primary calendar)
    - `title: str (min 1)`, `description: str = ""`, `location: str = ""`
    - `start: datetime`, `end: datetime`, `all_day: bool = False`
    - `busy: bool | None = None`, which defaults to `not all_day`
    - `kind: Literal["default", "routine"] = "default"`
    - `category_id: int | None = None`, `color_key: ColorKey | None = None`
    - `recurrence: list[str] = []`
    - A model validator requires `end > start` and runs `validate_recurrence(recurrence, start)`,
      raising `ValueError`, which becomes a 422 (Review Focus 4).
  - `CalendarEventUpdate`: every field optional. The routes apply the colour rule from Global
    Constraints.
  - `CalendarEventOut`:
    - `id, calendar_id, category_id, color_key`, where `color_key` is the event's own colour
    - `title, description, location, start, end, all_day, busy, kind, status, recurrence: list[str]`
    - `recurring_event_id, original_start_time`
  - `OccurrenceOut`:
    - `id: str` is `f"{event_id}_{original_start:%Y%m%dT%H%M}"` for a series instance, else
      `str(event_id)`
    - `event_id, calendar_id, category_id`
    - `color_key: str`, the effective colour from `effective_color`
    - `title, description, location, start, end, all_day, busy, kind`
    - `recurring: bool`, `original_start: datetime | None`
- Routes:
  | Method | Path | Behaviour |
  |---|---|---|
  | GET | `/api/students/{sid}/calendar-events?start=&end=&calendar_ids=1,2` | Returns `list[OccurrenceOut]` from `load_occurrences`. Both bounds are required. 422 if `end <= start` or the span is over 120 days |
  | POST | `/api/students/{sid}/calendar-events` | 201, returns `CalendarEventOut`. A foreign `calendar_id` or `category_id` returns 404 |
  | GET | `/api/calendar-events/{id}` | |
  | PATCH | `/api/calendar-events/{id}` | |
  | DELETE | `/api/calendar-events/{id}` | 204; sets `status="cancelled"` |
  | POST | `/api/calendar-events/{id}/restore` | Returns `CalendarEventOut` with `status="confirmed"` |

  Cancelled events are left out of GET occurrences and of busy time.

- [ ] **Step 1: Write the failing tests.**
  - Create and read back an event.
  - The occurrence list for a week contains the seeded Bio 101 on Monday and Wednesday, with
    `color_key == "sky"` (from Classes) and `kind == "default"`. Sleep has `kind == "routine"`.
  - `test_all_day_event_defaults_to_free`.
  - `test_invalid_recurrence_is_422` (Review Focus 4).
  - `end <= start` returns 422; a range over 120 days returns 422.
  - `test_setting_a_colour_clears_the_category`.
  - `test_delete_then_restore_round_trips`: after delete the event is not in the occurrences and
    doesn't block; after restore it does both again.
  - `calendar_ids` filters the occurrences.
  - Unknown ids return 404.
  - Unskip the Task 4 API tests.

- [ ] **Step 2: Run the tests and check they fail.**

  Run: `../.venv/bin/python -m pytest tests/test_calendar_api.py tests/test_api.py -q`

- [ ] **Step 3: Implement.**

- [ ] **Step 4: Run the whole backend suite.**

  Run: `../.venv/bin/python -m pytest -q`

  Expected: all passed, with no skips left.

- [ ] **Step 5: Commit** with the message "Add calendar event endpoints with occurrence
  expansion".

---

### Task 7: Category and colour on tasks and routines

**Files:**
- Modify:
  - `backend/app/schemas.py`: `TaskCreate`, `TaskUpdate` and `TaskOut` gain
    `category_id: int | None` and `color_key: ColorKey | None`. `RecurringTask*` gains
    `category_id`.
  - `backend/app/api/tasks.py` (create and PATCH)
  - `backend/app/api/recurring.py`
  - `backend/app/pipeline.py:117-125`: copy `category_id` when materialising.
- Test: `backend/tests/test_api.py`, `backend/tests/test_recurring.py`

**Interfaces:**
- PATCH applies the same colour rule as events.
- A foreign or unknown `category_id` returns 404.
- Changing the category or colour must **not** trigger re-decomposition. `DECOMPOSITION_FIELDS`
  stays as it is.

- [ ] **Step 1: Write the failing tests.**
  - `test_task_category_and_colour_round_trip`
  - `test_setting_a_task_colour_clears_its_category`
  - `test_recurring_template_category_is_copied_to_materialised_tasks`
  - `test_changing_task_colour_keeps_subtasks` (the subtask ids are unchanged)

- [ ] **Step 2: Run the tests and check they fail.**

  Run: `../.venv/bin/python -m pytest tests/test_api.py tests/test_recurring.py -q`

- [ ] **Step 3: Implement.**

- [ ] **Step 4: Run the whole backend suite.**

  Run: `../.venv/bin/python -m pytest -q`

  Expected: all passed.

- [ ] **Step 5: Commit** with the message "Let tasks and routines carry a category and colour".

---

### Task 8: Frontend draws event occurrences

**Files:**
- Modify:
  - `frontend/src/types/api.ts`: remove `BlockKind`, `FixedBlock` and `Settings.fixed_blocks`.
    `Meta.block_kinds` becomes `colors: ColorKey[]`. Add `ColorKey`, `Calendar`, `Category`,
    `CalendarEventInput`, `CalendarEvent` and `Occurrence`, mirroring Tasks 5-6. `Task` and
    `TaskInput` gain `category_id` and `color_key`.
  - `frontend/src/lib/api.ts`: add `calendarEvents(start: string, end: string)`, which returns
    `Occurrence[]`, plus calendars, categories and event CRUD calls with the same shapes.
  - `frontend/src/components/schedule/week-grid.tsx:46,70,203-214`: the `fixedBlocks` prop
    becomes `busyEvents: Occurrence[]`.
  - `frontend/src/pages/calendar.tsx:71`
- Create: `frontend/src/hooks/use-calendar-events.ts`
- Modify: `frontend/src/lib/time.ts`. Add `occurrenceSpans`.
- Test: `frontend/src/lib/time.test.ts` (new)

**Interfaces:**
- `occurrenceSpans(occurrences: Occurrence[], weekStart: Date): OccurrenceSpan[]`, where
  `OccurrenceSpan = { id: string; occurrence: Occurrence; dayOffset: number; startMinute: number; endMinute: number }`.
  It splits an occurrence at each midnight into one span per day column (0-6) and drops parts
  outside the week. It reuses `minutesSinceMidnight` and `MINUTES_IN_DAY`.
- `useCalendarEvents(start: Date, end: Date, refreshKey: unknown): { occurrences: Occurrence[]; error: string | null }`.
  It fetches with `toApiDateTime` and refetches when the dates or `refreshKey` change. The
  calendar page passes `schedule` as `refreshKey`.
- For now the week grid draws every occurrence the way busy blocks are drawn today (hatched).
  A Free occurrence's tooltip says "Free". The real visual language is PR 2.

- [ ] **Step 1: Write the failing tests** in `lib/time.test.ts`.
  - `occurrenceSpans` gives one span for a 09:00-10:15 Monday event.
  - A Monday 23:30 to Tuesday 07:30 event gives two spans: day 0 23:30-24:00 and day 1
    00:00-07:30.
  - A Sunday-night event drops the part that falls on next Monday. It doesn't wrap, because
    occurrences are dated.
  - Events outside the week give `[]`.
  - Also add the first tests for `layoutColumns`: two overlapping entries get 2 columns.

- [ ] **Step 2: Run the tests and check they fail.**

  Run: `npm test --prefix frontend`

  Expected: `occurrenceSpans` is not exported.

- [ ] **Step 3: Implement the types, API calls, hook, helper and grid change.**
  - Remove now-unused imports.
  - `expandRecurring` stays for productive windows and `week-strip.tsx`.

- [ ] **Step 4: Run the frontend checks.**

  Run: `npm run lint --prefix frontend && npm run typecheck --prefix frontend && npm test --prefix frontend && npm run build --prefix frontend`

  Expected: all succeed.

- [ ] **Step 5: Commit** with the message "Draw calendar event occurrences on the week grid".

---

### Task 9: Docs, CLAUDE.md and the full verification

**Files:**
- Modify:
  - `docs/architecture.md`: the data model (calendars, categories, calendar events, exceptions,
    sync fields); busy time means opaque occurrences; the migration layer and
    `schema_migrations`; fixed blocks are legacy.
  - `docs/backend.md`: the new routes table, `recurrence.py`, `calendar_service.py`, the new
    `build_free_slots` signature, the colour rule, the test files.
  - `docs/setup.md`: the `python-dateutil` dependency; an existing DB upgrades in place on
    startup, so back up `backend/task_scheduler.db` first.
  - `docs/frontend.md:13`: drop "busy time will come from a connected calendar, so it has no
    editor"; the grid draws event occurrences.
  - `CLAUDE.md`: the "Fixed blocks / productive windows recur weekly" convention becomes
    "Productive windows recur weekly … Busy time comes from calendar events (Busy occurrences)".

- [ ] **Step 1: Write the doc updates.** Keep them to the essentials, per CLAUDE.md.

- [ ] **Step 2: Run the standard checks.** Use the `test-runner` agent, or run them directly:
  - `cd backend && ../.venv/bin/python -m pytest -q`
  - `npm run lint --prefix frontend`
  - `npm run typecheck --prefix frontend`
  - `npm test --prefix frontend`
  - `npm run build --prefix frontend`

  Expected: all green.

- [ ] **Step 3: Check that a real database upgrades.**
  1. Copy the dev DB to the scratchpad:
     `cp backend/task_scheduler.db $SCRATCH/upgrade.db` (if it exists; otherwise create one on
     `dev`).
  2. Start the backend against the copy:
     `TASK_SCHEDULER_DB=$SCRATCH/upgrade.db ../.venv/bin/python -m uvicorn app.main:app --port 8001`
  3. Call `GET /api/students/1/calendar-events?start=…&end=…`.

  Expected: the migrated classes, sleep and lunch appear. Existing tasks and the schedule still
  load, and `POST …/schedule/generate` avoids those blocks.

- [ ] **Step 4: Check it in the browser.**
  1. Start the app with `./dev.sh --seed`.
  2. Through the `run` skill, open the calendar.

  Expected: the classes, sleep and lunch show as hatched blocks; Rebuild places work around them.

- [ ] **Step 5: Commit** with the message "Document calendar events, categories and the
  migration layer".

- [ ] **Step 6: Review the branch.** Run `superpowers:verification-before-completion` and then
  `code-review`.
- [ ] **Step 7: Confirm with the user before pushing or opening the PR.** The PR targets `dev`
  with `gh pr create --base dev`, uses the PR template, and contains `Closes #54`.
