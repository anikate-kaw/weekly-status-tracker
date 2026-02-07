# Weekly Status Tracker - Notion Template

This template recreates the core behavior of your web app inside Notion:

- Create a new week
- Delete a week
- Add tiles inside a week
- Delete tiles
- Reorder tiles within a week (drag and drop)
- Auto-save edits
- Export/import content using Notion export/import

## 1) Create Database: `Weeks`

Create a new **full-page database** named `Weeks` with these properties:

- `Name` (Title)
- `Week Start` (Date)
- `Week End` (Formula)
- `Week Label` (Formula)
- `Created` (Created time)

Use these formulas:

`Week End`

```notion
 dateAdd(prop("Week Start"), 6, "days")
```

`Week Label`

```notion
 "Week of " + formatDate(prop("Week Start"), "YYYY-MM-DD") + " -> " + formatDate(prop("Week End"), "YYYY-MM-DD")
```

## 2) Create Database: `Tiles`

Create a second **full-page database** named `Tiles` with these properties:

- `Tile` (Title)
- `Week` (Relation -> `Weeks`)
- `Notes` (Text)
- `Last Edited` (Last edited time)

## 3) Configure Views

In `Weeks` database:

- `Latest First` view (Table)
- Sort by `Week Start` descending
- Show `Week Label`, `Created`

In `Tiles` database:

- `All Tiles` view (Table)
- Show `Tile`, `Week`, `Last Edited`

## 4) Week Page Template (Important)

Inside the `Weeks` database, create a **new template** called `Weekly Status Template`.

Inside that template page:

1. Add heading: `Weekly status`
2. Add a short line: `Drag tiles to reorder. Edits auto-save in Notion.`
3. Insert a **Linked view of database** -> choose `Tiles`
4. Configure linked view:
- Layout: `List` (or Table)
- Filter: `Week` `contains` `Current page`
- No sort (manual order enabled)

5. Add a Notion **Button** named `Add tile`
- Action: `New page in` -> `Tiles`
- Set property `Week` -> `Current page`
- Set property `Tile` -> `New tile`

This gives each week its own tile list with in-context add.

## 5) Feature Mapping (Web App -> Notion)

- `New week`: click `New` in `Weeks` and use `Weekly Status Template`
- `Delete week`: delete the week page in `Weeks`
- `Add tile`: use `Add tile` button inside the week page
- `Delete tile`: delete a tile row/page in the linked `Tiles` view
- `Reorder tiles`: drag tiles up/down in the week linked view
- `Auto-save`: native Notion behavior

## 6) Export / Import Workflow

Notion does not natively export/import your app JSON schema, but you can still move data:

- Export from Notion: `...` menu on page/workspace -> `Export` (Markdown/CSV)
- Import into Notion: `Import` in sidebar (Markdown/CSV)

If you want, I can add a converter script in this repo to transform:

- Web app JSON -> Notion-ready CSV
- Notion CSV -> Web app JSON

## 7) Optional Starter Tile Content

For each new tile, paste one of these patterns:

- `Last week\n- ...`
- `Next week\n- ...`
- `Blockers\n- ...`
- `Risks\n- ...`

