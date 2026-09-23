# CLAUDE.md

## What this is

Student Task Scheduler: a deterministic FastAPI backend + React/Vite frontend.
It's a personal tool, not a product — see README.md for the full architecture,
the scheduling pipeline, chat-provider design, recurring-task materialization,
and the "Conventions worth knowing" / "Decisions taken beyond the brief"
sections. Don't duplicate that here; read it once per session if you need it.

## Environment

- Backend: `backend/` — FastAPI + SQLAlchemy + Pydantic, Python 3.12 (`.venv/`).
  Run: `cd backend && ../.venv/bin/python -m uvicorn app.main:app --reload --port 8000`.
- Frontend: `frontend/` — React 19 + Vite + Tailwind 4.
  Run: `npm run dev --prefix frontend`.
- Tests: `cd backend && ../.venv/bin/python -m pytest -q` (116 tests);
  frontend `npm test --prefix frontend` (Vitest, `src/lib/` only).
- Lint: `npm run lint --prefix frontend` (oxlint).
- **Never read, search, or edit `.venv/`, `frontend/dist/`, or `node_modules/`**
  — vendored/build output, not project source (already gitignored).
- `backend/task_scheduler.db` is a local SQLite file, not a source of truth —
  don't treat its contents as spec.

## Project tracking

Work is tracked on the **SypeAI** GitHub Project board. Before starting
anything non-trivial: check `gh issue list` / the board for existing context,
and open or reference an issue for the task. See the `board-update` skill
(`.claude/skills/board-update/SKILL.md`) for how planning and reflect steps
report back to it.

## Workflow

Check board/issue → brainstorm → plan → (git worktree if working in parallel
with another session) → implement with TDD → verify → PR via
`/commit-push-pr`. Full loop and skill mapping:
[task_ML Workflow Playbook](https://claude.ai/artifact/VX8Hai9W8M1utDESicCE74).

## Conventions worth knowing

- **Durations are minutes** everywhere in the API and database. The task form
  accepts hours and converts.
- **Fixed blocks and productive windows recur weekly.** `day_of_week` is
  `0`=Monday..`6`=Sunday, or `null` for every day. An `end_time` at or before
  `start_time` means the block runs overnight (sleep). Because they recur, a
  band that spills off Sunday night is drawn on Monday morning too.
- **Datetimes are naive local time.** Fine for a single-timezone test group;
  revisit before anyone travels.
- **The schedule is derived state.** Regenerating wipes and rebuilds all slots.
- **No auth.** Everything operates on student 1.
- **Phase precedence is enforced** beyond the original brief — see README
  "Decisions taken beyond the brief" before touching `scheduler.py` ordering.

## Model routing

Subagents default to Sonnet (`CLAUDE_CODE_SUBAGENT_MODEL` in `.claude/settings.json`). Two agents
are pinned:

| Task | Agent | Model |
|---|---|---|
| Run tests / build, report failures | `test-runner` | haiku, low effort |
| Change scoring, decomposition, placement or `pipeline.py` | `scheduler-architect` | opus, high effort |
| Everything else (search, API routes, frontend, reviews) | built-in / general-purpose | sonnet (default) |

- Don't pass a `model` override to the Agent tool when one of the agents above fits — a per-call
  override beats the agent's pinned model.
- Only override to a bigger model after a Sonnet attempt has actually failed, not in advance.
- Main session: Sonnet is enough for routine UI/API work; switch with `/model` to Opus only for
  scheduling-core design.
