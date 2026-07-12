import { useState } from 'react'
import TaskCard from './TaskCard.jsx'

export default function Quadrant({
  quadrant,
  tasks,
  showAdd = true,
  onAdd,
  onToggle,
  onUpdate,
  onDelete,
  onMove,
}) {
  const [draft, setDraft] = useState('')
  const [isOver, setIsOver] = useState(false)

  function handleSubmit(e) {
    e.preventDefault()
    onAdd(quadrant.key, draft)
    setDraft('')
  }

  function handleDrop(e) {
    e.preventDefault()
    setIsOver(false)
    const id = e.dataTransfer.getData('text/plain')
    if (id) onMove(id, quadrant.key)
  }

  const remaining = tasks.filter((t) => !t.done).length

  return (
    <section
      className={`quadrant quadrant--${quadrant.key}${isOver ? ' drag-over' : ''}`}
      onDragOver={(e) => {
        e.preventDefault()
        if (!isOver) setIsOver(true)
      }}
      onDragLeave={(e) => {
        // Only clear when the cursor actually leaves the quadrant, not a child.
        if (!e.currentTarget.contains(e.relatedTarget)) setIsOver(false)
      }}
      onDrop={handleDrop}
    >
      <div className="quadrant-header">
        <div>
          <h2 className="quadrant-title">{quadrant.title}</h2>
          <p className="quadrant-subtitle">{quadrant.subtitle}</p>
        </div>
        <span className="quadrant-count" title={`${remaining} to do`}>
          {remaining}
        </span>
      </div>

      <div className="quadrant-list">
        {tasks.length === 0 ? (
          <p className="quadrant-empty">Nothing here yet — drop or add a task.</p>
        ) : (
          tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onToggle={onToggle}
              onUpdate={onUpdate}
              onDelete={onDelete}
            />
          ))
        )}
      </div>

      {showAdd && (
        <form className="quadrant-add" onSubmit={handleSubmit}>
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="+ Add a task"
            aria-label={`Add a task to ${quadrant.title}`}
          />
          <button type="submit" disabled={!draft.trim()}>
            Add
          </button>
        </form>
      )}
    </section>
  )
}
