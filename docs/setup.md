# Setup & operation

How to install, run and check Sype locally.

## Prerequisites

- Python 3.12
- Node.js 20+ and npm
- Bash (for `dev.sh`)

## Run everything

```bash
./dev.sh          # start backend + frontend; Ctrl+C stops both
./dev.sh --seed   # load the demo tasks first (backend/seed_demo.py)
```

On first run `dev.sh` creates `.venv/` and installs backend and frontend dependencies. After
that it reinstalls them only when `backend/requirements.txt`, `frontend/package.json` or
`frontend/package-lock.json` is newer than the last install. If either server exits, the
other one is stopped too.

- App: http://localhost:5173
- API docs (Swagger): http://localhost:8000/docs
- Health check: http://localhost:8000/api/health

## Run the processes by hand

```bash
python3 -m venv .venv && .venv/bin/pip install -r backend/requirements.txt   # once
cd backend && ../.venv/bin/python -m uvicorn app.main:app --reload --port 8000
```

```bash
npm install --prefix frontend   # once
npm run dev --prefix frontend   # Vite proxies /api to the backend
```

The first backend start creates the SQLite database and seeds one student. To add demo tasks:

```bash
cd backend && ../.venv/bin/python seed_demo.py
```

## Environment variables

All of them are optional.

| Variable | Default | Effect |
|---|---|---|
| `BACKEND_PORT` | `8000` | Port for uvicorn in `dev.sh`. The Vite proxy reads it too. |
| `TASK_SCHEDULER_DB` | `backend/task_scheduler.db` | SQLite file path. |
| `CHAT_PROVIDER` | `echo` | `echo` (offline stub) or `anthropic`. |
| `ANTHROPIC_API_KEY` | — | Required when `CHAT_PROVIDER=anthropic`. |
| `CHAT_MODEL` | `claude-sonnet-5` | Model used by the Anthropic provider. |
| `CHAT_ECHO_DELAY` | `0.02` | Per-chunk delay (seconds) for the echo stub. |

The Anthropic provider also needs the SDK: `.venv/bin/pip install anthropic`.

## Font (optional)

The UI prefers Styrene B, a licensed font that is not in the repository. If you have a licence,
copy `StyreneB-Regular.woff2` and `StyreneB-Medium.woff2` into `frontend/public/fonts/`
(git-ignored), or install the font on your machine. Without it the UI falls back to Inter.

## Checks

Every PR has to pass all of these, and CI runs them too:

```bash
cd backend && ../.venv/bin/python -m pytest -q   # backend unit + API tests
npm run lint --prefix frontend                   # oxlint
npm run typecheck --prefix frontend              # strict tsc
npm test --prefix frontend                       # Vitest (src/lib)
npm run build --prefix frontend                  # production build
```

## Troubleshooting

- **Fresh data:** stop the backend, delete `backend/task_scheduler.db` and start it again. The
  schedule is derived state, so nothing beyond your tasks and settings is lost.
- **Frontend can't reach the API:** check that the backend is up on `BACKEND_PORT` and that
  you opened the app on port 5173 (the proxy only exists in the Vite dev server).
- **Stale dependencies:** delete `.venv/.installed` or `frontend/node_modules/.installed` to
  force `dev.sh` to reinstall.
