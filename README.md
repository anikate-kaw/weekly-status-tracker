# weekly-status-tracker

A local-first productivity dashboard with three dedicated pages:

- `Tasks`
- `Skills`
- `Weekly`

All pages read/write the same shared state.

## Features

- Weekly tracker page with:
  - Next/Previous week creation
  - Week delete
  - Tile add/edit/delete/reorder (drag + arrows)
- Tasks page with:
  - Add/edit/delete tasks
  - Status/priority dropdowns
  - Sort modes
  - Resizable task columns (desktop)
- Skills page with:
  - Large editable tiles
  - Add/edit/delete/reorder
  - Copy tile body text
- Shared persistence:
  - Server mode writes to `data/weekly-status.json`
  - Browser fallback uses `localStorage`
- Native macOS app wrapper (`WKWebView`) that auto-starts/stops local server

## Run locally in browser (project-file persistence)

1. Open a terminal in this repo
2. Start the local server:

```bash
node server.js
```

3. Open pages:

- Tasks (default): `http://localhost:4173/`
- Skills: `http://localhost:4173/skills.html`
- Weekly: `http://localhost:4173/weekly.html`

Data file:

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
- Default launch page is Tasks (`/index.html`).
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

If you open HTML files directly without `server.js`, the app still works using browser `localStorage` as a fallback.
