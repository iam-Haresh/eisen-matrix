import { useEffect, useMemo, useRef, useState } from 'react'
import Quadrant from './components/Quadrant.jsx'
import {
  load,
  save,
  loadServer,
  saveServer,
  archiveCompletedServer,
  exportJSON,
  importJSON,
} from './storage.js'
import { makeId } from './util.js'
import { dueStatus, nextRecurrence, todayStr } from './dates.js'

// The four Eisenhower quadrants, in display order (2×2 grid).
const QUADRANTS = [
  { key: 'do', title: 'Do First', subtitle: 'Urgent · Important' },
  { key: 'schedule', title: 'Schedule', subtitle: 'Not Urgent · Important' },
  { key: 'delegate', title: 'Delegate', subtitle: 'Urgent · Not Important' },
  { key: 'eliminate', title: 'Eliminate', subtitle: 'Not Urgent · Not Important' },
]

export default function App() {
  const [tasks, setTasks] = useState(load)
  const [query, setQuery] = useState('')
  const [todayOnly, setTodayOnly] = useState(false)
  const [hideDone, setHideDone] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [serverInfo, setServerInfo] = useState(null) // { dataFile } when server is up
  const readyRef = useRef(false)
  const tasksRef = useRef(tasks)
  const fileInputRef = useRef(null)

  // On mount: if the companion server is running and the data file exists, the
  // file is the source of truth — read it, never replace it on load. Only when
  // there is no file at all (first run with the server) is one created from
  // the browser's tasks.
  useEffect(() => {
    let cancelled = false
    loadServer().then((result) => {
      if (cancelled) return
      if (result) {
        setServerInfo({ dataFile: result.dataFile })
        if (result.exists) setTasks(result.tasks)
        else saveServer(tasksRef.current)
      }
      readyRef.current = true
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Auto-save on every change: always to localStorage, and to the JSON file too
  // once the initial server load has settled.
  useEffect(() => {
    tasksRef.current = tasks
    save(tasks)
    if (readyRef.current) saveServer(tasks)
  }, [tasks])

  // details comes from the new-task modal: { text, dueDate, recurrence, notes, subtasks }
  function addTask(quadrant, details) {
    const trimmed = (details.text || '').trim()
    if (!trimmed) return
    setTasks((prev) => [
      ...prev,
      {
        id: makeId(),
        text: trimmed,
        quadrant,
        done: false,
        dueDate: details.dueDate ?? null,
        recurrence: details.recurrence ?? null,
        notes: details.notes ?? '',
        subtasks: details.subtasks ?? [],
        archived: false,
      },
    ])
  }

  function updateTask(id, patch) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)))
  }

  function deleteTask(id) {
    setTasks((prev) => prev.filter((t) => t.id !== id))
  }

  // Toggling a recurring task "done" instead rolls it forward to the next
  // occurrence and keeps it active. Non-recurring tasks toggle normally.
  function toggleDone(id) {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t
        if (!t.done && t.recurrence) {
          const base = t.dueDate || todayStr()
          return {
            ...t,
            dueDate: nextRecurrence(base, t.recurrence),
            subtasks: t.subtasks.map((s) => ({ ...s, done: false })),
            done: false,
          }
        }
        return { ...t, done: !t.done }
      }),
    )
  }

  function moveTask(id, quadrant) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, quadrant } : t)))
  }

  // Move every completed task out of the board: append them to
  // completed_tasks.json (when the server is up) and delete them from the task
  // list — the normal save pipeline then rewrites tasks.json without them.
  async function clearCompleted() {
    const completed = tasks.filter((t) => t.done)
    if (completed.length === 0) return
    const message = serverInfo
      ? `Move ${completed.length} completed task(s) to completed_tasks.json and remove them from the board?`
      : `Delete ${completed.length} completed task(s)? The file server isn't running, so they will NOT be saved to completed_tasks.json.`
    if (!window.confirm(message)) return
    if (serverInfo) {
      const result = await archiveCompletedServer(completed)
      if (!result) {
        window.alert(
          'Could not write completed_tasks.json — nothing was deleted.',
        )
        return
      }
    }
    setTasks((prev) => prev.filter((t) => !t.done))
  }

  async function handleImportFile(e) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-importing the same file later
    if (!file) return
    try {
      const imported = await importJSON(file)
      if (
        tasks.length === 0 ||
        window.confirm(
          `Replace your current ${tasks.length} task(s) with ${imported.length} imported task(s)?`,
        )
      ) {
        setTasks(imported)
      }
    } catch (err) {
      window.alert(`Could not import that file: ${err.message}`)
    }
  }

  // --- Filtering pipeline -------------------------------------------------
  const q = query.trim().toLowerCase()
  const visibleTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (t.archived !== showArchived) return false
      if (hideDone && !showArchived && t.done) return false
      if (todayOnly && !showArchived) {
        const status = dueStatus(t.dueDate, t.done)
        if (status !== 'overdue' && status !== 'today') return false
      }
      if (q) {
        const haystack = [
          t.text,
          t.notes,
          ...t.subtasks.map((s) => s.text),
        ]
          .join(' ')
          .toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [tasks, showArchived, hideDone, todayOnly, q])

  const archivedCount = useMemo(
    () => tasks.filter((t) => t.archived).length,
    [tasks],
  )
  const doneCount = useMemo(
    () => tasks.filter((t) => t.done).length,
    [tasks],
  )
  const overdueCount = useMemo(
    () =>
      tasks.filter((t) => !t.archived && dueStatus(t.dueDate, t.done) === 'overdue')
        .length,
    [tasks],
  )
  const remaining = visibleTasks.filter((t) => !t.done).length

  let tagline
  if (showArchived) {
    tagline = `${visibleTasks.length} archived task(s)`
  } else if (visibleTasks.length === 0 && tasks.some((t) => !t.archived)) {
    tagline = 'No tasks match the current filter.'
  } else if (tasks.every((t) => t.archived)) {
    tagline = 'Add a task to any box to get started.'
  } else {
    tagline = `${remaining} to do · ${visibleTasks.length} shown`
    if (overdueCount > 0) tagline += ` · ${overdueCount} overdue`
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-title">
          <h1>Eisenhower Matrix</h1>
          <p className="app-tagline">{tagline}</p>
        </div>
        <div className="app-actions">
          <button
            type="button"
            className="btn"
            onClick={() => exportJSON(tasks)}
            disabled={tasks.length === 0}
            title="Download your tasks as a JSON backup"
          >
            Export
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => fileInputRef.current?.click()}
            title="Load tasks from a JSON backup"
          >
            Import
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            onChange={handleImportFile}
            hidden
          />
        </div>
      </header>

      <div className="toolbar">
        <div className="search">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tasks, notes, checklists…"
            aria-label="Search all tasks"
          />
          {query && (
            <button
              type="button"
              className="search-clear"
              onClick={() => setQuery('')}
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>
        <div className="filters">
          <button
            type="button"
            className={`chip${todayOnly ? ' chip--on' : ''}`}
            onClick={() => setTodayOnly((v) => !v)}
            disabled={showArchived}
            title="Show only tasks due today or overdue"
          >
            Today
          </button>
          <button
            type="button"
            className={`chip${hideDone ? ' chip--on' : ''}`}
            onClick={() => setHideDone((v) => !v)}
            disabled={showArchived}
            title="Hide completed tasks"
          >
            Hide completed
          </button>
          <button
            type="button"
            className={`chip${showArchived ? ' chip--on' : ''}`}
            onClick={() => setShowArchived((v) => !v)}
            title="Show archived tasks"
          >
            Archived{archivedCount > 0 ? ` (${archivedCount})` : ''}
          </button>
          <button
            type="button"
            className="chip chip--danger"
            onClick={clearCompleted}
            disabled={doneCount === 0}
            title="Move all completed tasks to completed_tasks.json and remove them from the board"
          >
            Clear completed{doneCount > 0 ? ` (${doneCount})` : ''}
          </button>
        </div>
      </div>

      <main className="matrix">
        {QUADRANTS.map((quadrant) => (
          <Quadrant
            key={quadrant.key}
            quadrant={quadrant}
            tasks={visibleTasks.filter((t) => t.quadrant === quadrant.key)}
            showAdd={!showArchived}
            onAdd={addTask}
            onToggle={toggleDone}
            onUpdate={updateTask}
            onDelete={deleteTask}
            onMove={moveTask}
          />
        ))}
      </main>

      <footer className="app-footer">
        {serverInfo ? (
          <>
            Saving to this browser <b>and</b> file:{' '}
            <code className="footer-path">{serverInfo.dataFile}</code>
          </>
        ) : (
          <>
            Saving to this browser only. Run <code>npm start</code> to also save
            to a JSON file. Use Export for a manual backup.
          </>
        )}
      </footer>
    </div>
  )
}
