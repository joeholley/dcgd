#!/usr/bin/env bash
set -eo pipefail

PYTHON_PORT=${PYTHON_PORT:-5000}
NODE_PORT=${PORT:-8080}

PY_PID=""
NODE_PID=""

cleanup() {
  echo "=== Stopping services... ==="
  if [ -n "$PY_PID" ]; then kill -TERM "$PY_PID" 2>/dev/null || true; fi
  if [ -n "$NODE_PID" ]; then kill -TERM "$NODE_PID" 2>/dev/null || true; fi
  PIDS=()
  [ -n "$PY_PID" ] && PIDS+=("$PY_PID")
  [ -n "$NODE_PID" ] && PIDS+=("$NODE_PID")
  if [ ${#PIDS[@]} -gt 0 ]; then
    wait "${PIDS[@]}" 2>/dev/null || true
  fi
}
trap cleanup SIGTERM SIGINT EXIT

echo "=== Starting Internal Python Service (gamingdatademo) on 127.0.0.1:${PYTHON_PORT} ==="
if [ -d "/app/gamingdatademo/website-live" ]; then
  cd /app/gamingdatademo
  export PYTHONPATH="/app/gamingdatademo:${PYTHONPATH}"
  python3 website-live/app.py --host=127.0.0.1 --port="${PYTHON_PORT}" &
  PY_PID=$!

  # TCP readiness probe for Python Flask service
  READY=0
  for i in {1..30}; do
    if python3 -c "import socket; s = socket.socket(); s.connect(('127.0.0.1', ${PYTHON_PORT})); s.close()" 2>/dev/null; then
      echo "Internal Python service ready on 127.0.0.1:${PYTHON_PORT}"
      READY=1
      break
    fi
    if ! kill -0 "$PY_PID" 2>/dev/null; then
      echo "ERROR: Internal Python service crashed on startup." >&2
      exit 1
    fi
    sleep 0.5
  done

  if [ "$READY" -eq 0 ]; then
    echo "ERROR: Timed out waiting for Internal Python service on 127.0.0.1:${PYTHON_PORT}" >&2
    exit 1
  fi
fi

echo "=== Starting Express Web Gateway (remix-gaming-app) on 0.0.0.0:${NODE_PORT} ==="
cd /app/remix-gaming-app
node dist/server.cjs &
NODE_PID=$!

# Wait for either process to exit; if one dies, the container exits cleanly
PIDS=()
[ -n "$PY_PID" ] && PIDS+=("$PY_PID")
[ -n "$NODE_PID" ] && PIDS+=("$NODE_PID")
if [ ${#PIDS[@]} -gt 0 ]; then
  wait -n "${PIDS[@]}"
fi

