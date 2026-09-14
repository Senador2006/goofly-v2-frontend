export function generateId() {
  return 'dest-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9)
}

export function newCreateIdempotencyKey() {
  return (
    globalThis.crypto?.randomUUID?.() ||
    `trip-${Date.now()}-${Math.random().toString(16).slice(2)}`
  )
}

export function applyDestinationDateRules(destinations, index, updates) {
  const dests = destinations.map((d, i) => (i === index ? { ...d, ...updates } : { ...d }))
  return { dests, notices: [] }
}
