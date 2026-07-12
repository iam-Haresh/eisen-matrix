# Eisenhower Matrix

A simple, cheerful [Eisenhower matrix](https://en.wikipedia.org/wiki/Time_management#The_Eisenhower_Method)
for prioritizing tasks. Drag tasks between four quadrants, add due dates, notes and
checklists, and your list saves automatically. No account, no cloud — your data stays on
your machine.

|                    | **Urgent**       | **Not Urgent**   |
| ------------------ | ---------------- | ---------------- |
| **Important**      | Do First         | Schedule         |
| **Not Important**  | Delegate         | Eliminate        |

## Features

- **Drag & drop** tasks between the four quadrants
- **Due dates** with **overdue** (red) and **due-today** (amber) indicators
- **Recurring** tasks (daily / weekly / monthly) — completing one rolls it to the next date
- **Notes** and a **checklist** (sub-tasks) under each task, with progress count
- **Global search** across task text, notes, and checklist steps
- **Today** filter (due today or overdue) and **Archive** (hide finished tasks, restore later)
- Add, edit (double-click), check off, and delete tasks
- **Two ways to save** (see below) + Export / Import a JSON backup
- Responsive, light **and** dark mode, works **offline**

## Requirements

- **Node.js 18 or newer** (works on Node 18 / 20 / 22). Check with `node -v`.
- No admin rights needed — everything installs into this project's `node_modules/`.

## Run it

```bash
git clone <your-repo-url>
cd eisenhower-matrix
npm install
npm run serve      # builds the app and starts the server on http://localhost:4317
```

Then open **http://localhost:4317**. `npm run serve` is the recommended way to run it — it
serves the app **and** saves your tasks to a JSON file (see below).

### Other ways to run

| Command | What it does |
| ------- | ------------ |
| `npm run serve` | Build + start the server (UI + file saving) on :4317. **Recommended.** |
| `npm start` | Start the server using an already-built `dist/`. |
| `npm run dev` | Live-reload dev server on :5173 (for editing the code). |

## Where your data is saved

There are **two layers**, and they work together:

1. **Your browser (always on).** Tasks auto-save to the browser's `localStorage` on the
   machine you use. This alone is enough — if you just open the app, your tasks persist.
2. **A JSON file (when you run the server).** If you start the app with `npm run serve` (or
   `npm start`), it *also* writes your tasks to a real JSON file, and reads that file on
   startup. The footer of the app shows the exact file path in use.

The file is the source of truth when the server is running, so your list survives even if you
clear the browser. To move tasks between machines without the server, use the **Export** /
**Import** buttons.

### Choosing the file path (configurable)

By default the file is `./data/tasks.json`. To change it, pick **one**:

- **Env var** (highest priority):
  ```bash
  EISENHOWER_DATA_FILE="/Users/you/Documents/tasks.json" npm run serve
  ```
- **Config file:** copy `eisenhower.config.example.json` to `eisenhower.config.json` and set
  `"dataFile"` (relative to the project, or an absolute path):
  ```json
  { "dataFile": "/Users/you/Documents/tasks.json" }
  ```

Change the port with `PORT=3000 npm run serve` (default `4317`).

## If `npm install` is blocked (office firewall)

Some corporate networks block the public npm registry. If `npm install` fails on the office
machine:

1. **Commit a prebuilt version.** On a machine that *can* install, run `npm run build`, remove
   `dist` from `.gitignore`, and commit `dist/`. On the office Mac, `npm start` serves it with
   no install needed (Node's built-in server has zero dependencies).
2. **Commit `node_modules/`.** Install on an unblocked machine, remove `node_modules` from
   `.gitignore`, and commit it. Then everything works on the office machine as-is.

## Project layout

See [`CLAUDE.md`](./CLAUDE.md) for the full architecture and developer notes.
