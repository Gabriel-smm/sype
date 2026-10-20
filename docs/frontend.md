# Frontend

React 19 + TypeScript (strict) + Vite + Tailwind 4, with shadcn-style primitives on Radix. Also
uses react-router, lucide-react icons, motion, sonner toasts, date-fns, and Inter via
`@fontsource-variable/inter`. The `@/` import alias maps to `frontend/src`. In development Vite
proxies `/api` to the backend, so the app is same-origin.

## Layout

| Path | Role |
|---|---|
| `src/app.tsx` | Router and app-level state wiring. |
| `src/pages/` | Routed screens: `/` Calendar (`calendar.tsx`, where the app opens, see **Calendar** below), `/tasks` (triage), `/chat`, `/setup` (focus hours, routines, ranking, activity; busy time is calendar events, so it has no editor). `/calendar` and `/week` redirect to `/`. |
| `src/components/ui/` | Primitives (Radix + `cva`): button, input, card, badge, dialog, sheet, dropdown-menu, popover, tabs, checkbox, slider, switch, tooltip, avatar, sidebar, sonner. |
| `src/components/layout/` | Sidebar, the shell with the chat drawer, section labels. |
| `src/components/{tasks,schedule,setup,chat}/` | Feature pieces: capture dialog and task sheet, slot sheet and week strip, focus-hours/weights/recurring editors, chat conversation, thread list and drawer panel. |
| `src/components/calendar/` | The calendar page: toolbar, time grid, all-day row, month and schedule views, event chips, task blocks, routine bands, popovers, event dialog, side panel (mini month, calendar and category lists), search results. |
| `src/hooks/` | `use-app-data` (fetching, mutations, toasts), `use-calendar` (events, calendars, categories and optimistic mutations for a visible range), `use-calendar-page` (the page's state and shortcuts), `use-chat` (saved chat threads, shared by the page and the drawer), `use-grid-pointer`, `use-sidebar`, `use-mobile`, `use-now`. |
| `src/lib/` | API client, week arithmetic (`time.ts`), task vocabulary (`task-meta.ts`), capture parser (`parse-capture.ts`), where a new task landed (`agenda.ts`), chat threads (`chat-threads.ts`), and the calendar's pure logic: `calendar-view.ts` (views, ranges, titles, URL params), `drag.ts` (gesture maths), `colors.ts` (palette), `calendar-state.ts` (optimistic list transforms), `schedule-list.ts` (agenda grouping), `shortcuts.ts` (key resolution). |
| `src/types/api.ts` | Hand-written mirror of `backend/app/schemas.py`. **Change both together.** |
| `src/index.css` | Design tokens. |

## Calendar

`/` is a Google-Calendar-style page: toolbar (Today, step, title, view switcher, search), time grid
or month or schedule list, and a side panel (mini month, calendars, categories) that is a sheet on
phones.

- **Views:** day, 3 days, week, month, schedule. The view and date are URL params (`?view=week&date=2026-10-19`);
  the last view is remembered in `localStorage['sype.calendar.view']` (phones default to day) and
  the panel's open state in `sype.calendar.panel`.
- **Gestures** (`lib/drag.ts`, `hooks/use-grid-pointer.ts`): drag on empty grid to create, drag an
  event to move it, drag its bottom edge to resize (15-minute snap, Esc or pointer cancel aborts).
  A click opens the popover (edit, duplicate, delete with Undo). The resize handle is pointer-only:
  keyboard users edit times in the event dialog. Repeating events cannot be dragged one occurrence
  at a time yet; edit the series in the dialog.
- **Quick create** turns a click or drag into an event or a task. Moves and deletes are optimistic
  (`use-calendar`) and roll back with an error toast when the request fails.
- **Overnight and multi-day events** split across day columns; events of 24h or longer go in the
  all-day row (`isAllDayLike`).
- **Search** (`/` or the toolbar) calls `calendar-events/search` and lists matches; picking one jumps there.

### Event looks

Four looks, chosen by `eventLook` in `lib/colors.ts`:

| Look | Drawn as |
|---|---|
| Busy | Solid pastel fill, dark ink. |
| Free | 1px pastel border on a faint fill, pastel text. |
| Task block | Tinted fill, dashed pastel border, hollow circle that marks it done. Overdue uses the red border. |
| Routine | Hatched band behind events, not draggable. |

## Chat

- **`/chat`** is the full page, edge to edge (the shell drops its gutter there, `AppShell flush`): a
  slim bar with the chat title, whose chevron opens Rename/Delete, then the conversation in a
  centred 48rem column (`chat/chat-conversation.tsx`, 16px text, roomy gaps), with the composer
  and a one-line note at the bottom.
- **Past chats** are in the app sidebar's collapsible **Chats** section, directly under the page
  links (`NavChats` in `layout/app-sidebar.tsx`, listing `chat/thread-list.tsx`). It opens on
  `/chat` and closes on every other page, resetting on each navigation (it can be toggled by hand
  in between). `+` starts a new chat; picking a chat opens it on `/chat`. The sidebar's **Search
  chats** field filters the list by title (`filterThreads`) and keeps the section open while it
  has a query. Both are hidden on the icon rail.
- **Drawer** (`chat/chat-panel.tsx` in a `Sheet`): on every other page, the chat slides over the
  page from the right as a full-height panel flush with the edge (440px, light scrim, no outline), opened from the **Ask Sype** button in the bottom-right
  corner or with `Ctrl+C`. The page never resizes. It starts closed, closes on navigation and is not
  remembered across reloads. Phones open it full width from the top bar. It is hidden on `/chat`.
- **Threads** live in the browser only (`localStorage['sype.chat.v1']`, parsed defensively by
  `lib/chat-threads.ts`). The backend is stateless: each message sends the thread's full history.
  A reply keeps streaming into its own thread if you switch away. Empty chats are not saved.
  A first run (no stored key) starts with example chats (`placeholderThreads`); once saved they are
  ordinary chats, and deleting them does not bring them back.
- It streams the backend's SSE events and says plainly when no model is connected.

## Shortcuts

- **Everywhere:** `n` new task, `/` new task (on the calendar it searches instead), `Ctrl+C` chat
  drawer (only when no text is selected and you are not typing, so copy still works), `Ctrl+B` sidebar.
- **Calendar page:** `d` `x` `w` `m` `a` day, 3 days, week, month, schedule; `t` today; `j` next,
  `k` or `p` previous; `c` create (an all-day draft in month view); `e` edit the selected event;
  `Delete` or `Backspace` delete it; `/` search; `Esc` closes the topmost overlay or clears the selection.
  Single keys are off while typing and with any modifier (`lib/shortcuts.ts`).

## Design system

Defined in `src/index.css`, dark only:

- **Dark navy, one blue accent.** Text is graded by white opacity (100 / 70 / 60 / 40), not by a
  grey ramp, so the accent is the only colour that isn't information.
- **Colour is information, never decoration.** One pastel palette (`--color-cat-*`, mirrored in
  `lib/colors.ts`) colours calendars, categories, events and tasks. The effective colour is the
  category's, else the item's own, else the calendar's; a task with none uses its type's default
  (`typeDefaultColor`). In chat and lists it shrinks to a thin edge or a dot; text and fills stay neutral.
  Blue marks "now" and the primary action, red only overdue.
- **One flat dark navy background** (`--background`, `#0a0f1a`), no gradient or glow.
- **Pages are transparent** over that background, edged by a faint `white/10` outline (`Card`).
  Overlays (dialogs, sheets, menus, toasts) use the zinc glass surface.
- **The sidebar** is flush with the window edge: full height, no rounding, a faint `white/5` tint
  and one straight `white/10` line between it and the page. It is 18rem wide. Top to bottom: the
  collapse button and wordmark, Search chats, New task and the pages (`size="nav"` rows: 40px,
  20px icons, 15px text), the Chats history, then the account menu behind a top line. It starts expanded with page names and collapses to an icon rail from its header
  button or `Ctrl+B` (remembered in `localStorage['sidebar_state']`).
  Toggling fades the contents out (60ms), resizes the empty bar (150ms), then fades the new
  contents in (100ms), so labels never squeeze into the rail; skipped under reduced motion.
- **Type**: Styrene B when available, else Inter Variable. Styrene is licensed, so it is never
  committed: `@font-face` in `index.css` uses a locally installed copy or files in
  `public/fonts/` (git-ignored, see `docs/setup.md`). `--radius` 0.75rem.

## UI guidelines

Before any UI work, invoke the `frontend-design:frontend-design` skill. The app must not look
AI-generated:

- Reuse tokens and `components/ui` primitives. Don't introduce new colours, fonts or radii ad hoc.
- No purple or rainbow gradients, emoji as icons, generic marketing copy, or a grid of identical
  rounded cards.
- Motion and shadow only where they carry meaning (state change, focus, hierarchy).
- Copy is specific and plain, in the voice of someone running their own week.
- Check phone width: the shell collapses to sheets on mobile.

## Tests & checks

```bash
npm test --prefix frontend        # Vitest: src/lib/*.test.ts
npm run typecheck --prefix frontend
npm run lint --prefix frontend    # oxlint
npm run build --prefix frontend
```

Pure logic belongs in `src/lib/` with a Vitest file next to it.
