# Google-Calendar-style calendar for Sype

## Context

Today's calendar is a hand-built, week-only grid (`frontend/src/pages/calendar.tsx`,
`components/schedule/week-grid.tsx`). You can drag task blocks, but every regenerate wipes the
schedule, and Sype regenerates on each task edit. Busy time is only weekly `FixedBlock`s, and
there's nowhere to store a one-off dated event. The user wants a calendar that looks and behaves like Google
Calendar. It should have these:
- day, 3-day, week, month and schedule views
- drag to create, move and resize
- pastel colours and categories
- recurring events
- `.ics` import
- task blocks you drag stay where you put them, and the scheduler learns from the drags
- Time Insights

The work should start from `dev` once #52 (the sidebar UI update) has merged into it.

## Decisions made with the user

- **Look:** Google Calendar's layout, density and interactions, in Sype's existing dark palette.
  Run `frontend-design:frontend-design` before any UI work.
- **Import:** `.ics` file import for now. The data model mirrors Google's event shape so official
  two-way Google sync can be added later.
- **Busy / Free:** set on each event, and only Busy events block the scheduler.
- **All existing fixed blocks become recurring events.** Sleep and lunch use a distinct "routine"
  look. Auto-scheduled task blocks look different from calendar events.
- **Colour comes first and categories are optional.** Every event and task has a colour, and an
  event can have a colour without a category. A category is a named colour: assigning one sets the
  item's colour to the category's colour.
- **Drag-create:** a quick-create popover with **Event | Task** tabs. The Task tab creates a Sype
  task due at that time.
- **Dragging an auto-scheduled block pins it.** Only that block moves; the others re-plan on
  Rebuild or when a task is edited. Every move or resize is logged, and a deterministic
  hour-of-day preference built from those logs steers placement.
- **Time Insights for the visible range:**
  - time per category, leaving out routine and Free events, with overlaps counted once
  - planned vs done for task blocks
- **Extras:**
  - basic event features: an all-day row, resize, popovers, duplicate, location and
    description, an Undo toast, overlapping events side by side, a now line
  - recurring events with this / this-and-following / all scopes
  - a sidebar with a mini month, a calendars list with visibility toggles, and categories
  - a Schedule (agenda) view, keyboard shortcuts and search
- **Shortcuts:**
  - On the calendar page, Google Calendar's keys apply: `d x w m a` switch views, `t` jumps to
    today, `j/k` go next/previous, `c` creates, `e` edits, `Del` deletes, `/` searches.
  - Chat moves to **Ctrl+C**, which toggles it open and closed. It only fires when no text is
    selected and focus isn't in an editable field, so Copy still works.
  - `n` stays as "new task".
