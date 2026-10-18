# CLAUDE.md

## What this is

Sype, a student task scheduler: FastAPI backend + React/Vite frontend. Prioritisation,
decomposition and placement are deterministic, unit-tested Python. No LLM decides the schedule.
The full technical picture lives in [`docs/`](docs/); read `docs/architecture.md` once per
session before non-trivial work instead of re-deriving it.

## Stack & commands

- **Backend** `backend/`: FastAPI, SQLAlchemy, Pydantic, Python 3.12 in `.venv/`.
  `cd backend && ../.venv/bin/python -m uvicorn app.main:app --reload --port 8000`
- **Frontend** `frontend/`: React 19, TypeScript, Vite, Tailwind 4, shadcn-style `components/ui`
  (Radix). `@/` = `frontend/src`. `npm run dev --prefix frontend`
- **Both:** `./dev.sh` (`--seed` loads demo tasks; installs deps when they change).
- **Standard checks** (all must pass before a PR):
  - `cd backend && ../.venv/bin/python -m pytest -q`
  - `npm run lint --prefix frontend` · `npm run typecheck --prefix frontend`
  - `npm test --prefix frontend` · `npm run build --prefix frontend`
- `frontend/src/types/api.ts` mirrors `backend/app/schemas.py` by hand. Change both together.
- **Never read, search or edit** `.venv/`, `node_modules/`, `frontend/dist/`.
  `backend/task_scheduler.db` is local data, not spec.

## Must-know conventions

- Durations are **minutes** in the API and DB (the form accepts hours).
- Fixed blocks / productive windows recur weekly: `day_of_week` 0=Mon..6=Sun or `null` = daily;
  `end_time <= start_time` means overnight.
- Datetimes are **naive local time**. The schedule is **derived state** (regenerate = wipe + rebuild).
- No auth: everything is student 1.
- Phase precedence and overdue-ASAP go beyond the original brief. Read `docs/architecture.md`
  before touching `scheduler.py` ordering.

## Documentation is mandatory

Technical docs are a first-class deliverable here. **Every major change updates the matching doc
in the same PR**, with the essential information only (what changed, how it works, any new
command/env var/convention). A PR that changes behaviour without its doc update is not done.

| Area changed | Update |
|---|---|
| Install, run, env vars, checks | `docs/setup.md` |
| Pipeline, data model, cross-cutting decisions | `docs/architecture.md` |
| API routes, scoring/decompose/scheduler, chat, recurring | `docs/backend.md` |
| Pages, components, hooks, design tokens | `docs/frontend.md` |
| Anything ML | `docs/ml.md` |
| User-facing features | `README.md` (public page: keep it polished, no internals) |

## Git rules

- **NEVER `git push`, `git pull`, or fetch-and-merge without the user's explicit authorization
  in the current conversation.** Past approval does not carry over.
- Commit regularly, in small logical commits with clear messages, as work progresses.
- **One feature = one branch = one PR.** Open or reference a GitHub issue first.
- Branch names: `<type>/<issue>-<short-slug>`, type ∈ `feat` `fix` `docs` `refactor` `test`
  `chore` (e.g. `feat/42-overview-redesign`).
- Branch from `dev`; PRs target `dev` (`gh pr create --base dev`). `main` is production and only
  moves when `dev` is released into it.
- Before opening a PR: run every standard check above (or dispatch the `test-runner` agent),
  update docs, and fill in the PR template. CI must be green.

## Skills: check actively

Before every change, scan the installed skills and invoke each one that applies (e.g.
`superpowers:brainstorming` for new work, `test-driven-development`, `systematic-debugging`,
`verification-before-completion` before claiming done, `code-review` before a PR).

**Frontend work: always invoke `frontend-design:frontend-design` first.** The UI must not look
AI-generated. Build on the tokens in `frontend/src/index.css` and the primitives in
`components/ui`. No purple/rainbow gradients, emoji-as-icons, generic hero copy, identical
rounded cards everywhere, or decorative shadows and motion. See `docs/frontend.md`.

## Agents

`test-runner` (haiku) runs checks and reports failures. `scheduler-architect` (opus) handles
changes to `scoring.py`, `decompose.py`, `scheduler.py`, `pipeline.py`. Everything else runs on
the Sonnet default.
