#!/bin/zsh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
APP_PATH="$ROOT_DIR/dist/Weekly Status.app"
APP_BIN="$APP_PATH/Contents/MacOS/WeeklyStatus"

SOURCES=(
  "$ROOT_DIR/mac_app/AppConfig.swift"
  "$ROOT_DIR/mac_app/ServerController.swift"
  "$ROOT_DIR/mac_app/WeeklyStatusApp.swift"
  "$ROOT_DIR/index.html"
  "$ROOT_DIR/style.css"
  "$ROOT_DIR/app.js"
  "$ROOT_DIR/server.js"
)

NEEDS_BUILD=false
if [[ ! -d "$APP_PATH" || ! -f "$APP_BIN" ]]; then
  NEEDS_BUILD=true
else
  for src in "${SOURCES[@]}"; do
    if [[ "$src" -nt "$APP_BIN" ]]; then
      NEEDS_BUILD=true
      break
    fi
  done
fi

if [[ "$NEEDS_BUILD" == true ]]; then
  "$ROOT_DIR/scripts/build_mac_app.sh"
fi

open "$APP_PATH"
