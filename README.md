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
./start.sh
```

`./start.sh` is the easiest way — on the first run it installs dependencies, then it builds
the app, starts the server, and opens **http://localhost:4317** in your browser. It saves your
tasks to a JSON file (see below). Press `Ctrl+C` to stop.

> On some systems you may need to make it executable once: `chmod +x start.sh`

### Other ways to run

| Command | What it does |
| ------- | ------------ |
| `./start.sh` | Install (first run) + build + start + open browser. **Recommended.** |
| `npm run serve` | Same as above minus the auto-open (build + start on :4317). |
| `npm start` | Start the server using an already-built `dist/`. |
| `npm run dev` | Live-reload dev server on :5173 (for editing the code). |

## Where your data is saved

There are **two layers**, and they work together:

1. **Your browser (always on).** Tasks auto-save to the browser's `localStorage` on the
   machine you use. This alone is enough — if you just open the app, your tasks persist.
2. **A JSON file (when you run the server).** If you start the app with `./start.sh` (or
   `npm run serve` / `npm start`), it *also* writes your tasks to a real JSON file, and reads
   that file on startup. The footer of the app shows the exact file path in use.

The file is the source of truth when the server is running, so your list survives even if you
clear the browser. To move tasks between machines without the server, use the **Export** /
**Import** buttons.

### Choosing the file path (configurable)

By default the file is `./data/tasks.json`. To change it, pick **one**:

- **Env var** (highest priority):
  ```bash
  EISENHOWER_DATA_FILE="/Users/you/Documents/tasks.json" ./start.sh
  ```
- **Config file:** copy `eisenhower.config.example.json` to `eisenhower.config.json` and set
  `"dataFile"` (relative to the project, or an absolute path):
  ```json
  { "dataFile": "/Users/you/Documents/tasks.json" }
  ```

Change the port with `PORT=3000 ./start.sh` (default `4317`).

For your safety the server listens on **`127.0.0.1` only**, so it isn't reachable from the
office network and other websites can't touch your tasks file. If you deliberately want to
reach it from another device, set `HOST=0.0.0.0`.

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
