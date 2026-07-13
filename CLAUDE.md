# CLAUDE.md — project context

Context for Claude Code when returning to this project. Keep it up to date when the
architecture changes. User-facing instructions live in `README.md`.

## What this is

A single-user Eisenhower matrix (task prioritization) web app. **Hard constraint that shaped
every decision:** it runs on the user's office Mac where they have **no admin rights** but
**do have Node + Python**. Workflow: build here → push to GitHub → clone on the office Mac →
run. No global installs, no build tooling assumptions beyond what `npm install` puts in the
project's own `node_modules/`.

## Stack & why

- **React 18 + Vite 5**, plain JSX, no component library, **no drag-and-drop library**
  (native HTML5 DnD). Deps deliberately minimal for broad-Node compatibility.
- **Version pinning is intentional:** Vite 5 (runs on Node 18/20/22) instead of Vite 6/7
  which require newer Node. `package.json` sets `"engines": { "node": ">=18" }`. Do **not**
  run `npm audit fix --force` — it upgrades to Vite 7 and breaks the compatibility goal. The
  two audit warnings are dev-only (esbuild/vite dev server), never shipped to the browser.
- **Companion server (`server.mjs`): Node built-ins only, zero dependencies.** Works on any
  Node 18+. Uses top-level `await`, `for await` over the request stream, `node:` imports.

## How to run

| Goal | Command | Notes |
| ---- | ------- | ----- |
| Office / everyday | `./start.sh` | Install (first run) → build → start → auto-open browser. Passes through `PORT`/`EISENHOWER_DATA_FILE`/`HOST`/`NO_OPEN`. **The recommended launcher.** |
| Production (no auto-open) | `npm run serve` | = `vite build` then `node server.mjs`. One process on :4317 serving UI **and** file persistence. |
| Production, prebuilt | `npm start` | Just `node server.mjs`. Serves existing `dist/` + API. |
| Dev, browser-only | `npm run dev` | Vite on :5173. `/api` proxies to :4317; if the server isn't up, app is browser-only (fine). |
| Dev, with file save | `npm run server` **and** `npm run dev` (two terminals) | Vite :5173 proxies `/api` → server :4317, which writes the JSON file. |

Default port 4317 (override `PORT`). If `dist/` is missing, the server serves a "run build" placeholder page instead of the UI.

## File map

```
start.sh              One-command launcher: install (first run) + build + start + open browser
index.html            Vite entry, mounts #root
server.mjs            Zero-dep companion server: /api/tasks (GET/PUT), /api/completed (POST) + serves dist/
vite.config.js        base:'./' (so dist works from file://) + dev proxy /api -> :4317
eisenhower.config.example.json   copy to eisenhower.config.json to set data path
src/
  main.jsx            ReactDOM root
  App.jsx             ALL task state + handlers; filtering pipeline; toolbar; footer
  storage.js          localStorage (load/save) + server (loadServer/saveServer/archiveCompletedServer) + export/import + normalizeTask
  dates.js            todayStr, nextRecurrence, dueStatus, formatDate  (YYYY-MM-DD strings)
  util.js             makeId
  components/
    Quadrant.jsx      one quadrant: drop zone, header, "+ Add a task" button (hidden in archived view); done tasks sorted to bottom
    NewTaskModal.jsx  new-task popup (text/due/repeat/notes/checklist), due date defaults to today
    TaskCard.jsx      collapsed row + badges + expandable detail panel (due/repeat/notes/checklist/archive)
```

## Data model

One flat array of tasks (subtasks are nested). `normalizeTask()` in `storage.js` backfills
missing fields on load/import so older saved data keeps working — **add new fields there.**

```js
{
  id, text, quadrant: 'do'|'schedule'|'delegate'|'eliminate',
  done: bool,
  dueDate: 'YYYY-MM-DD' | null,
  recurrence: 'daily'|'weekly'|'monthly' | null,
  notes: string,
  subtasks: [{ id, text, done }],   // the "checklist"
  archived: bool,
}
```

## Persistence design (two layers)

1. **Browser localStorage** — always on, the default. Key `eisenhower-tasks`. `save()` on
   every change; `load()` seeds initial state synchronously.
2. **JSON file via `server.mjs`** — optional, on when the server is running.
   - On mount, `App.jsx` calls `loadServer()`. If it succeeds, the **file becomes the source
     of truth** (`setTasks(result.tasks)`) and `serverInfo.dataFile` drives the footer.
   - After that initial load settles (`readyRef.current = true`), every change also
     `saveServer(tasks)` — a **400ms-debounced** best-effort `PUT /api/tasks`.
   - If the server isn't reachable, `loadServer()`/`saveServer()` no-op → browser-only mode.
   - **Configurable path** resolution order in `server.mjs`: `EISENHOWER_DATA_FILE` env var →
     `eisenhower.config.json` `{ "dataFile" }` (relative to project) → default `./data/tasks.json`.

