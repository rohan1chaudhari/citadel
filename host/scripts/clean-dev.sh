#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

LOG_FILE="/tmp/citadel-host-dev.log"
PORT="3000"

echo "[clean-dev] stopping Next.js dev processes on :$PORT"
# Kill known dev command first
for pid in $(pgrep -f "next dev -p $PORT" || true); do
  kill -9 "$pid" 2>/dev/null || true
done
# Kill lingering next-server workers
for pid in $(pgrep -f "next-server" || true); do
  kill -9 "$pid" 2>/dev/null || true
done

sleep 1

echo "[clean-dev] removing .next cache"
rm -rf "$ROOT_DIR/.next"

echo "[clean-dev] starting dev server (log: $LOG_FILE)"
nohup npm run dev > "$LOG_FILE" 2>&1 &
DEV_PID=$!
echo "[clean-dev] started pid=$DEV_PID"

echo "[clean-dev] waiting for health checks..."
OK=0
for i in {1..30}; do
  if curl -fsS -m 3 "http://localhost:$PORT/" >/dev/null 2>&1 \
    && curl -fsS -m 3 "http://localhost:$PORT/apps/scrum-board" >/dev/null 2>&1 \
    && curl -fsS -m 3 "http://localhost:$PORT/api/apps/citadel/health" >/dev/null 2>&1; then
    OK=1
    break
  fi
  sleep 1
done

if [[ "$OK" -eq 1 ]]; then
  echo "[clean-dev] ✅ healthy: /, /apps/scrum-board, /api/apps/citadel/health"
  echo "[clean-dev] tail logs: tail -f $LOG_FILE"
  exit 0
else
  echo "[clean-dev] ❌ health check failed; last 80 log lines:"
  tail -n 80 "$LOG_FILE" || true
  exit 1
fi
