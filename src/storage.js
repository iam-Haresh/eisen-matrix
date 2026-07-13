// Persistence helpers: browser localStorage + JSON export/import.

const STORAGE_KEY = 'eisenhower-tasks'

const QUADRANTS = ['do', 'schedule', 'delegate', 'eliminate']
const RECURRENCES = ['daily', 'weekly', 'monthly']

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

// Accept only "YYYY-MM-DD" strings; anything else becomes null.
function cleanDate(v) {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null
}

function normalizeSubtask(s) {
  const o = s && typeof s === 'object' ? s : {}
  return { id: o.id || newId(), text: String(o.text ?? ''), done: !!o.done }
}

// Fill in / validate fields so data saved by older versions or edited by hand
// keeps working and can't inject unexpected shapes into the UI.
export function normalizeTask(t) {
  const o = t && typeof t === 'object' ? t : {}
  return {
    id: o.id || newId(),
    text: String(o.text ?? ''),
    quadrant: QUADRANTS.includes(o.quadrant) ? o.quadrant : 'do',
    done: !!o.done,
    dueDate: cleanDate(o.dueDate),
    recurrence: RECURRENCES.includes(o.recurrence) ? o.recurrence : null,
    notes: String(o.notes ?? ''),
    subtasks: Array.isArray(o.subtasks) ? o.subtasks.map(normalizeSubtask) : [],
    archived: !!o.archived,
  }
}

// Load the task array from localStorage. Returns [] if empty or corrupted.
export function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.map(normalizeTask) : []
  } catch (err) {
    console.warn('Could not load saved tasks:', err)
    return []
  }
}

// --- Optional file persistence via the companion server (server.mjs) --------
// These no-op gracefully when the server isn't running (browser-only mode).

const API = '/api/tasks'

// Returns { tasks, dataFile } if the server is reachable, otherwise null.
export async function loadServer() {
  try {
    const res = await fetch(API)
    if (!res.ok) return null
    const data = await res.json()
    return {
      tasks: Array.isArray(data.tasks) ? data.tasks.map(normalizeTask) : [],
      dataFile: data.dataFile,
    }
  } catch {
    return null // server not running — that's fine
  }
}

// Debounced best-effort save to the JSON file. Ignores failures so the app
// keeps working even if the server goes away.
let saveTimer = null
export function saveServer(tasks) {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    fetch(API, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tasks),
    }).catch(() => {})
  }, 400)
}

// Append completed tasks to completed_tasks.json (next to the data file).
// Returns the server's response, or null if the server rejected/isn't running —
// callers should only delete the tasks locally on success.
export async function archiveCompletedServer(tasks) {
  try {
    const res = await fetch('/api/completed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tasks),
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

// Save the task array to localStorage.
export function save(tasks) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks))
  } catch (err) {
    console.warn('Could not save tasks:', err)
  }
}

// Download the current tasks as a JSON backup file.
export function exportJSON(tasks) {
  const blob = new Blob([JSON.stringify(tasks, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const stamp = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
  a.href = url
  a.download = `eisenhower-tasks-${stamp}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// Read a chosen .json file and resolve with a validated task array.
export function importJSON(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result)
        if (!Array.isArray(parsed)) {
          throw new Error('File does not contain a task list.')
        }
        resolve(parsed.map(normalizeTask))
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsText(file)
  })
}