**Known race (minor, accepted):** edits made in the ~ms window before the initial
`loadServer()` resolves are overwritten by server data. Load is fast; acceptable for a
single-user tool.

## API (server.mjs)

- `GET /api/tasks` → `{ tasks: [...], dataFile: "<abs path>" }` (empty array if file absent).
- `PUT /api/tasks` body = tasks array → writes pretty JSON, `{ ok, dataFile, count }`;
  rejects non-arrays with 400, bodies over 5 MB with 413, cross-site mutations with 403.
- `POST /api/completed` body = tasks array → **appends** to `completed_tasks.json` (same
  directory as the data file), stamping each task with `completedAt` (ISO). Same 400/413/403
  guards as PUT. Used by the toolbar "Clear completed" button: the client POSTs the done
  tasks here first and only removes them from state (→ tasks.json) if that succeeds; in
  browser-only mode it warns and deletes without a file backup.
- Static serving has path-traversal protection (normalize + `startsWith(DIST+sep)`) and SPA
  fallback to index.html.

## Security posture (reviewed)

This is a localhost single-user tool, hardened accordingly:

- **Binds to `127.0.0.1` only** (`HOST` env var to override, e.g. `0.0.0.0` for LAN). Not
  reachable from the office network by default.
- **Origin allow-list, not wildcard CORS.** `ALLOWED_ORIGIN` = localhost/127.0.0.1 only.
  Cross-site `PUT`/preflight are 403'd, and no `Access-Control-Allow-Origin` is echoed to
  disallowed origins — so a random website you visit can't read or overwrite your tasks file.
  Trade-off: opening `dist` via `file://` (Origin `null`) against a running server no longer
  reaches the API; run via the server instead.
- **5 MB request body cap** on `PUT` (streamed, aborts early) to prevent memory-exhaustion DoS.
- **Input validation** in `storage.js normalizeTask()`: `quadrant`/`recurrence` allow-listed,
  `dueDate` regex-checked, `text`/`notes` string-coerced, subtask items normalized, ids
  generated when missing. Guards against malformed/hand-edited/imported JSON. **New task
  fields must be added and validated here.**
- No `dangerouslySetInnerHTML` anywhere; React escapes all rendered task/notes/subtask text,
  so stored data can't XSS.

If you add endpoints or fields, keep these invariants: localhost bind, origin check on
mutations, body cap, and normalize-on-input.

## Feature → code map

- Due date / overdue / today: `dates.js dueStatus()`; badges + card border in `TaskCard`.
- Recurring: `App.toggleDone()` rolls a recurring task forward via `nextRecurrence()` and
  resets its checklist instead of marking done.
- Notes, checklist/subtasks: `TaskCard` detail panel; subtask edits go through `onUpdate`.
- Global search: `App` filtering pipeline matches text + notes + subtask text.
- New task: `Quadrant` "+ Add a task" → `NewTaskModal` (due date defaults to today) →
  `App.addTask(quadrant, details)`.
- Completed tasks: sorted to the bottom of each quadrant (`Quadrant`); "Hide completed"
  toolbar chip → `hideDone` in `App`; "Clear completed" toolbar button → `App.clearCompleted()`
  (moves them to `completed_tasks.json` via `POST /api/completed`, see API section).
- Today filter / Archived view: toolbar chips → `todayOnly` / `showArchived` in `App`.
  Archived view hides quadrant add forms (`showAdd={!showArchived}`).
- Export/Import JSON: `storage.js`.

## Known quirks

- **Monthly recurrence** uses JS `Date.setMonth`, so Jan 31 → Mar 3 (Feb overflow). Fine for
  now; clamp to end-of-month in `dates.js nextRecurrence()` if the user wants.
- Dev file-persistence needs **two processes** (vite + server). Production (`npm run serve`)
  is one process — prefer it for the office.

## Verifying changes

- Logic (dates + normalize): the ad-hoc node test used during dev imports `src/dates.js` /
  `src/storage.js` and asserts recurrence, `dueStatus`, and `normalizeTask` defaults.
- Build: `npm run build` must pass clean.
- API round-trip: start `server.mjs` on a spare `PORT`/`EISENHOWER_DATA_FILE`, then
  `curl` GET/PUT `/api/tasks` and check the file on disk. Confirm path traversal returns 403.
- End-to-end: `npm run serve`, open the printed URL, exercise add/drag/due/repeat/checklist/
  search/today/archive, reload → persists, and confirm the footer shows the file path.

## Git / deploy status

Not yet initialized as a git repo (per user). Do **not** push or create a remote without the
user's explicit go-ahead. `data/` and `eisenhower.config.json` are git-ignored (personal
data / machine-specific). Office firewall may block `npm install`; README documents fallbacks
(commit prebuilt `dist/`, or commit `node_modules/`).
