#!/bin/zsh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
APP_NAME="Weekly Status"
EXECUTABLE_NAME="WeeklyStatus"
DIST_DIR="$ROOT_DIR/dist"
APP_DIR="$DIST_DIR/$APP_NAME.app"
CONTENTS_DIR="$APP_DIR/Contents"
MACOS_DIR="$CONTENTS_DIR/MacOS"
RESOURCES_DIR="$CONTENTS_DIR/Resources"
WEB_BUNDLE_DIR="$RESOURCES_DIR/web"

SWIFT_SOURCES=(
  "$ROOT_DIR/mac_app/AppConfig.swift"
  "$ROOT_DIR/mac_app/ServerController.swift"
  "$ROOT_DIR/mac_app/WeeklyStatusApp.swift"
)

ICON_SRC="$ROOT_DIR/assets/icon/weekly-status.icns"
ICON_NAME="weekly-status"
PLIST_PATH="$CONTENTS_DIR/Info.plist"

mkdir -p "$MACOS_DIR" "$RESOURCES_DIR"

swiftc \
  -O \
  -framework AppKit \
  -framework WebKit \
  "${SWIFT_SOURCES[@]}" \
  -o "$MACOS_DIR/$EXECUTABLE_NAME"

rm -rf "$WEB_BUNDLE_DIR"
mkdir -p "$WEB_BUNDLE_DIR"
cp "$ROOT_DIR/index.html" "$WEB_BUNDLE_DIR/index.html"
cp "$ROOT_DIR/skills.html" "$WEB_BUNDLE_DIR/skills.html"
cp "$ROOT_DIR/weekly.html" "$WEB_BUNDLE_DIR/weekly.html"
cp "$ROOT_DIR/style.css" "$WEB_BUNDLE_DIR/style.css"
cp "$ROOT_DIR/app.js" "$WEB_BUNDLE_DIR/app.js"
cp "$ROOT_DIR/server.js" "$WEB_BUNDLE_DIR/server.js"
if [[ -d "$ROOT_DIR/assets" ]]; then
  cp -R "$ROOT_DIR/assets" "$WEB_BUNDLE_DIR/assets"
fi

if [[ -f "$ICON_SRC" ]]; then
  cp "$ICON_SRC" "$RESOURCES_DIR/$ICON_NAME.icns"
fi

cat > "$PLIST_PATH" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleIdentifier</key>
  <string>com.anikatek.weekly-status</string>
  <key>CFBundleName</key>
  <string>Weekly Status</string>
  <key>CFBundleDisplayName</key>
  <string>Weekly Status</string>
  <key>CFBundleExecutable</key>
  <string>$EXECUTABLE_NAME</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>1.0.0</string>
  <key>CFBundleVersion</key>
  <string>1</string>
  <key>LSMinimumSystemVersion</key>
  <string>13.0</string>
  <key>NSHighResolutionCapable</key>
  <true/>
  <key>CFBundleIconFile</key>
  <string>$ICON_NAME</string>
  <key>NSAppTransportSecurity</key>
  <dict>
    <key>NSAllowsArbitraryLoadsInWebContent</key>
    <true/>
    <key>NSAllowsLocalNetworking</key>
    <true/>
  </dict>
</dict>
</plist>
PLIST

plutil -lint "$PLIST_PATH" >/dev/null

echo "Built mac app: $APP_DIR"
