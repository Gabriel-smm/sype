#!/usr/bin/env bash
# Run the backend and frontend together. Ctrl+C stops both.
#
#   ./dev.sh          start both dev servers
#   ./dev.sh --seed   load the demo tasks first (backend/seed_demo.py)
#
# On first run it creates .venv and installs frontend/node_modules.
set -euo pipefail
cd "$(dirname "$0")"

# The Vite proxy (frontend/vite.config.ts) reads the same variable.
export BACKEND_PORT="${BACKEND_PORT:-8000}"

seed=false
for arg in "$@"; do
  case "$arg" in
    --seed) seed=true ;;
    -h|--help) sed -n '2,7p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "unknown option: $arg" >&2; exit 2 ;;
  esac
done

if [[ ! -x .venv/bin/python ]]; then
  echo "==> creating .venv and installing backend requirements"
  python3 -m venv .venv
  .venv/bin/pip install -r backend/requirements.txt
fi

if [[ ! -d frontend/node_modules ]]; then
  echo "==> installing frontend dependencies"
  npm install --prefix frontend
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
