/** Dia declarado no payload de GET /itinerary/route (`day` / `dayNumber`). */
export function resolveRoutePayloadDay(routeData) {
  if (routeData == null || typeof routeData !== 'object') return null
  const raw = routeData.day ?? routeData.dayNumber ?? routeData.day_number
  const n = Number(raw)
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : null
}

/** Só confia na rota da API se o campo `day` bater com o dia selecionado. */
export function routeDataMatchesDay(routeData, dayNum) {
  if (routeData == null || dayNum == null || !Number.isFinite(Number(dayNum))) return false
  const expected = Math.floor(Number(dayNum))
  const payloadDay = resolveRoutePayloadDay(routeData)
  return payloadDay != null && payloadDay === expected
}
