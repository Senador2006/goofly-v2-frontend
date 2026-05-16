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

export function getTripDayCount(trip) {
  if (!trip?.destinations?.length) return 1
  let total = 0
  for (const dest of trip.destinations) {
    if (!dest.arrivalDate || !dest.departureDate) continue
    const start = new Date(dest.arrivalDate)
    const end = new Date(dest.departureDate)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) continue
    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1
    total += Math.max(1, days)
  }
  return total > 0 ? total : 1
}
