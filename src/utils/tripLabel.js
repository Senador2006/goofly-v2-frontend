/**
 * Rótulo legível para exibição de viagens em seletores e listas.
 */
export function formatTripLabel(trip) {
  if (!trip) return 'Viagem'
  const firstDest = trip.destinations?.[0]
  if (firstDest?.city) return String(firstDest.city)
  if (trip.id != null) return `Viagem ${trip.id}`
  return 'Viagem'
}
