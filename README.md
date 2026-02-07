# weekly-status-tracker

A weekly status tracker with editable tiles and local machine persistence.

## Features

- Scrollable feed of weeks (latest week on top)
- Add/delete weeks
- Add/delete tiles inside each week
- Reorder tiles with drag-and-drop or arrow controls
- Export/import JSON
- Auto-save to a local project file (`data/weekly-status.json`)

## Run locally (project-file persistence)

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

## Fallback mode

If you open `index.html` directly without `server.js`, the app still works using browser `localStorage` as a fallback.
