#!/usr/bin/env bash
# Run the backend and frontend together. Ctrl+C stops both.
#
#   ./dev.sh          start both dev servers
#   ./dev.sh --seed   load the demo tasks first (backend/seed_demo.py)
#
# It creates .venv on first run, and reinstalls backend or frontend
# dependencies whenever requirements.txt or package-lock.json changes.
set -euo pipefail
cd "$(dirname "$0")"

# The Vite proxy (frontend/vite.config.ts) reads the same variable.
export BACKEND_PORT="${BACKEND_PORT:-8000}"

seed=false
for arg in "$@"; do
  case "$arg" in
    --seed) seed=true ;;
    -h|--help) sed -n '2,8p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "unknown option: $arg" >&2; exit 2 ;;
  esac
done

# Each install leaves a stamp. A dependency file newer than its stamp (a pull,
# or a switch to a branch that adds packages) triggers a reinstall.
backend_stamp=.venv/.installed
frontend_stamp=frontend/node_modules/.installed

if [[ ! -x .venv/bin/python ]]; then
  echo "==> creating .venv"
  python3 -m venv .venv
fi
if [[ ! -f $backend_stamp || backend/requirements.txt -nt $backend_stamp ]]; then
  echo "==> installing backend requirements"
  .venv/bin/pip install -r backend/requirements.txt
  touch "$backend_stamp"
fi

if [[ ! -f $frontend_stamp || frontend/package.json -nt $frontend_stamp \
      || frontend/package-lock.json -nt $frontend_stamp ]]; then
  echo "==> installing frontend dependencies"
  npm install --prefix frontend
  touch "$frontend_stamp"
fi

if $seed; then
  echo "==> seeding demo data"
  (cd backend && ../.venv/bin/python seed_demo.py)
fi

# Job control puts each server in its own process group, so the cleanup can
# kill uvicorn's reloader worker and Vite's children along with their parents.
set -m
pids=()

cleanup() {
  trap - INT TERM EXIT
  for pid in "${pids[@]}"; do
    kill -TERM -- "-$pid" 2>/dev/null || true
  done
  wait 2>/dev/null || true
  exit
}
trap cleanup INT TERM EXIT

(cd backend && exec ../.venv/bin/python -m uvicorn app.main:app --reload --port "$BACKEND_PORT") &
pids+=($!)
npm run dev --prefix frontend &
pids+=($!)

echo "==> app:      http://localhost:5173"
echo "==> API docs: http://localhost:$BACKEND_PORT/docs"

# If either server dies, stop the other rather than leave half the app up.
while kill -0 "${pids[0]}" 2>/dev/null && kill -0 "${pids[1]}" 2>/dev/null; do
  sleep 1
done
echo "==> a server exited; shutting down" >&2
