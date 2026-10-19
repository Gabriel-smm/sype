# Handoff: Google-Calendar-style calendar, PR 1 (#54)

**Branch:** `feat/54-calendar-data-model`, based on `dev`. Not pushed, and no PR is open yet.

**Read with:**
- Design: `docs/superpowers/specs/2026-10-18-gcal-calendar-design.md`. It covers the 5-PR series in issues #54–#58.
- Plan: `docs/superpowers/plans/2026-10-18-calendar-data-model.md`.

## Done
- **All 9 plan tasks:** each was built and passed its own spec and quality review.
- **Final whole-branch review:** it found a critical hang (`INTERVAL=0`) and related slow-request holes in `recurrence.py`. They were fixed over four review rounds and the last re-review came back clean. Recurrence validation and expansion are now bounded:
  - INTERVAL must be at least 1.
  - Rules that repeat more often than daily are rejected, and so are `BYHOUR`/`BYMINUTE`/`BYSECOND`.
  - Items may not contain whitespace or control characters.
  - At most 100 items and 1,000 EXDATE/RDATE values.
  - Recurring series cannot start before 1970.
  - EXDATE/RDATE values with a timezone are rejected.
  - Each RRULE must produce an instance within 5 years.
  - Each rule is expanded on its own.
  - A bad stored series is skipped with a logged warning instead of breaking scheduling.
- **Checks at `7f8ea0a`:** all pass.
  - pytest: 256 passed.
  - Frontend lint, typecheck and build: clean.
  - Vitest: 82 passed.
- **Upgrade test:** a copy of the real `task_scheduler.db` upgraded cleanly. The migrated events showed up, a restart did not duplicate them, and the generated schedule does not overlap any Busy event.

## Next steps
1. Do a visual check in the browser (`./dev.sh --seed`). This has not been done yet. Only a `curl` through the Vite proxy was checked.
2. Once the user gives the go-ahead, push and open the PR: `gh pr create --base dev`, using the PR template and `Closes #54`.
3. PR 2 (#55, the UI): start with `frontend-design:frontend-design`.

## Open problems, deferred to later PRs
- **The GET calendar-events window is unbounded in year.** A request for a window near year 9990 takes about 4.7 s. Clamp the accepted years (PR 2 or PR 4).
- **EXDATE/RDATE values are parsed leniently** by `dateutil.parser`, so a partial value like `10` is accepted. Require the strict `YYYYMMDDTHHMMSS` format in PR 4.
- **Must handle in PR 3:**
  - PATCHing a series' start or `calendar_id` does not update its EXDATEs or override rows.
  - Item routes accept the ids of override rows.
- **Must handle in PR 4:**
  - `UNTIL=…Z` has to be rewritten to naive local time.
  - Strict recurrence validation will reject some real `.ics` rules: hourly rules, rules with more than 1,000 EXDATEs, and series that start before 1970. Turn these into import warnings.
- **To decide in PR 2:**
  - Free events are currently drawn hatched, like Busy ones.
  - The API accepts any times on an all-day event.
  - Turning on all-day in a PATCH that doesn't mention busy/free leaves the event's busy/free setting unchanged.
  - Deleting a category without reassigning leaves its routines with no colour.
  - `useCalendarEvents` keeps showing stale data while a fetch is pending or after an error.
- **Fragile dependency:** the recurrence code reads dateutil's private `rule._until`. dateutil is pinned at 2.9.0.post0.

## Rulings made during execution (please check)
- **Monday anchor:** migrated and seeded series start on the Monday of the week *before* the current one. Otherwise the first morning after the upgrade has no sleep block. Cost: one extra week of past events.
- **No sub-daily repetition, plus the caps above:** repeat rules finer than daily are rejected, along with the other caps listed under Done. Cost: some `.ics` rules will be refused in PR 4.
- **Red intermediate commit:** Task 3 was allowed one commit with a red test suite. Task 4 turned it green again.
- **No frontend-design pass in Task 8:** it skipped the skill because it changed data plumbing only and nothing visual.
- **Scheduler agent:** Tasks 2 and 4 ran on the `scheduler-architect` agent.
- **Extra fix rounds:** the final review got follow-up fix rounds beyond the single fix wave the process allows, because a known request hang should not ship.
