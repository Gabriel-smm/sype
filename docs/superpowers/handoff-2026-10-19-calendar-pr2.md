# Handoff: Google-Calendar-style calendar, PR 2 (#55)

**Branch:** `feat/55-calendar-ui`, stacked on `feat/54-calendar-data-model`, which is open as PR #59. Nothing is pushed.

**Plan:** `docs/superpowers/plans/2026-10-19-calendar-ui.md`.

**Spec:** `docs/superpowers/specs/2026-10-18-gcal-calendar-design.md`.

**Execution ledger:** `.superpowers/sdd/2026-10-19-calendar-ui/progress.md`. It is git-ignored and local only. It holds every review finding, deferred minor and ruling, plus the briefs, reports and shared implementer and reviewer instructions.

## Done (each task reviewed and approved)
| Task | Commits |
|---|---|
| 1 Backend: slot colour, event search, 1970–2200 range | 623e4ec |
| 2 Pastel palette (`lib/colors.ts`, `--color-cat-*`) | afafcf9 |
| 3 Popover / Tabs / Checkbox primitives | fc66716, 8224de2 |
| 4 View + range logic (`lib/calendar-view.ts`) | eb88c93 |
| 5 Drag + all-day maths (`lib/drag.ts`, DST-safe) | b82df4e, 57ef9b0 |
| 6 `hooks/use-calendar.ts` (optimistic, Undo) | 95702f4, 981c2de |
| 7 Time grid (day/3-day/week) | cebbd95, 69c792b, be5b92a |
| 8 Month + schedule views | fd37709, 8ed82dc |
| 9 Quick-create, event popover, edit dialog, pickers | eab7937, fc4a158 |

## In progress
- **Task 10, page assembly:** implemented in 7c3dddc, 975a714 and bc8565b. Lint, typecheck, Vitest (186) and build pass. **Its review has not run yet.**
- **Unchecked:** the implementer flagged the following, none checked in a browser.
  - The phone side-panel sheet animation.
  - The anchor position when `c` opens quick-create.
  - Categories open the manager dialog from a pencil button, not from a per-row menu.

## Next steps (to resume)
1. Re-read the ledger. Then run the Task 10 review using `.superpowers/sdd/2026-10-19-calendar-ui/reviewer-instructions.md`.
   - Brief: `task-10-brief.md` and `task-10-integration-notes.md`.
   - Report: `task-10-report.md`.
   - Diff: run `review-package` for `fc4a158..bc8565b`.
   - Use Opus.
2. **Task 11, docs and verification:**
   - Update `docs/frontend.md`. This must include fixing the stale `--color-type-*` line and noting that the resize handle is pointer-only, with the edit dialog as the keyboard path.
   - Update `docs/backend.md` (search route, slot colour, range limit) and `README.md`.
   - Run all checks.
   - Run `./dev.sh --seed` against a copy of the database.
   - Do a browser walkthrough, or give the user a manual checklist.
3. Run the final whole-branch review (Opus), passing it the ledger's deferred minors.
4. With the user's OK: push, then `gh pr create --base dev`, with `Closes #55`. Merge #59 first, or note that this PR is stacked on it.

## Rulings to check
- **Keyboard (`n`):** `n` stays "new task" everywhere. On the calendar, `j` is next and `k`/`p` is previous.
- **Keyboard (Ctrl+C):** Ctrl+C opens and closes chat, but only when no text is selected and you're not typing.
- **Month view (cells):** cells show 3 items, or 2 plus "N more", as Google does.
- **Month view (create):** `c` creates an all-day draft, because the cells themselves aren't keyboard-focusable.
- **Clicks:** a click on empty grid floors to the 15-minute slot that was pressed, then makes a 60-minute draft.
- **Dragging:** moving an overnight event (sleep) clamps only the part you grabbed, so it doesn't get squashed. Same-day events can't be dragged across midnight.
- **Repeating events:** dragging one occurrence shows "Repeating events can't be moved one at a time yet" and does nothing. Edits and deletes apply to the whole series, until PR 3.
- **Plan correction:** the plan's "Feb 2026 = 6 month rows" was wrong. It is 5 rows, and March 2026 is the 6-row test instead.
