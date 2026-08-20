/**
 * Backup síncrono do baralho TDV no sessionStorage.
 * Cobre navegação SPA (sair da viagem → outro lugar do site → voltar):
 * o POST cache-skipped pode ser cancelado no unmount, mas o baralho local permanece.
 */

const PREFIX = 'goofly:tdv-deck:'

function storageKey(tripId) {
  return `${PREFIX}${tripId}`
}

export function saveTdvDeckSession(tripId, places) {
  if (!tripId || typeof sessionStorage === 'undefined') return
  try {
    const list = Array.isArray(places) ? places.filter(Boolean) : []
    if (list.length === 0) {
      sessionStorage.removeItem(storageKey(tripId))
      return
    }
    sessionStorage.setItem(storageKey(tripId), JSON.stringify(list))
  } catch {
    /* quota / private mode */
  }
}

export function readTdvDeckSession(tripId) {
  if (!tripId || typeof sessionStorage === 'undefined') return []
  try {
    const raw = sessionStorage.getItem(storageKey(tripId))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((p) => p && (p.id || p.placeId || p.place_id)) : []
  } catch {
    return []
  }
}

export function clearTdvDeckSession(tripId) {
  if (!tripId || typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.removeItem(storageKey(tripId))
  } catch {
    /* ignore */
  }
}
