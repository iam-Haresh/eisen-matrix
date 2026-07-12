import { useEffect, useMemo, useRef, useState } from 'react'
import Quadrant from './components/Quadrant.jsx'
import {
  load,
  save,
  loadServer,
  saveServer,
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
  const [showArchived, setShowArchived] = useState(false)
  const [serverInfo, setServerInfo] = useState(null) // { dataFile } when server is up
  const readyRef = useRef(false)
  const fileInputRef = useRef(null)

  // On mount: if the companion server is running, adopt the file as the source
  // of truth. Otherwise stay in browser-only mode. After this resolves, saves
  // start mirroring to the file too.
  useEffect(() => {
    let cancelled = false
    loadServer().then((result) => {
      if (cancelled) return
      if (result) {
        setTasks(result.tasks)
        setServerInfo({ dataFile: result.dataFile })
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
    save(tasks)
    if (readyRef.current) saveServer(tasks)
  }, [tasks])

  function addTask(quadrant, text) {
    const trimmed = text.trim()
    if (!trimmed) return
    setTasks((prev) => [
      ...prev,
      {
        id: makeId(),
        text: trimmed,
        quadrant,
        done: false,
        dueDate: null,
        recurrence: null,
        notes: '',
        subtasks: [],
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
  }, [tasks, showArchived, todayOnly, q])

  const archivedCount = useMemo(
    () => tasks.filter((t) => t.archived).length,
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
            className={`chip${showArchived ? ' chip--on' : ''}`}
            onClick={() => setShowArchived((v) => !v)}
            title="Show archived tasks"
          >
            Archived{archivedCount > 0 ? ` (${archivedCount})` : ''}
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
