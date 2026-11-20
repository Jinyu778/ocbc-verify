#!/usr/bin/env bash
# Runs on every codespace start: API (:8000) + app (:5173) in the background.
# setsid + nohup keep them running after this script returns.
cd "$(dirname "$0")/.."
if curl -fs http://127.0.0.1:8000/api/health > /dev/null 2>&1; then
  echo "Verity is already running."
  exit 0
fi
setsid nohup npm run dev > /tmp/ocbc-verify.log 2>&1 < /dev/null &
echo "Starting Verity. Open the Ports tab → 5173. Log: /tmp/ocbc-verify.log"
