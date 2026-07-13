import { useState } from 'react'
import TaskCard from './TaskCard.jsx'
import NewTaskModal from './NewTaskModal.jsx'

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
  const [adding, setAdding] = useState(false)
  const [isOver, setIsOver] = useState(false)

  function handleDrop(e) {
    e.preventDefault()
    setIsOver(false)
    const id = e.dataTransfer.getData('text/plain')
    if (id) onMove(id, quadrant.key)
  }

  const remaining = tasks.filter((t) => !t.done).length
  // Completed tasks sink to the bottom; sort is stable so order is otherwise kept.
  const ordered = [...tasks].sort((a, b) => Number(a.done) - Number(b.done))

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
        {ordered.length === 0 ? (
          <p className="quadrant-empty">Nothing here yet — drop or add a task.</p>
        ) : (
          ordered.map((task) => (
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
        <>
          <button
            type="button"
            className="quadrant-add-btn"
            onClick={() => setAdding(true)}
            aria-label={`Add a task to ${quadrant.title}`}
          >
            + Add a task
          </button>
          {adding && (
            <NewTaskModal
              quadrant={quadrant}
              onSave={(details) => onAdd(quadrant.key, details)}
              onClose={() => setAdding(false)}
            />
          )}
        </>
      )}
    </section>
  )
}
