/**
 * Deep-link /discover → Tinder de Viagens real (B13).
 * O TDV vive em `/trips/:id/itinerary?tab=tdv`.
 */

/**
 * @param {unknown} trips
 * @returns {object | null}
 */
export function pickDiscoverTrip(trips) {
  const list = Array.isArray(trips) ? trips.filter((t) => t && t.id != null) : []
  if (list.length === 0) return null

  const byStatus = (status) => list.find((t) => t.status === status)
  // Preferência alinhada ao funil: planejando (TDV ativo) → ativa → demais (lista já costuma vir por updated_at desc).
  return byStatus('planejando') || byStatus('ativa') || list[0]
}

/**
 * @param {string | number} tripId
 * @returns {string}
 */
export function discoverTdvPath(tripId) {
  return `/trips/${tripId}/itinerary?tab=tdv`
}
