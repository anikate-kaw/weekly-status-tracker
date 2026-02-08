# weekly-status-tracker

A weekly status tracker with editable tiles and local machine persistence.

## Features

- Scrollable feed of weeks (latest week on top)
- Add/delete weeks
- Add/delete tiles inside each week
- Reorder tiles with drag-and-drop or arrow controls
- Export/import JSON
- Browser mode persists to `data/weekly-status.json`
- Native macOS app wrapper (`WKWebView`) that auto-starts/stops local server

## Run locally in browser (project-file persistence)

1. Open a terminal in this repo
2. Start the local server:

```bash
node server.js
```

3. Open:

```text
http://localhost:4173
```

Your data is stored in:

```text
data/weekly-status.json
```

## Run as native macOS app (no browser tab)

Build the app bundle:

```bash
./scripts/build_mac_app.sh
```

Open the app:

```bash
./scripts/open_mac_app.sh
```

Generated app path:

```text
dist/Weekly Status.app
```

Behavior:

- App opens in its own macOS window.
- App uses bundled web assets inside the app bundle.
- App starts a local Node server automatically if needed.
- App stores data at:

```text
~/Library/Application Support/Weekly Status Tracker/data/weekly-status.json
```

- App stops the server on quit only if the app started it.

Notes:

- No paid Apple Developer account is needed for local use.
- If macOS blocks first launch for unsigned app, right-click the app and choose `Open` once.

## Fallback mode

If you open `index.html` directly without `server.js`, the app still works using browser `localStorage` as a fallback.
