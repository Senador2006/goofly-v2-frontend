/**
 * Backup síncrono do baralho TDV no sessionStorage.
 *
 * Precedência no restore (`TinderView.loadPlaces`):
 *  1. **sessionStorage** (este módulo) — sync; cobre SPA (sair → voltar) mesmo se o POST abortar
 *  2. **POST cache-skipped** (servidor) — via sendBeacon / fetch keepalive / Axios
 *     (`tdvCacheSkippedKeepalive` + `placeService.cacheSkippedPlaces`)
 *
 * No unload, `releaseDeckToServer` grava aqui **antes** do POST best-effort.
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
