# Calendar UI (PR 2 of 5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the calendar page with Google Calendar's layout and interactions, in Sype's dark palette. That covers:
- day, 3-day, week, month and schedule views
- drag to create, move and resize
- quick-create (Event | Task), event popover and full edit dialog
- pastel colours with categories
- a side panel with a mini month and a calendar list
- search and keyboard shortcuts

**Architecture:**
- Pure view, drag and colour maths live in `src/lib`, each with a Vitest file. Components stay thin.
- One hook, `use-calendar.ts`, owns event, calendar and category state. Mutations update the screen first and offer Undo through sonner. They do not reload everything through `use-app-data.run()`.
- Task blocks still come from `schedule.slots` and keep using `moveSlot`. They are not pinned until PR 5.
- View and date live in the URL.

**Tech Stack:** React 19, TS strict, Tailwind 4, `radix-ui` (Popover, Tabs, Checkbox), date-fns, sonner, lucide-react, Vitest (Node, no DOM). FastAPI for two small backend additions.

**Spec:** `docs/superpowers/specs/2026-10-18-gcal-calendar-design.md` (section "PR 2"). Issue #55.

**Branch:** `feat/55-calendar-ui`, stacked on `feat/54-calendar-data-model` (PR #59). The PR targets `dev` once #59 merges.

## Global Constraints

- Follow Google Calendar's layout, density and interactions exactly, with Sype's dark tokens from `frontend/src/index.css`.
  - Don't add new fonts.
  - The only new colours are the 11 `--color-cat-*` pastels, plus `--radius-event: 4px`.
- Copy is sentence case, plain and specific. Action names stay consistent, so a "Delete" button leads to a "Deleted" toast.
- Colour keys and their order: `rose peach butter pistachio mint aqua sky periwinkle lilac blush stone` (from `/api/meta` `colors`).
- Effective event colour = the occurrence's `color_key`, which the API already resolves.
- Task block colour = the slot's `color_key` from the API (Task 1). If that is null, use `typeDefaultColor(task_type)`.
- Naive local datetimes. Go through `toApiDateTime` / `new Date(isoString)` only.
- The week starts on Monday (`weekStartOf`). Snap to 15 minutes. Minimum event length is 15 minutes. A plain click on an empty slot creates a 60-minute draft.
- Busy is the default for timed events and Free for all-day events (the backend default). The edit dialog shows the toggle.
- Pure logic lives in `src/lib/*.ts` with `*.test.ts` beside it. Vitest has no DOM, so components get no unit tests.
- Every interactive element must be keyboard reachable with a visible focus ring. Respect reduced motion. At phone width (<768px) the side panel is a sheet and the default view is day.
- Don't read `.venv/`, `node_modules/`, `frontend/dist/` or `backend/task_scheduler.db`.
- Standard checks: `cd backend && ../.venv/bin/python -m pytest -q`, then `npm run lint|typecheck|test|build --prefix frontend`.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Visual language

These are Google Calendar's structures in Sype's colours. The skill review: the brief pins the direction, so the one place to be bold is the event colours. Everything else stays quiet.

- **Page:**
  - The toolbar is 56px tall.
  - The left side panel is 256px wide and collapses from the toolbar's panel button.
  - The grid fills the rest. The page sits in the existing `Card`.
- **Toolbar, left to right:**
  - panel toggle (`PanelLeft` icon)
  - `Today`, an outline pill with a `white/20` border
  - `‹ ›` icon buttons
  - the period title (`text-xl` regular), e.g. "October 2026" or "Oct – Nov 2026"
- **Toolbar, right side:**
  - a search icon that expands into a field
  - a view dropdown button showing the current view ("Week ▾"), with shortcut hints in the menu
  - the Rebuild icon
- **Side panel, top to bottom:**
  - **Create:** a large pill (`bg-white/10`, blue `+`, 48px tall). It opens quick-create for the next half hour.
  - **Mini month:** 7 columns of 28px day circles.
    - Today is a solid `primary` circle.
    - The selected date is a `primary/25` circle.
    - Days outside the month are `faint`.
    - Its own `‹ ›` arrows page through months.
  - **My calendars:** collapsible, with a checkbox per calendar tinted with that calendar's colour.
  - **Categories:** collapsible, a swatch and name per category, with a `+` to add and a hover menu to rename, recolour or delete.
- **Day headers:**
  - The weekday is small `faint` text (Google uses an uppercase short weekday, which the brief overrides the skill's no-caps default for).
  - The date is a 26px number in a 44px circle. Today's circle is solid `primary` with a white number.
  - Clicking a header opens that day in day view.
- **Grid:**
  - Hour lines are `white/10`, with no half-hour lines.
  - Gutter labels ("9 AM", from the locale) are right-aligned and sit on the line.
  - The day opens scrolled to 7 AM.
  - The now line is a red 2px line with a 10px dot, today only.
  - Focus hours keep their faint blue band.
- **All-day row:**
  - It sits under the headers and holds all-day events and events of 24h or longer, as solid pastel bars that span days.
  - It collapses to 3 rows plus a "+N" button.
- **Calendar event, Busy:** solid pastel fill, ink text (`#0a0f1a`), `--radius-event`.
  - The title is 12px semibold.
  - The time range is shown when the event is at least 45 minutes long.
  - Events under 30 minutes are one line: "Title, 9:00".
- **Calendar event, Free:** a 1px pastel border on a `pastel/10` fill, with pastel text.
- **Task block (auto-scheduled):**
  - A `color-mix(pastel 16%, background)` fill, a 1px **dashed** pastel border and white text.
  - A hollow circle (`Circle` icon) sits before the title, as Google does for tasks. Clicking the circle marks the task done.
  - Overdue blocks use the alarm red border.
- **Routine (sleep, meals):**
  - A full-width band *behind* events, using `.hatched` stripes tinted with the pastel at about 20% opacity, plus a small pastel label.
  - It is not clickable for drag, and it is excluded from the side-by-side layout.
- **Interaction feedback:**
  - Dragging lifts the event with `shadow-2xl` and shows the live time range.
  - The drag-create ghost is a `primary/30` fill with "9:00 – 10:00".
  - The selected event gets a ring.
- **Month view:**
  - Each cell shows its date number top-centre; today is a solid circle.
  - Timed events are a pastel dot, the time and the title on one line.
  - All-day events are solid bars.
  - A "+N more" button opens a day popover.
  - Clicking empty cell space opens quick-create for an all-day event.
- **Schedule view:**
  - Rows are grouped by day, with the big date number and weekday on the left.
  - Each row has a pastel dot, the time range and the title.
  - It covers today onwards for 30 days; ‹ › moves 30 days.
- **Popovers and dialogs:** the existing zinc overlay surface (`bg-sidebar`, `border-sidebar-border`), 400px wide.
  - Header icon actions: Edit, Delete, Duplicate, Close.
  - Body: a colour square, the title (`text-xl`), "Monday, 19 October · 09:00 – 10:15", location, description and calendar name.
  - A colour and category picker: an 11-swatch grid plus the category list.

---

### Task 1: Backend: slot colour, event search, bounded range

**Files:**
- Modify:
  - `backend/app/api/schedule.py:16-46` (`_slot_out`): add `category_id` and `color_key`. The colour is the task's category colour, else the task's `color_key`, else `None`. For subtasks, use the parent task.
  - `backend/app/schemas.py:230` (`ScheduledSlotOut`): add `category_id: int | None`, `color_key: str | None`.
  - `backend/app/api/calendar.py`: add `GET /api/students/{sid}/calendar-events/search?q=&limit=25`.
    - Match `q` (1–100 chars, after strip) case-insensitively against title, location and description of confirmed series and instance rows.
    - Return `list[OccurrenceOut]` for occurrences between today−365d and today+365d whose row matches, sorted by start and capped at `limit` (1–100).
    - Register the route **before** `/calendar-events/{id}`-style routes, so it isn't shadowed.
  - `backend/app/api/calendar.py` (GET occurrences): reject `start.year < 1970` or `end.year > 2200` with 422. This closes the far-future cost parked in PR 1.
- Test: `backend/tests/test_calendar_api.py`, `backend/tests/test_api.py`

**Tests:**
- `test_slot_reports_task_colour_and_category`:
  - A task in Classes gives slots with `color_key == "sky"` and `category_id` set.
  - A task with only `color_key="mint"` gives "mint".
  - A task with neither gives `None`.
- `test_search_finds_occurrences_by_title_location_description`: the seeded "Bio 101" has two hits in a week window. The limit applies. Case-insensitive.
- `test_search_rejects_blank_query` returns 422.
- `test_search_skips_cancelled_events`
- `test_occurrence_range_outside_supported_years_is_422`
- `frontend/src/types/api.ts`: add `category_id`/`color_key` to `ScheduleSlot`, and `calendarSearch(q)` to `lib/api.ts`. The backend mirror rule applies.

Steps: write the failing tests → run (FAIL) → implement → full backend suite → commit "Add slot colours, event search and a bounded occurrence range".

---

### Task 2: Palette tokens and colour logic

**Files:**
- Modify: `frontend/src/index.css`. Add `--color-cat-<key>` for each key, plus `--radius-event: 4px`. Comment that these are the only event hues.
- Create: `frontend/src/lib/colors.ts`, `frontend/src/lib/colors.test.ts`

**Interfaces (produces):**
```ts
export const COLOR_HEX: Record<ColorKey, string>     // rose #f4a7b9, peach #f8b994, butter #f2dc8f, pistachio #c5e09b, mint #9fdcc0,
                                                     // aqua #93d8dc, sky #a3c4f3, periwinkle #b4b8f2, lilac #cdb4ee, blush #eab2d6, stone #c4c0b8
export const COLOR_LABELS: Record<ColorKey, string>  // "Rose", "Peach", …
export const EVENT_INK = '#0a0f1a'
export function typeDefaultColor(taskType: string): ColorKey
    // essay_project lilac, exam_study blush, problem_set mint, reading sky, admin stone, other butter, routine peach; unknown → stone
export function slotColor(slot: Pick<ScheduleSlot, 'color_key' | 'task_type'>): ColorKey
export function hexFor(key: string | null | undefined): string   // unknown/null → COLOR_HEX.stone
export type EventLook = 'busy' | 'free' | 'routine' | 'task'
export function eventLook(o: Pick<Occurrence, 'kind' | 'busy'>): EventLook   // routine wins over busy/free
```
- `lib/task-meta.ts`: `typeColor()` returns `hexFor(typeDefaultColor(t))`, so the rest of the app's type hues move to the pastels. `TYPE_COLORS` is removed, and so are the `--color-type-*` tokens if nothing references them (grep).

**Tests:**
- Every key has a hex.
- `slotColor` prefers `color_key`.
- The type fallback is covered.
- An unknown key maps to stone.
- `eventLook({kind:'routine', busy:true}) === 'routine'`.
- Free is `'free'`.

Commit "Add the pastel event palette".

---

### Task 3: Popover, Tabs and Checkbox primitives

**Files:**
- Create: `frontend/src/components/ui/popover.tsx`, `tabs.tsx`, `checkbox.tsx`. Wrap `radix-ui`'s `Popover`, `Tabs` and `Checkbox` in the same style as `dropdown-menu.tsx`:
  - `bg-sidebar`, `border-sidebar-border`, `rounded-lg`, open/close fade+zoom.
  - The checkbox takes a `color` prop for its checked fill.
- Modify: `docs/frontend.md`'s primitives list. This can be batched into Task 11, but leave a note in the commit.

There are no unit tests (no DOM). Verify with `npm run lint && npm run typecheck`. Commit "Add popover, tabs and checkbox primitives".

---

### Task 4: View and range logic

**Files:**
- Create: `frontend/src/lib/calendar-view.ts`, `calendar-view.test.ts`

**Interfaces:**
```ts
export type CalendarView = 'day' | '3day' | 'week' | 'month' | 'schedule'
export const VIEWS: { view: CalendarView; label: string; key: string }[]  // Day d, 3 days x, Week w, Month m, Schedule a
export function rangeFor(view: CalendarView, date: Date): { start: Date; end: Date; days: Date[] }
    // day: that day; 3day: date..+2; week: Mon..Sun; month: Monday on/before the 1st through the Sunday on/after the last day (35 or 42 days); schedule: date..+30
export function step(view: CalendarView, date: Date, direction: 1 | -1): Date   // day ±1, 3day ±3, week ±7, month ±1 month (clamped to day 1), schedule ±30
export function titleFor(view: CalendarView, date: Date): string
    // "October 2026"; a week/3day spanning months → "Oct – Nov 2026"; spanning years → "Dec 2026 – Jan 2027"; day → "19 October 2026" (locale)
export function parseViewParams(params: URLSearchParams, fallback: CalendarView): { view: CalendarView; date: Date }
export function toViewParams(view: CalendarView, date: Date): URLSearchParams   // view=week&date=2026-10-19
export function monthGrid(date: Date): Date[][]   // weeks of 7, Monday-first, 5 or 6 rows
```

**Tests:**
- Every view's range, including a month that starts on a Sunday: Feb 2026 gives 6 rows, 26 Jan – 8 Mar.
- `step` for month on Jan 31 lands on Feb 1.
- Each title format.
- Bad URL params fall back.
- A round trip through `toViewParams` and `parseViewParams`.

Commit "Add calendar view and range logic".

---

### Task 5: Drag and layout maths

**Files:**
- Create: `frontend/src/lib/drag.ts`, `drag.test.ts`
- Modify: `frontend/src/lib/time.ts`. Generalise `occurrenceSpans(occurrences, days: Date[])` from a fixed 7 to any day list, and update its callers and tests.

**Interfaces:**
```ts
export const SNAP = 15, MIN_MINUTES = 15, CLICK_MINUTES = 60
export function yToMinute(y: number, hourHeight: number): number            // snapped, clamped 0..1440
export function normaliseCreate(day: Date, fromMinute: number, toMinute: number): { start: Date; end: Date }
    // order-independent; equal (a click) → CLICK_MINUTES from fromMinute; enforces MIN_MINUTES; clamps to midnight
export function applyMove(start: Date, end: Date, dayDelta: number, minuteDelta: number): { start: Date; end: Date }
export function applyResize(start: Date, end: Date, minuteDelta: number): { start: Date; end: Date }   // end-only, ≥ MIN_MINUTES
export function isAllDayLike(o: Pick<Occurrence, 'all_day' | 'start' | 'end'>): boolean            // all_day or ≥ 24h
export function allDayRows(occurrences: Occurrence[], days: Date[]): { occurrence: Occurrence; firstDay: number; span: number; row: number }[]
    // greedy row packing of all-day-like bars over the visible days
```

**Tests:**
- Snapping.
- Upward drag-create.
- A click gives 60 minutes.
- Clamping at midnight.
- A move across days.
- Resize below the minimum gives 15 minutes.
- The all-day packing puts overlapping bars on different rows and a multi-day bar spans correctly.
- Updated `occurrenceSpans` tests for 1 and 3 day lists.

Commit "Add drag, resize and all-day layout maths".

---

### Task 6: `use-calendar` hook

**Files:**
- Create: `frontend/src/hooks/use-calendar.ts`
- Delete: `frontend/src/hooks/use-calendar-events.ts` (replaced)
- Modify: `frontend/src/lib/api.ts`. Add any missing calls: `updateEvent`, `deleteEvent`, `restoreEvent`, calendars and categories CRUD. Most exist from PR 1.

**Interfaces:**
```ts
export function useCalendar(range: { start: Date; end: Date }, refreshKey: unknown): {
  occurrences: Occurrence[]            // filtered to visible calendars
  calendars: Calendar[]; categories: Category[]
  loading: boolean; error: string | null
  createEvent(input: CalendarEventInput): Promise<void>                     // toast "Event created"
  updateEvent(eventId: number, changes: CalendarEventChanges, undo?: CalendarEventChanges): Promise<void>
  moveEvent(o: Occurrence, start: Date, end: Date): Promise<void>          // optimistic; toast "Event moved" + Undo (PATCH back)
  deleteEvent(o: Occurrence): Promise<void>                                // toast "Event deleted" + Undo (restore)
  duplicateEvent(eventId: number): Promise<void>
  setCalendarVisible(id: number, visible: boolean): Promise<void>
  createCategory / updateCategory / deleteCategory(id, reassignTo?)
}
```

Behaviour:
- The hook fetches occurrences when the range strings change, ignoring stale responses (keep the PR 1 `current` flag pattern).
- It clears the list on a range change and exposes `error`. Both of these fix deferred PR 1 minors.
- It fetches calendars and categories once and after their mutations.
- In PR 2, a recurring occurrence is edited at series level only. `moveEvent` on a recurring occurrence shows the toast "Repeating events can be moved from PR 3 on" and does nothing.

Pure helpers it needs go in `lib/calendar-state.ts` with tests: `applyOptimisticMove(list, id, start, end)` and `withoutCalendar(list, hiddenIds)`.

Commit "Add the calendar data hook with optimistic moves and undo".

---

### Task 7: Time grid (day, 3-day, week)

**Files:**
- Create: `frontend/src/components/calendar/time-grid.tsx`, `all-day-row.tsx`, `event-chip.tsx`, `task-block.tsx`, `routine-band.tsx`, `hooks/use-grid-pointer.ts`
- Delete: `frontend/src/components/schedule/week-grid.tsx`, once the page is switched in Task 10. Until then both exist.

**Props:**
```ts
TimeGrid({ days, occurrences, slots, productiveHours, selected, onSelectEvent(o, anchor), onSelectSlot(slot),
           onCreateDraft(start, end, anchor), onMoveEvent(o, start, end), onResizeEvent(o, start, end),
           onMoveSlot(slot, start, end), onCompleteSlot(slot), onOpenDay(day) })
```

Behaviour:
- Lay out timed occurrences (not routine, not all-day-like) and task slots together per day with `layoutColumns`.
- Routine spans render behind.
- `use-grid-pointer` reuses the pointer-capture pattern of `week-grid.tsx:92-143` and does the maths through `lib/drag.ts`. It handles three gestures:
  - **create:** pointerdown on empty grid, drag (or click), release → `onCreateDraft`, with a ghost while dragging
  - **move:** an event or task block → `onMoveEvent`/`onMoveSlot`
  - **resize:** a 6px bottom handle on events and task blocks → `onResizeEvent`/`onMoveSlot`
- Esc cancels a drag. A drag under 4px counts as a click (select).
- The `anchor` (a DOMRect or virtual element) positions popovers.

Verify with lint and typecheck. Commit "Add the day, 3-day and week time grid".

---

### Task 8: Month and schedule views

**Files:**
- Create: `frontend/src/components/calendar/month-view.tsx`, `schedule-view.tsx`, `day-popover.tsx` (for "+N more")
- Create: `frontend/src/lib/schedule-list.ts` with a test. `groupByDay(occurrences, slots, start, days) → { day, items: ({kind:'event', o} | {kind:'task', slot})[] }[]` lists empty days only for today and sorts by start.

Behaviour:
- **Month:** up to 3 chips per cell (fewer as the cell height requires; a fixed 3 is fine), then "+N more". Clicking a date number opens day view.
- **Schedule:** "Nothing planned" on empty ranges, with a Create button.

Commit "Add month and schedule views".

---

### Task 9: Quick-create, event popover, edit dialog, colour picker

**Files:**
- Create in `frontend/src/components/calendar/`: `quick-create-popover.tsx`, `event-popover.tsx`, `event-dialog.tsx`, `color-category-picker.tsx`, `category-manager-dialog.tsx`

Behaviour:
- **Quick-create**, Event tab:
  - The title input is autofocused, with the date and time line shown read-only.
  - "More options" opens the dialog with the draft.
  - Saving calls `createEvent` with `busy` defaulted by the backend.
- **Quick-create**, Task tab:
  - Title, plus "Due {end time}". The rest comes from the existing capture defaults: `task_type` "other", the duration equals the dragged length (minimum 15), stress 3.
  - It calls `actions.createTask`, which already regenerates and toasts the placement.
- **Event popover:** described in Visual language. Delete calls `deleteEvent` (Undo is in the hook). Duplicate works as in Google: it opens `event-dialog` prefilled with the same fields and times, without an id, and saving creates a new event.
- **Edit dialog** fields:
  - Title
  - All day
  - Start date/time and end date/time (`input type=date|time`)
  - Busy/Free (`Switch`), labelled "Show as busy"
  - Calendar (select)
  - Colour and category (the picker)
  - Location
  - Description

  Validation: the end must be after the start ("End time must be after the start time"). It sends a PATCH with only the changed fields, or a POST for a new event.
- **Picker:** 11 swatches with accessible names from `COLOR_LABELS`, then the categories. Picking a category sends `category_id`. Picking a swatch sends `color_key` (the backend clears the category).
- **Category manager:** add, rename, recolour, delete. Delete asks to "Move its events to…" (a select) or "Keep their colour".

Commit "Add quick create, event popover and the event editor".

---

### Task 10: Page assembly, side panel, toolbar, search, shortcuts

**Files:**
- Rewrite: `frontend/src/pages/calendar.tsx`
- Create in `frontend/src/components/calendar/`: `calendar-toolbar.tsx`, `calendar-side-panel.tsx`, `mini-month.tsx`, `calendar-list.tsx`, `category-list.tsx`, `search-results.tsx`
- Create: `frontend/src/lib/shortcuts.ts`, `shortcuts.test.ts`
- Modify:
  - `frontend/src/app.tsx:45-59`: chat becomes **Ctrl+C**, only when `window.getSelection()?.toString()` is empty and the user isn't typing; it toggles. On the Calendar route (`/`), `/` and `c` are not handled by the app; the page handles them. `n` stays "new task" everywhere.
  - `app.tsx`: pass `actions`, `meta` and `tasks` to `CalendarPage` as needed.
  - The chat drawer's "C" hint text, wherever it's shown (grep "Ask Sype" / the `Kbd` usage).
- Delete: `frontend/src/components/schedule/week-grid.tsx`

**Interfaces:**
```ts
export type CalendarShortcut =
  | { type: 'view'; view: CalendarView } | { type: 'today' } | { type: 'step'; direction: 1 | -1 }
  | { type: 'create' } | { type: 'edit' } | { type: 'delete' } | { type: 'search' } | { type: 'escape' }
export function resolveShortcut(e: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'>, typing: boolean): CalendarShortcut | null
    // d x w m a → views; t today; j/n next, k/p previous; c create; e edit; Delete/Backspace delete; / search; Escape escape; any modifier → null; typing → only Escape
export function shouldToggleChat(e: Pick<KeyboardEvent,'key'|'ctrlKey'|'metaKey'|'altKey'>, typing: boolean, selectionText: string): boolean
    // ctrlKey && key 'c' && !meta && !alt && !typing && selectionText === ''
```

**Page behaviour:**
- URL params go through `parseViewParams` and `toViewParams`. The last view is kept in `localStorage['sype.calendar.view']` (in a try/catch), used when the URL has no `view`.
- The phone default is day.
- The side panel's open state is stored in `localStorage['sype.calendar.panel']`. The panel is a `Sheet` under 768px.
- The search field submits to `calendarSearch`. Results replace the grid with `search-results` (date, time, title, colour dot). Clicking a result jumps to that date in day view and opens the popover. Esc clears.
- A selected task slot opens the existing `SlotSheet`. Clicking a task block's circle calls `onComplete`.
- The Rebuild tooltip stays "Rebuild the week. This also undoes sessions you dragged." until PR 5.

**Tests (`shortcuts.test.ts`):**
- Every key mapping.
- Modifiers block shortcuts.
- Typing blocks everything except Escape.
- `shouldToggleChat` is false with a selection, false with meta, and true for plain Ctrl+C.

Commit "Assemble the Google-Calendar-style page with panel, search and shortcuts".

---

### Task 11: Docs and verification

**Files:**
- Modify:
  - `docs/frontend.md`:
    - the calendar page structure, views and URL params
    - shortcuts, including chat on Ctrl+C
    - the palette and the four event looks
    - the new primitives and the component map
    - `use-calendar`
    - drop the `use-calendar-events` and `week-grid` mentions
  - `docs/backend.md`: the search route, slot `color_key`/`category_id`, and the 1970–2200 occurrence range.
  - `README.md`: user-facing calendar features (polished, no internals).
  - `CLAUDE.md`: no change unless a convention changed.

Verification:
1. All standard checks.
2. `./dev.sh --seed` against a scratch copy of the DB (`TASK_SCHEDULER_DB=…`).
3. Through the `run` skill or a headless browser if one is available, walk each view, drag-create, move, resize, Undo, search, colours, shortcuts, and Ctrl+C with and without a text selection. If no browser can be driven, say so plainly and list the manual checks for the user.

Commit "Document the calendar UI".

---

## Review Focus

1. **Drag gestures conflicting with scrolling and clicking.**
   - A 3px wobble on click must open the popover, not move the event.
   - Dragging an event must not start a create underneath it.
   - Pointer capture must be released on Esc and on pointercancel.

   Tests are in Task 5's maths. Task 7's implementer must handle `pointercancel`.
2. **Overnight and multi-day events.**
   - Sleep from 23:30 to 07:30 splits across two columns in the week view.
   - In the 3-day and day views, only the visible parts show.
   - A 2-day timed event goes in the all-day row (`isAllDayLike`).

   Tests: Task 5 (`occurrenceSpans` with day lists, `isAllDayLike`).
3. **Undo after a failed request.** If the PATCH or DELETE fails, the optimistic change is rolled back and the error is shown. Undo after a successful delete restores the event. Test: Task 6 `calendar-state` helpers (rollback is the inverse apply).
4. **Shortcuts firing while typing**, in the quick-create title or the search field, and Ctrl+C with selected text. Tests: Task 10 `resolveShortcut` and `shouldToggleChat`.
5. **Month and year boundaries.** "Dec 2026 – Jan 2027" titles, month stepping from the 31st, and the 6-row months. Tests: Task 4.
