import { useEffect, useRef, useState } from 'react'
import { makeId } from '../util.js'
import { todayStr } from '../dates.js'

const RECURRENCE_OPTIONS = [
  { value: '', label: "Doesn't repeat" },
  { value: 'daily', label: 'Repeats daily' },
  { value: 'weekly', label: 'Repeats weekly' },
  { value: 'monthly', label: 'Repeats monthly' },
]

export default function NewTaskModal({ quadrant, onSave, onClose }) {
  const [text, setText] = useState('')
  const [dueDate, setDueDate] = useState(todayStr())
  const [recurrence, setRecurrence] = useState('')
  const [notes, setNotes] = useState('')
  const [steps, setSteps] = useState([])
  const [stepDraft, setStepDraft] = useState('')
  const textRef = useRef(null)

  useEffect(() => {
    textRef.current?.focus()
  }, [])

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function addStep() {
    const trimmed = stepDraft.trim()
    if (!trimmed) return
    setSteps((prev) => [...prev, { id: makeId(), text: trimmed, done: false }])
    setStepDraft('')
  }

  function handleSubmit(e) {
    e.preventDefault()
    const trimmed = text.trim()
    if (!trimmed) return
    onSave({
      text: trimmed,
      dueDate: dueDate || null,
      recurrence: recurrence || null,
      notes: notes.trim(),
      subtasks: steps,
    })
    onClose()
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <form
        className="modal"
        onMouseDown={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <h3 className="modal-title">New task · {quadrant.title}</h3>

        <label>
          <span className="detail-label">Task</span>
          <input
            ref={textRef}
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="What needs doing?"
          />
        </label>

        <div className="detail-row">
          <label>
            <span className="detail-label">Due date</span>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </label>
          <label>
            <span className="detail-label">Repeat</span>
            <select
              value={recurrence}
              onChange={(e) => setRecurrence(e.target.value)}
            >
              {RECURRENCE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label>
          <span className="detail-label">Notes</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add notes…"
            rows={3}
          />
        </label>

        <div className="detail-checklist">
          <span className="detail-label">
            Checklist{steps.length > 0 ? ` (${steps.length})` : ''}
          </span>
          {steps.map((s) => (
            <div key={s.id} className="subtask">
              <span className="subtask-text">{s.text}</span>
              <button
                type="button"
                className="subtask-delete"
                onClick={() =>
                  setSteps((prev) => prev.filter((p) => p.id !== s.id))
                }
                aria-label="Remove step"
              >
                ×
              </button>
            </div>
          ))}
          <div className="subtask-add">
            <input
              type="text"
              value={stepDraft}
              onChange={(e) => setStepDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addStep()
                }
              }}
              placeholder="+ Add a checklist step"
            />
            <button type="button" onClick={addStep} disabled={!stepDraft.trim()}>
              Add
            </button>
          </div>
        </div>

        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn--primary"
            disabled={!text.trim()}
          >
            Add task
          </button>
        </div>
      </form>
    </div>
  )
}
