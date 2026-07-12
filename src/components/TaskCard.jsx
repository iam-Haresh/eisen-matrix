import { useEffect, useRef, useState } from 'react'
import { makeId } from '../util.js'
import { dueStatus, formatDate } from '../dates.js'

const RECURRENCE_OPTIONS = [
  { value: '', label: "Doesn't repeat" },
  { value: 'daily', label: 'Repeats daily' },
  { value: 'weekly', label: 'Repeats weekly' },
  { value: 'monthly', label: 'Repeats monthly' },
]

export default function TaskCard({ task, onToggle, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [draft, setDraft] = useState(task.text)
  const [subDraft, setSubDraft] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  function commitEdit() {
    const trimmed = draft.trim()
    if (trimmed && trimmed !== task.text) onUpdate(task.id, { text: trimmed })
    else setDraft(task.text)
    setEditing(false)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') commitEdit()
    else if (e.key === 'Escape') {
      setDraft(task.text)
      setEditing(false)
    }
  }

  // --- Checklist / subtask helpers (computed from the current task) --------
  function addSubtask(e) {
    e.preventDefault()
    const text = subDraft.trim()
    if (!text) return
    onUpdate(task.id, {
      subtasks: [...task.subtasks, { id: makeId(), text, done: false }],
    })
    setSubDraft('')
  }

  function toggleSubtask(subId) {
    onUpdate(task.id, {
      subtasks: task.subtasks.map((s) =>
        s.id === subId ? { ...s, done: !s.done } : s,
      ),
    })
  }

  function deleteSubtask(subId) {
    onUpdate(task.id, {
      subtasks: task.subtasks.filter((s) => s.id !== subId),
    })
  }

  const status = dueStatus(task.dueDate, task.done)
  const subDone = task.subtasks.filter((s) => s.done).length
  const hasSubtasks = task.subtasks.length > 0

  return (
    <div
      className={`task${task.done ? ' task--done' : ''}${
        status === 'overdue' ? ' task--overdue' : ''
      }`}
    >
      <div
        className="task-row"
        draggable={!editing}
        onDragStart={(e) => {
          e.dataTransfer.setData('text/plain', task.id)
          e.dataTransfer.effectAllowed = 'move'
        }}
      >
        <input
          type="checkbox"
          className="task-check"
          checked={task.done}
          onChange={() => onToggle(task.id)}
          aria-label={task.done ? 'Mark as not done' : 'Mark as done'}
        />

        {editing ? (
          <input
            ref={inputRef}
            type="text"
            className="task-edit"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={handleKeyDown}
          />
        ) : (
          <span
            className="task-text"
            onDoubleClick={() => setEditing(true)}
            title="Double-click to edit"
          >
            {task.text}
          </span>
        )}

        <button
          type="button"
          className={`task-expand${expanded ? ' is-open' : ''}`}
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? 'Hide details' : 'Show details'}
          aria-expanded={expanded}
          title="Details"
        >
          ▾
        </button>
        <button
          type="button"
          className="task-delete"
          onClick={() => onDelete(task.id)}
          aria-label="Delete task"
          title="Delete task"
        >
          ×
        </button>
      </div>

      {/* Compact status badges */}
      {(status || task.recurrence || hasSubtasks || task.notes) && (
        <div className="task-badges">
          {task.dueDate && (
            <span className={`badge badge--${status || 'done'}`}>
              {status === 'overdue' ? 'Overdue · ' : ''}
              {status === 'today' ? 'Today · ' : ''}
              {formatDate(task.dueDate)}
            </span>
          )}
          {task.recurrence && <span className="badge badge--repeat">Repeats</span>}
          {hasSubtasks && (
            <span className="badge badge--check">
              ✓ {subDone}/{task.subtasks.length}
            </span>
          )}
          {task.notes && <span className="badge badge--notes">Notes</span>}
        </div>
      )}

      {/* Expanded detail panel */}
      {expanded && (
        <div className="task-detail">
          <div className="detail-row">
            <label>
              <span className="detail-label">Due date</span>
              <input
                type="date"
                value={task.dueDate || ''}
                onChange={(e) =>
                  onUpdate(task.id, { dueDate: e.target.value || null })
                }
              />
            </label>
            <label>
              <span className="detail-label">Repeat</span>
              <select
                value={task.recurrence || ''}
                onChange={(e) =>
                  onUpdate(task.id, { recurrence: e.target.value || null })
                }
              >
                {RECURRENCE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="detail-notes">
            <span className="detail-label">Notes</span>
            <textarea
              value={task.notes}
              onChange={(e) => onUpdate(task.id, { notes: e.target.value })}
              placeholder="Add notes…"
              rows={3}
            />
          </label>

          <div className="detail-checklist">
            <span className="detail-label">
              Checklist{hasSubtasks ? ` (${subDone}/${task.subtasks.length})` : ''}
            </span>
            {task.subtasks.map((s) => (
              <div key={s.id} className={`subtask${s.done ? ' subtask--done' : ''}`}>
                <input
                  type="checkbox"
                  checked={s.done}
                  onChange={() => toggleSubtask(s.id)}
                  aria-label={s.done ? 'Mark step undone' : 'Mark step done'}
                />
                <span className="subtask-text">{s.text}</span>
                <button
                  type="button"
                  className="subtask-delete"
                  onClick={() => deleteSubtask(s.id)}
                  aria-label="Delete step"
                >
                  ×
                </button>
              </div>
            ))}
            <form className="subtask-add" onSubmit={addSubtask}>
              <input
                type="text"
                value={subDraft}
                onChange={(e) => setSubDraft(e.target.value)}
                placeholder="+ Add a checklist step"
              />
              <button type="submit" disabled={!subDraft.trim()}>
                Add
              </button>
            </form>
          </div>

          <div className="detail-actions">
            <button
              type="button"
              className="btn btn--sm"
              onClick={() => onUpdate(task.id, { archived: !task.archived })}
            >
              {task.archived ? 'Restore' : 'Archive'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
