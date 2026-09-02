#!/usr/bin/env bash
set -eo pipefail

export PYTHON_PORT=${PYTHON_PORT:-5000}
export PORT=${PORT:-8080}
export PUBLISHER_NAME="${PUBLISHER_NAME:-${STUDIO_NAME:-Jingle Games}}"
NODE_PORT=${PORT}

echo "=== Active Studio / Publisher: '${PUBLISHER_NAME}' ==="
echo "=== Data Source Tables & Datasets: ==="
echo "  - Raw Events: ${SOURCE_RAW_EVENTS_TABLE:-gaming_raw.raw_events}"
echo "  - Player DNA: ${SOURCE_PLAYER_DNA_TABLE:-gaming_player_data.player_dna}"
echo "  - Settlements: ${SOURCE_PAYMENT_SETTLEMENTS_TABLE:-gaming_raw.payment_gateway_settlements}"
echo "  - Gold Dataset: ${BIGQUERY_DATASET_GOLD:-gaming_gold}"
echo "  - Silver Dataset: ${BIGQUERY_DATASET_SILVER:-gaming_silver}"
echo "  - Reference Dataset: ${BIGQUERY_DATASET_REFERENCE:-gaming_reference_data}"

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
  cd /app/gamingdatademo/website-live
  export PYTHONPATH="/app/gamingdatademo:${PYTHONPATH}"
  gunicorn --bind "127.0.0.1:${PYTHON_PORT}" --workers 1 --threads 8 --worker-class gthread --timeout 300 app:app &
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

