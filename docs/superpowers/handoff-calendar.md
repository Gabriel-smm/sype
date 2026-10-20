# Handoff: Google-Calendar-style calendar series

**Process:** follow the lean process in `CLAUDE.md`. Build inline, run one review per PR at the
end, and keep the basic security baseline.

## Where things stand (2026-10-19)
| PR | Issue | Branch | State |
|---|---|---|---|
| 1 Data model: events, calendars, categories | #54 | `feat/54-calendar-data-model` | PR #59 open, targets `dev` |
| 2 Google-Calendar-style UI | #55 | `feat/55-calendar-ui` (stacked on PR 1) | Done, all checks pass. **Not pushed, no PR yet.** Not tried in a browser |
| 3 Recurring events with edit scopes | #56 | — | Not started |
| 4 .ics import | #57 | — | Not started |
| 5 Pinned task blocks, learned preferences, Time Insights | #58 | — | Not started |

- **Design for the whole series:** `docs/superpowers/specs/2026-10-18-gcal-calendar-design.md`.
- **What PR 2 delivered:** see `docs/frontend.md` (Calendar and Shortcuts sections) and `docs/superpowers/plans/2026-10-19-calendar-ui.md`.

## Next
1. The user tries the calendar (`./dev.sh --seed`) and lists the UI changes they want. Build those on `feat/55-calendar-ui`, before PR 3.
2. With the user's OK, push `feat/55-calendar-ui` and open its PR to `dev` with `Closes #55`. Note in the PR that #59 should merge first.
3. Then start PR 3 (#56).

## Known gaps carried forward
- **For PR 3:**
  - Editing or deleting a repeating event applies to the whole series, and delete asks first.
  - Dragging a single occurrence is blocked.
  - Changing a series' start or calendar doesn't update its EXDATE values or override rows.
- **For PR 4:**
  - Add `reloadCalendars()`, which already exists in `use-calendar`, plus a source icon in the calendar list.
  - Rewrite `UNTIL=…Z` to naive local time.
  - Strict recurrence validation rejects hourly rules, more than 1,000 EXDATE values, and series starting before 1970. Turn these into import warnings.
- **For PR 5:**
  - The "Mark done" button is nested inside a chip that has `role=button`. Restructure it when adding pin UI.
  - Rebuild still undoes dragged task blocks.
- **Minor:**
  - Picking a search result from a hidden calendar turns that calendar back on, without telling the user.
  - `EventLook` still includes `'task'`, which nothing returns.
  - The Tasks page colours tasks by type, but calendar blocks use the category or task colour.
