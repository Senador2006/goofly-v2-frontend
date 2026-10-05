/**
 * Memória da aba para o tour e os rótulos do TDV.
 * A mesma chave de coach vale no planejamento e no pós-desbloqueio.
 */

const COACH_PREFIX = 'goofly:tdv-coach:'
const HINTS_PREFIX = 'goofly:tdv-hints:'

export const TDV_HINT_CHOICES_TO_HIDE = 2

function readFlag(key) {
  if (typeof sessionStorage === 'undefined') return null
  try {
    return sessionStorage.getItem(key)
  } catch {
    return null
  }
}

function writeFlag(key, value) {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.setItem(key, value)
  } catch {
    /* quota / private mode */
  }
}

export function readTdvCoachSeen(tripId) {
  if (!tripId) return false
  return readFlag(`${COACH_PREFIX}${tripId}`) === '1'
}

export function writeTdvCoachSeen(tripId) {
  if (!tripId) return
  writeFlag(`${COACH_PREFIX}${tripId}`, '1')
}

export function readTdvHintCount(tripId) {
  if (!tripId) return 0
  const count = Number(readFlag(`${HINTS_PREFIX}${tripId}`))
  if (!Number.isFinite(count) || count < 0) return 0
  return Math.floor(count)
}

export function writeTdvHintCount(tripId, count) {
  if (!tripId) return
  writeFlag(`${HINTS_PREFIX}${tripId}`, String(count))
}
