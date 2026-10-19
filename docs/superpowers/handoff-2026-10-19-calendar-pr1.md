# Handoff: Google-Calendar-style calendar, PR 1 (#54)

Branch `feat/54-calendar-data-model`, 13 commits on `dev`, last one `daf90dc`. Nothing has been pushed and no PR is open.

- Design: `docs/superpowers/specs/2026-10-18-gcal-calendar-design.md`, covering the 5-PR series in issues #54–#58.
- Plan: `docs/superpowers/plans/2026-10-18-calendar-data-model.md`.
- Execution ledger, with every review finding: `.superpowers/sdd/2026-10-18-calendar-data-model/progress.md`. The folder is git-ignored and local only.

## Done
- All 9 plan tasks are built, and each one passed its review:
  - recurrence expansion
  - the scheduler takes absolute busy intervals
  - calendars, categories and calendar events, with an in-place SQLite migration that turns fixed blocks into events
  - busy time comes from Busy events
  - calendar, category and event APIs
  - tasks and routines carry a category and colour
  - the week grid draws event occurrences
  - docs and CLAUDE.md
- Checks at `b120e23`: pytest 202 passed. Lint, typecheck, Vitest (82) and build were all clean.
- A copy of the real `task_scheduler.db` upgraded cleanly:
  - 20 occurrences in the week
  - no duplicates after a restart
  - the generated schedule overlaps no Busy occurrence
- The final whole-branch review (Opus) said **"With fixes"**: 1 critical and 2 important findings, all in `recurrence.py`.

## In progress
- `daf90dc` fixes all of those findings:
  - `INTERVAL=0` hangs forever: now rejected.
  - Rules that never match took ~9 s per expansion: now each rule needs an occurrence within 5 years, and the worst case is ~0.23 s.
  - `BYHOUR`/`BYMINUTE`/`BYSECOND` slipped past the "no sub-daily" guard: now rejected.
  - One bad stored series no longer breaks scheduling; it's skipped and logged.
- The implementer reports 216 backend tests passing. **This fix has not had its scoped re-review yet**, and the frontend checks haven't been re-run since `b120e23`.

## Next steps
1. Run the scoped re-review of `b120e23..daf90dc` against `.superpowers/sdd/2026-10-18-calendar-data-model/final-findings.md`.
2. Re-run all five standard checks.
3. Do a visual browser check of the calendar (`./dev.sh --seed`). It hasn't been done; only curl through the Vite proxy has been verified.
4. With the user's go-ahead: push, then `gh pr create --base dev` using the PR template, with `Closes #54`.
5. Start PR 2 (#55, the UI) with `frontend-design:frontend-design`.

## Open problems / decisions to check
- **Reliance on a private dateutil attribute.** The fix reads `rule._until`, so a dateutil upgrade could break it. The version is pinned at 2.9.0.post0.
- **Stricter validation.** The fix now also rejects rules whose UNTIL is before the start, `BYEASTER`, and any rule whose first occurrence is more than 5 years away. This matters for `.ics` imports in PR 4.
- **Must be handled in PR 3:**
  - PATCHing a series' start or `calendar_id` doesn't update its EXDATEs or override rows.
  - Item routes accept the ids of override rows.
- **Must be handled in PR 4:** a `UNTIL=…Z` value has to be rewritten to naive local time.
- **To decide in PR 2:**
  - Free events are drawn hatched, like Busy ones.
  - The API accepts any times on all-day events.
  - Turning on all-day in a PATCH that doesn't mention busy/free leaves the event Busy.
  - Deleting a category without reassigning leaves recurring routines with no colour.

## Rulings made during execution (check these)
- **Monday anchor.** Migrated and seeded series start on the Monday of the week *before* the current one. Otherwise the first morning has no sleep block. Cost: one extra past week of events.
- **No sub-daily repeats.** Rules that repeat more often than daily are rejected. Cost: a `.ics` file with hourly rules is refused, and PR 4 could turn that into a warning instead.
- **One red commit allowed.** Task 3 was allowed to leave the test suite red for one commit; Task 4 made it green again.
- **No frontend-design pass in Task 8.** Task 8 skipped the frontend-design skill because it only changes data plumbing, with no visual change.
- **Scheduler agent.** Tasks 2 and 4 ran on the `scheduler-architect` agent, as CLAUDE.md routes `scheduler.py` and `pipeline.py` changes there.
