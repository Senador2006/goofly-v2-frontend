import { buildDateToDayMap } from './itineraryDayHelpers.js'

const FULL_PLANNING_TYPES = ['planejamento_completo', 'premium']

/** Pagamento desbloqueia o planejamento desta viagem (não todas as viagens do usuário). */
export function hasTripPlanningUnlocked(trip) {
  return Boolean(trip?.planning_unlocked_at)
}

export function hasActivePlanningAccess(user) {
  if (!user) return false
  const type = user.subscription_type || 'free'
  if (!FULL_PLANNING_TYPES.includes(type)) return false
  if (!user.subscription_expires_at) return true
  return new Date(user.subscription_expires_at) > new Date()
}

/**
 * UI do roteiro — fonte de verdade é a resposta da API desta viagem.
 * Não usa subscription global do usuário (pode existir de outro pagamento).
 */
export function hasItineraryFullAccess(itinerary, trip) {
  if (itinerary?._premiumRestriction) return false
  if (itinerary?._access && typeof itinerary._access.fullAccess === 'boolean') {
    return itinerary._access.fullAccess === true
  }
  return hasTripPlanningUnlocked(trip)
}

export function getTripDayCount(trip) {
  const n = buildDateToDayMap(trip).size
  return n > 0 ? n : 1
}
