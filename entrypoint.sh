#!/usr/bin/env bash
set -e

echo "=== Starting Internal Python Service (gamingdatademo) on 127.0.0.1:5000 ==="
if [ -d "/app/gamingdatademo/website-live" ]; then
  cd /app/gamingdatademo
  export PYTHONPATH="/app/gamingdatademo:${PYTHONPATH}"
  python3 website-live/app.py --port=5000 &
  sleep 2
fi

echo "=== Starting Express Web Gateway (remix-gaming-app) on 0.0.0.0:${PORT:-8080} ==="
cd /app/remix-gaming-app
exec node dist/server.cjs
