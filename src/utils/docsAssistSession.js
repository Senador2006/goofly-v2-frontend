/**
 * C13 — restore síncrono do assistente de documentos na aba (evita re-POST no remount).
 */

const STORAGE_PREFIX = 'goofly:docs-assist:'

function storageKey(tripId) {
  return `${STORAGE_PREFIX}${tripId}`
}

/**
 * @param {string} tripId
 * @returns {{ checklist: object, luggage: object } | null}
 */
export function readDocsAssistSession(tripId) {
  if (!tripId || typeof sessionStorage === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(storageKey(tripId))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    if (!parsed.checklist && !parsed.luggage) return null
    return {
      checklist: parsed.checklist ?? null,
      luggage: parsed.luggage ?? null,
    }
  } catch {
    return null
  }
}

/**
 * @param {string} tripId
 * @param {{ checklist?: object | null, luggage?: object | null }} payload
 */
export function writeDocsAssistSession(tripId, payload) {
  if (!tripId || typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.setItem(
      storageKey(tripId),
      JSON.stringify({
        checklist: payload.checklist ?? null,
        luggage: payload.luggage ?? null,
        savedAt: new Date().toISOString(),
      })
    )
  } catch {
    /* quota / private mode */
  }
}

/** @param {string} tripId */
export function clearDocsAssistSession(tripId) {
  if (!tripId || typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.removeItem(storageKey(tripId))
  } catch {
    /* ignore */
  }
}
