#!/bin/zsh
set -euo pipefail

PROJECT_DIR="/Users/anikatek/Desktop/personal_projects/weekly-status-tracker"
PORT="4173"
LOG_FILE="/tmp/weekly-status-tracker.log"

if ! command -v node >/dev/null 2>&1; then
  osascript -e 'display dialog "Node.js is required to run Weekly Status Tracker.\n\nInstall Node.js, then try again." buttons {"OK"} default button "OK" with icon stop'
  exit 1
fi

if ! lsof -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  cd "$PROJECT_DIR"
  nohup "$(command -v node)" server.js >> "$LOG_FILE" 2>&1 &
  sleep 0.7
fi

open "http://localhost:${PORT}"
