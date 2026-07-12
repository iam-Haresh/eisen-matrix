// Date helpers. All dates are local-time "YYYY-MM-DD" strings, which sort and
// compare correctly as plain strings.

function toISODate(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function todayStr() {
  return toISODate(new Date())
}

// Advance a date string by one recurrence period.
export function nextRecurrence(dateStr, recurrence) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  if (recurrence === 'daily') dt.setDate(dt.getDate() + 1)
  else if (recurrence === 'weekly') dt.setDate(dt.getDate() + 7)
  else if (recurrence === 'monthly') dt.setMonth(dt.getMonth() + 1)
  else return dateStr
  return toISODate(dt)
}

// Returns 'overdue' | 'today' | 'upcoming' | null for a task's due date.
export function dueStatus(dueDate, done) {
  if (!dueDate || done) return null
  const today = todayStr()
  if (dueDate < today) return 'overdue'
  if (dueDate === today) return 'today'
  return 'upcoming'
}

// Human-friendly short label, e.g. "Jul 10" or "Jul 10, 2027" if not this year.
export function formatDate(dateStr) {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const opts = { month: 'short', day: 'numeric' }
  if (y !== new Date().getFullYear()) opts.year = 'numeric'
  return dt.toLocaleDateString(undefined, opts)
}
