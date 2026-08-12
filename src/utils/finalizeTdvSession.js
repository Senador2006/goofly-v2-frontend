import { AI_TIMEOUT_MS } from '../services/api'

const STORAGE_KEY = 'goofly:finalize-tdv'
/** Margem além do timeout do POST para o poll pós-refresh ainda pegar o fim no servidor. */
const GRACE_MS = 30_000

/**
 * Persiste “finalize em andamento” na aba (sessionStorage) para sobreviver a refresh.
 * O POST em si não retoma — após reload o cliente só observa até a viagem ficar `ativa`.
 */
export function markFinalizeTdvSession(tripId) {
  if (tripId == null || typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ tripId: String(tripId), startedAt: Date.now() }),
    )
  } catch {
    /* private mode / quota */
  }
}

export function clearFinalizeTdvSession(tripId) {
  if (typeof sessionStorage === 'undefined') return
  try {
    const cur = readFinalizeTdvSessionRaw()
    if (!cur) return
    if (tripId != null && String(cur.tripId) !== String(tripId)) return
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

function readFinalizeTdvSessionRaw() {
  if (typeof sessionStorage === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.tripId || typeof parsed.startedAt !== 'number') return null
    return parsed
  } catch {
    return null
  }
}

/**
 * @returns {{ tripId: string, startedAt: number } | null}
 */
export function readFinalizeTdvSession(tripId) {
  const parsed = readFinalizeTdvSessionRaw()
  if (!parsed) return null
  if (tripId != null && String(parsed.tripId) !== String(tripId)) return null
  const maxAge = AI_TIMEOUT_MS + GRACE_MS
  if (Date.now() - parsed.startedAt > maxAge) {
    try {
      sessionStorage.removeItem(STORAGE_KEY)
    } catch {
      /* ignore */
    }
    return null
  }
  return parsed
}

export function finalizeTdvSessionDeadline(session) {
  if (!session?.startedAt) return Date.now()
  return session.startedAt + AI_TIMEOUT_MS + GRACE_MS
}

export function isFinalizeRequestAbort(err) {
  return (
    err?.code === 'ERR_CANCELED' ||
    err?.name === 'CanceledError' ||
    err?.name === 'AbortError'
  )
}