- **Delivery:** 5 stacked PRs (issues #54–#58), one GitHub issue each, branched as
  `feat/<issue>-calendar-<slug>` from `dev`. Each PR targets `dev`.

## Calls I made (flag any you disagree with)

- **Naming:** the activity log already uses "events", so the new things are `CalendarEvent`, the
  table `calendar_events`, and the routes `/calendar-events`.
- **Migrations:** add a small additive helper to `seed.ensure_schema`. It runs
  `ALTER TABLE ADD COLUMN` for any model column the database is missing, and refuses a NOT NULL
  column that has no `server_default`. Add a `schema_migrations` table for one-off data
  migrations. The old `fixed_blocks` rows stay as a rollback copy, but nothing reads them.
- **Recurrence lives on the backend only.** A pure module `backend/app/recurrence.py`, using
  `python-dateutil`, expands occurrences for a requested range. The frontend never expands RRULEs.
  - Because the fixed-block migration needs recurrence, storage and expansion land in PR1.
  - PR3 adds the editing UI, the edit scopes and per-occurrence exceptions.
- **Colour fallbacks:**
  - Effective colour = the category's colour if a category is set, otherwise the item's own
    `color_key`, otherwise the calendar's default colour.
  - Picking a plain colour on an item clears its category.
  - Tasks with neither fall back to a pastel default per task type. That replaces today's
    `TYPE_COLORS`.
- **Default availability:** all-day events default to Free, as in Google. Imported events keep
  their `TRANSP` (Busy/Free) setting.
- **Hidden calendars still block scheduling.** Visibility is only about what you see.
- **Uncategorised time in Insights** goes into a "No category" bucket.
- **Planned vs done** only counts from PR5 onward. Slot history doesn't exist before that.

## Visual language (to be finalised through frontend-design)

- **11 pastel colours, tuned for the dark background,** defined as `--color-cat-*` tokens in
  `frontend/src/index.css`.
  - They're stored as keys (`rose`, `peach`, `butter`, `mint`, `sky`, `lilac`, …), not hex
    values, so the palette can be retuned later.
- **Calendar event, Busy:** solid pastel fill, dark text, small radius. **Free:** pastel outline,
  no fill.
- **Auto-scheduled task block:** dark surface with a light tint of its colour, a dashed pastel
  border and a hollow check circle. When pinned, the border is solid and a pin icon appears.
- **Routine (sleep, meals):** a muted hatched band (reusing `.hatched`) that spans the column
  behind other blocks. It doesn't take part in side-by-side layout.

## PR 1: Data model, migration and API (backend-led)

**Models** in `backend/app/models.py`:
- `Calendar`:
  - name, `source` (`local` / `ics` / `google`), `is_primary`, `visible`, `color_key`,
    `position`
  - sync fields, all nullable: `external_id`, `sync_token`, `etag`, `last_synced_at`,
    `ics_filename`, `imported_at`
- `Category`: name, `color_key` (required), `position`. Unique on (student, name).
- `CalendarEvent`:
  - calendar_id, category_id (nullable), `color_key` (nullable)
  - title, description, location
  - `start`, `end` (naive local, end exclusive), `all_day`
  - `transparency` (opaque = Busy, transparent = Free), `kind` (`default` / `routine`),
    `status` (`confirmed` / `cancelled`)
  - `recurrence`: JSON list of `RRULE`/`EXDATE` lines
  - `recurring_event_id` and `original_start_time`, for exceptions
  - `ical_uid`, `external_id`, `etag`, `sequence`, timestamps

**New columns** on existing tables, added by the helper: `tasks.category_id`, `tasks.color_key`,
and `recurring_tasks.category_id`. The last is copied when tasks are materialised
(`pipeline.py` ~L117).

**Data migration `fixed_blocks_to_events`:**
- Create the primary "Sype" calendar and the categories "Classes" and "Routine".
- Group blocks by (kind, label, times):
  - `day_of_week` null becomes `FREQ=DAILY`; otherwise it becomes `FREQ=WEEKLY;BYDAY=…`.
  - DTSTART is the first matching day.
  - An overnight block gets an end on the next day.
- Sleep and lunch become `kind=routine`. Every migrated event is Busy.
- `seed_student` seeds events through the same function.

**Scheduler** (`scheduler.py`):
- `build_free_slots` takes absolute `busy: list[tuple[datetime, datetime]]`.
- Rename `_expand` to `expand_weekly`. Productive windows still use it.
- The pipeline adds `busy_intervals(db, sid, start, end)`, which expands opaque, non-cancelled
  occurrences. Hand this to the `scheduler-architect` agent. Algorithm modules must not import DB
  code.

**Routes** (all under `/api`):
- calendars: `GET/POST /students/{sid}/calendars`, `PATCH/DELETE /calendars/{id}`
- categories: `GET/POST /students/{sid}/categories`, `PATCH /categories/{id}`,
  `DELETE /categories/{id}?reassign_to=`
- events:
  - `GET /students/{sid}/calendar-events?start&end` returns occurrences, each with an id of the
    form `{event_id}_{YYYYMMDDTHHMM}`
  - `POST` creates an event; `GET/PATCH/DELETE /calendar-events/{id}`
  - `POST …/calendar-events/restore` is used for Undo
- `TaskCreate`/`TaskUpdate` gain `category_id` and `color_key`.
- Removed: the fixed-block routes and `settings.fixed_blocks`.
- `/meta` returns the `colors` palette keys in place of `block_kinds`.

**Frontend, minimal so the app keeps working:**
- Add the types to `types/api.ts` and the calls to `lib/api.ts`.
- The current week grid draws occurrences, through a new `hooks/use-calendar-events.ts`, in
  place of `expandRecurring(fixed_blocks)`.

**Tests:**
- `test_recurrence.py`: DTSTART edges, overnight, DST, exceptions
- the migration helper against an old-schema database
- the fixed-block migration
- event and category API tests
- `test_scheduler.py` fixtures updated to `expand_weekly(...)` busy lists

**Docs:**
- `architecture.md`: data model; busy time now means opaque events; the migration helper
- `backend.md`: the new routes, `recurrence.py`, and the `build_free_slots` signature
- `setup.md`: the `python-dateutil` dependency, and backing up the database before migrating
- `CLAUDE.md`: the "fixed blocks recur weekly" convention changes

Also commit this design as `docs/superpowers/specs/2026-10-18-gcal-calendar-design.md`.

## PR 2: Google-Calendar-style UI

**Primitives** in `components/ui/`, from the installed `radix-ui` package: `popover`, `tabs`,
`checkbox`, `toggle-group`.

**Components** in a new `components/calendar/`:
- `calendar-toolbar`: Today, previous/next, the period title, a view dropdown, search
- `calendar-sidebar`: a Create button, `mini-month`, `calendar-list` with visibility checkboxes,
  `category-list` with `category-manager-dialog` and `color-swatch-picker`
- views:
  - `time-grid`, generalised from `week-grid.tsx` to 1, 3 or 7 columns
  - `all-day-row`, `month-view` (with "+N more"), `schedule-view`
- blocks: `event-chip`, `task-block`, `routine-band`
- popovers and dialogs:
  - `quick-create-popover` (Event | Task)
  - `event-popover`: edit, delete, duplicate, colour/category
  - `event-dialog`: the full edit form
  - the task-slot popover reuses `SlotDetail` from `slot-sheet.tsx`
- `search-results`

**Interactions:**
- A new `hooks/use-grid-pointer.ts` reuses the pointer-capture pattern from
  `week-grid.tsx` L91-142 for create, move and resize (bottom edge), snapping to 15 minutes.
- A new `hooks/use-calendar.ts` makes changes appear straight away and shows a sonner Undo toast,
  instead of the reload-everything `run()`.
- Keep `layoutColumns` from `lib/time.ts` for side-by-side overlap layout.

**URL state:** `/?view=day|3day|week|month|schedule&date=YYYY-MM-DD&q=`. With no view in the URL,
the last view is taken from localStorage.

**Shortcuts:** calendar-only keys in `pages/calendar.tsx`. In `app.tsx` (~L46-59), chat moves to
Ctrl+C with the selection and editable-field guard, and `/` is handed to calendar search on `/`.

**Pure logic in `src/lib`, each with a Vitest file:**
- `calendar-view.ts` (range, step, title, URL params)
- `time.ts` additions (`splitAcrossDays`, `monthGrid`, `yToMinute`) and the first tests for
  `layoutColumns`
- `drag.ts` (`applyMove`, `applyResize` with a 15-minute minimum, `normaliseCreate`)
- `colors.ts` (palette and effective-colour fallback)
- `shortcuts.ts`, `event-search.ts`, `schedule-list.ts`

**Backend:** `GET /students/{sid}/calendar-events/search?q` and the task colour/category fields.

**Docs:** `frontend.md` (views, URL params, shortcuts, palette, component map) · `backend.md` ·
`README.md`.

## PR 3: Editing recurring events

- **Backend:**
  - `PATCH/DELETE /calendar-events/{id}?scope=this|following|all&original_start=…`
  - `this` writes an exception row (a cancelled one for a delete).
  - `following` splits the series: `recurrence.split_series` sets `UNTIL` on the old series and
    starts a new one.
  - Responses return `affected[]` snapshots for Undo.
- **Frontend:**
  - `recurrence-select` (Does not repeat / Daily / Weekly on X / Every weekday / Monthly /
    Annually / Custom…), `custom-recurrence-dialog` and `recurrence-scope-dialog`
  - `lib/recurrence.ts` builds and describes RRULEs, with tests
- **Docs:** `backend.md` · `architecture.md` · `frontend.md` · `README.md`

## PR 4: `.ics` import

- **Backend:** `POST /students/{sid}/calendars/import` with JSON
  `{filename, content, name?, color_key?, category_id?}`, capped at 5 MB.
  - Uses the `icalendar` library.
  - Each import creates a new `source=ics` calendar.
  - Mapping: `TRANSP` to Busy/Free, `RECURRENCE-ID` to exceptions, `STATUS:CANCELLED`, `UID` to
    `ical_uid`, and `TZID` converted to naive local time.
  - Returns `{calendar, imported, skipped, warnings}`.
  - Tests use fixture `.ics` files from Google, Outlook and Canvas.
- **Frontend:** `import-calendar-dialog` reads the file with `File.text()`. The calendar list
  gets a source icon and delete.
- **Docs:** `setup.md` (`icalendar`) · `backend.md` (mapping) · `architecture.md` (sync fields)
  · `README.md`

## PR 5: Pinned task blocks, learning and Time Insights

Hand the scheduler and pipeline work to `scheduler-architect`.

**Pinning and slot history:**
- Slots gain `pinned` and `pinned_at`.
- Regenerate deletes only unpinned slots that start at or after now. Past slots stay as history.
- Pinned and in-progress slots count as busy time.
- `committed_minutes` and `committed_until` reduce the work left for an item and seed phase order.
- If a pinned later phase leaves no room, the earlier phase reports why it couldn't be placed.
- Complete or skip deletes only future slots.
- Renaming a task renames its subtasks in place, so history survives.

**Move and resize (`reschedule`):**
- Pins the slot without re-flowing anything else.
- Writes a `slot_adjustments` row: from/to times, action, task_type, category, phase,
  productive-window flags, minutes before due.
- Adds `POST/DELETE …/slots/{id}/pin`.

**Preferences** (`backend/app/preferences.py`, pure):
- Builds 24-hour profiles per category, falling back to per task type. Each move adds weight to
  the hour it went to and takes some from the hour it left. Weights decay over 21 days, and a
  profile needs at least 5 moves on 3 different days.
- In `schedule()`:
  - Only for items that aren't overdue and aren't due within a day.
  - Choose among candidate starts within 24 hours of the earliest feasible one.
  - Move only when the gain is at least 0.2.
- Safeguard: keep the biased plan only if it doesn't add any unschedulable items. Rankings never
  change, so phase precedence and overdue-ASAP stay intact.

**Insights:**
- `GET …/insights?start&end` returns:
  - minutes per category (or colour), as the union of Busy, non-routine occurrences plus task
    slots
  - planned/done/skipped/missed for task slots
- `GET …/preferences` shows what was learned.
- Frontend: `insights-panel.tsx` as a side panel. Invoke the `dataviz` skill first. The Rebuild
  tooltip text changes.

**Docs:**
- `architecture.md`: "wipe and rebuild" becomes "keep pinned and past slots"; how pins interact
  with precedence and overdue
- `backend.md` and `ml.md`: the first reader of behaviour data
- `frontend.md`, `README.md`, and the `CLAUDE.md` conventions

## Verification (every PR)

- Run all standard checks, or dispatch `test-runner`:
  - `cd backend && ../.venv/bin/python -m pytest -q`
  - `npm run lint --prefix frontend` · `typecheck` · `test` · `build`
- Run `./dev.sh --seed` and walk the PR's feature in the browser through the `run` skill:
  - PR1: classes, sleep and lunch appear as events; regenerate avoids Busy events but not Free
    ones.
  - PR2: every view and shortcut; drag create, move and resize; Undo; search; colours; Ctrl+C
    copies selected text but toggles chat otherwise.
  - PR3: edit and delete with each scope.
  - PR4: import a real Google Calendar `.ics` export.
  - PR5: drag a task block, Rebuild, and the block stays; after 5 or more moves, placement shifts;
    the insights totals add up.
- Copy a pre-migration `task_scheduler.db` and confirm it upgrades without losing any data.
- Run `superpowers:verification-before-completion` and `code-review` before each PR.
- Push or open PRs only with the user's explicit go-ahead.
