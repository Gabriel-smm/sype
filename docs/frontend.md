# Frontend

React 19 + TypeScript (strict) + Vite + Tailwind 4, with shadcn-style primitives on Radix. Also
uses react-router, lucide-react icons, motion, sonner toasts, date-fns, and Inter via
`@fontsource-variable/inter`. The `@/` import alias maps to `frontend/src`. In development Vite
proxies `/api` to the backend, so the app is same-origin.

## Layout

| Path | Role |
|---|---|
| `src/app.tsx` | Router and app-level state wiring. |
| `src/pages/` | Routed screens: `/` Today (`today.tsx`), `/calendar`, `/tasks` (triage), `/setup`. `/week` redirects to `/calendar`. |
| `src/components/ui/` | Primitives (Radix + `cva`): button, input, card, badge, dialog, sheet, dropdown-menu, slider, switch, tooltip, avatar, sidebar, sonner. |
| `src/components/layout/` | Sidebar + 70/30 shell with the Co-Pilot panel, background, section labels. |
| `src/components/{tasks,schedule,setup,chat}/` | Feature pieces: capture dialog and task sheet, week grid and slot sheet, block/weights/recurring editors, chat panel. |
| `src/hooks/` | `use-app-data` (fetching, mutations, toasts), `use-chat` (conversation kept across pages), `use-sidebar`, `use-mobile`, `use-now`. |
| `src/lib/` | API client, week arithmetic (`time.ts`), task vocabulary and colours (`task-meta.ts`), capture parser (`parse-capture.ts`), Today agenda (`agenda.ts`). Pure logic. |
| `src/types/api.ts` | Hand-written mirror of `backend/app/schemas.py`. **Change both together.** |
| `src/index.css` | Design tokens. |

The Co-Pilot chat sits in a resizable panel beside every page (a sheet on phones) and streams
the backend's SSE events. It says plainly when no model is connected.

## Design system

Defined in `src/index.css`, dark only:

- **Black glass, one blue accent.** Text is graded by white opacity (100 / 70 / 60 / 40), not by a
  grey ramp, so the accent is the only colour that isn't information.
- **Task-type hues are information, never decoration** (`--color-type-*`, `lib/task-meta.ts`).
- Inter Variable, `--radius` 0.75rem, zinc sidebar surfaces shared by cards.

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
