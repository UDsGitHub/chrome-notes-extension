# Clip Notes

Take simple notes in your browser.

Clip Notes is a Manifest V3 Chrome extension that opens in the side panel. Notes stay on-device in `chrome.storage.local`, with pin, tags, search, drag-to-reorder, and JSON/CSV import & export.

**Name / copy options (for store listing later):**

| Option | One-liner |
| --- | --- |
| **Clip Notes** (current) | Take simple notes in your browser |
| Clip Notes | Capture and organize quick notes beside your tabs |
| Clip Notes | A lightweight side-panel notebook with tags and pinning |

Recommended for now: keep **Clip Notes** + *Take simple notes in your browser*.

## Features

- Side panel notebook (opens from the toolbar action)
- Create, edit, delete notes with a title and body
- Pin notes to a dedicated section (reorder within pinned / unpinned)
- Tags plus a single-select tag filter chip bar and debounced search
- Drag-and-drop reorder (disabled while a filter is active)
- Import / export as JSON or CSV
- Right-click **Save to Notes** on selected page text
- Light / dark via `color-scheme`

## Development setup

Requirements: Node.js 20+ recommended, and Google Chrome (or Chromium).

```bash
npm install
npm run build
```

### Load unpacked in Chrome

1. Run `npm run build` (or `npm run watch` while developing).
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked** and select this repository root (the folder that contains `manifest.json`).
5. Open the extension from the toolbar; it uses the side panel.

Reload the extension on the extensions page after rebuilding if the UI does not pick up changes.

### Scripts

| Command | Purpose |
| --- | --- |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run watch` | Rebuild on file changes |
| `npm run typecheck` | Typecheck without emitting |
| `npm run lint` | ESLint |
| `npm test` | Vitest unit tests |

## Permissions

| Permission | Why |
| --- | --- |
| `sidePanel` | Host the notes UI in Chrome’s side panel |
| `storage` | Persist notes locally (`local`) and pass clipped text (`session`) |
| `contextMenus` | “Save to Notes” on selected text |
| `downloads` | Save exported JSON/CSV files |

No remote servers are used for note storage.

## Import / export

Export produces notes in display order. Import **skips** ids that already exist.

### JSON

Array of note objects. Missing `pinned` → `false`. Missing `tags` → `[]`.

See [`examples/sample-notes.json`](examples/sample-notes.json).

### CSV

Header (current):

```text
id,title,content,createdAt,updatedAt,order,pinned,tags
```

- `tags` uses `;` between values (commas stay available inside CSV fields)
- Older exports without `order`, `pinned`, and/or `tags` still import

See [`examples/sample-notes.csv`](examples/sample-notes.csv).

### Try the sample data

1. Optionally export and back up your real notes first.
2. In Clip Notes, open **Import**.
3. Choose the JSON or CSV file under `examples/`.
4. Confirm the pinned notes, tag chips, and search/filter behavior.

To re-import the same samples after testing, delete those notes (or clear extension storage) first — duplicate ids are skipped.

## Project layout

```text
manifest.json          Extension manifest (MV3)
public/                Side panel HTML, CSS, assets, vendored SortableJS
src/                   TypeScript source
dist/                  Compiled JS (generated; run build)
examples/              Sample import files for demos and screenshots
```

## Chrome Web Store screenshots

Use the sample import data so screenshots look populated and consistent. Chrome typically wants **1280×800** or **640×400** PNG/JPEG, up to 5 screenshots.

Suggested shots (side panel visible; crop or use a clean browser window):

1. **Overview** — several notes, including pinned section + divider, tag chips, search field  
2. **Tags / filter** — a tag chip selected (e.g. `work`) so the list is filtered  
3. **Search** — a query that narrows results (e.g. `pasta` or `planning`)  
4. **Editing** — a note in edit mode with title, body, and tags filled  
5. **Import or context menu** — import dialog, **or** a page with text selected and **Save to Notes** in the context menu  

Tips:

- Prefer light mode for store tiles unless dark is core to the brand  
- Hide unrelated bookmarks/toolbars where possible  
- Keep the panel wide enough that titles, tags, and actions read clearly  
- Optional: put finished assets under `reference/store/` later (not required for the listing upload)

## Author & license

- **Author:** Udochukwu Amaefule ([GitHub](https://github.com/UDsGitHub))
- **License:** [MIT](LICENSE)

MIT is a short permissive open-source license: others can use, modify, and redistribute the code (including in commercial products) as long as they keep the copyright notice. That is separate from Chrome Web Store distribution—you can still publish the extension on the marketplace while keeping the source MIT-licensed. A “commercial license” is only needed if you want to *sell or restrict* rights to the source itself; most indie extensions use MIT (or similar) for the repo.
