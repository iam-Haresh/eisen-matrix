// Id generator that works on every browser (no crypto dependency needed).
export function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}
