# Frontend

React 19 + TypeScript (strict) + Vite + Tailwind 4, with shadcn-style primitives on Radix. Also
uses react-router, lucide-react icons, motion, sonner toasts, date-fns, and Inter via
`@fontsource-variable/inter`. The `@/` import alias maps to `frontend/src`. In development Vite
proxies `/api` to the backend, so the app is same-origin.

## Layout

| Path | Role |
|---|---|
| `src/app.tsx` | Router and app-level state wiring. |
| `src/pages/` | Routed screens: `/` Calendar (`calendar.tsx`, where the app opens), `/tasks` (triage), `/chat`, `/setup`. `/calendar` and `/week` redirect to `/`. |
| `src/components/ui/` | Primitives (Radix + `cva`): button, input, card, badge, dialog, sheet, dropdown-menu, slider, switch, tooltip, avatar, sidebar, sonner. |
| `src/components/layout/` | Sidebar, the shell with the chat drawer, section labels. |
| `src/components/{tasks,schedule,setup,chat}/` | Feature pieces: capture dialog and task sheet, week grid and slot sheet, block/weights/recurring editors, chat conversation, thread list and drawer panel. |
| `src/hooks/` | `use-app-data` (fetching, mutations, toasts), `use-chat` (saved chat threads, shared by the page and the drawer), `use-sidebar`, `use-mobile`, `use-now`. |
| `src/lib/` | API client, week arithmetic (`time.ts`), task vocabulary and colours (`task-meta.ts`), capture parser (`parse-capture.ts`), where a new task landed (`agenda.ts`), chat threads (`chat-threads.ts`). Pure logic. |
| `src/types/api.ts` | Hand-written mirror of `backend/app/schemas.py`. **Change both together.** |
| `src/index.css` | Design tokens. |

## Chat

- **`/chat`** is the full page: saved chats on the left (`chat/thread-list.tsx`, a sheet on
  phones), the conversation in a centred column (`chat/chat-conversation.tsx`).
- **Drawer** (`chat/chat-panel.tsx` in a `Sheet`): on every other page, the chat slides over the
  page from the right (440px, light scrim), opened from the **Ask Sype** button in the bottom-right
  corner or with `C`. The page never resizes. It starts closed, closes on navigation and is not
  remembered across reloads. Phones open it full width from the top bar. It is hidden on `/chat`.
- **Threads** live in the browser only (`localStorage['sype.chat.v1']`, parsed defensively by
  `lib/chat-threads.ts`). The backend is stateless: each message sends the thread's full history.
  A reply keeps streaming into its own thread if you switch away. Empty chats are not saved.
- It streams the backend's SSE events and says plainly when no model is connected.

Shortcuts: `N` or `/` new task, `C` chat drawer, `Ctrl+B` sidebar.

## Design system

Defined in `src/index.css`, dark only:

- **Dark navy, one blue accent.** Text is graded by white opacity (100 / 70 / 60 / 40), not by a
  grey ramp, so the accent is the only colour that isn't information.
- **Task-type hues are information, never decoration** (`--color-type-*`, `lib/task-meta.ts`).
  In chat and lists they shrink to a thin edge or a dot; text and fills stay neutral.
  Blue marks "now" and the primary action, red only overdue.
- **One flat dark navy background** (`--background`, `#0a0f1a`), no gradient or glow.
- **Pages are transparent** over that background, edged by a faint `white/10` outline (`Card`).
  Only the sidebar and overlays (dialogs, sheets, menus, toasts) use the zinc glass surface.
- **The sidebar** starts expanded with page names and collapses to an icon rail from its header
  button or `Ctrl+B` (remembered in `localStorage['sidebar_state']`).
- Inter Variable, `--radius` 0.75rem.

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
