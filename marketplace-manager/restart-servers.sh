#!/usr/bin/env bash
set -euo pipefail

# Restart both backend (port 5001) and frontend (Vite, default 5173)
# Usage:
#   chmod +x marketplace-manager/restart-servers.sh
#   ./marketplace-manager/restart-servers.sh
# Logs and PIDs will be written to marketplace-manager/logs/

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$ROOT_DIR/logs"
mkdir -p "$LOG_DIR"

ports=(5001 5173)
echo "[restart] Killing processes on ports: ${ports[*]}"
for p in "${ports[@]}"; do
  if lsof -ti tcp:"$p" >/dev/null 2>&1; then
    echo "[restart] Killing processes on port $p"
    # shellcheck disable=SC2046
    kill -9 $(lsof -ti tcp:"$p") || true
  fi
done

# Fallback kills by process name (best-effort)
killall -9 node 2>/dev/null || true
pkill -f "nodemon .*server" 2>/dev/null || true
pkill -f "node .*server.js" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true

# Small delay to release ports
sleep 0.5

# Start backend server (inherits any env already exported in your shell)
echo "[restart] Starting backend (server)"
(
  cd "$ROOT_DIR/server"
  # If you want persistent Puppeteer profile/headful, run this script with those env vars exported
  # e.g. PUPPETEER_HEADFUL=true PUPPETEER_USER_DATA_DIR=./marketplace-manager/server/.puppeteer_profile ./marketplace-manager/restart-servers.sh
  npm run dev
) >"$LOG_DIR/server.log" 2>&1 &
echo $! > "$LOG_DIR/server.pid"

# Start frontend (client)
echo "[restart] Starting frontend (client)"
(
  cd "$ROOT_DIR/client"
  npm run dev
) >"$LOG_DIR/client.log" 2>&1 &
echo $! > "$LOG_DIR/client.pid"

BACK_PID=$(cat "$LOG_DIR/server.pid" 2>/dev/null || echo "?")
FRONT_PID=$(cat "$LOG_DIR/client.pid" 2>/dev/null || echo "?")

echo "[restart] Backend PID: $BACK_PID  |  Frontend PID: $FRONT_PID"
echo "[restart] Logs:"
echo "  tail -f $LOG_DIR/server.log $LOG_DIR/client.log"
