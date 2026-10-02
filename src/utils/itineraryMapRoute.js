import { routeGeometryToLatLngs, readLatLng } from './coordinates.js'
import { accommodationStableId, isAccommodationPlottable } from './accommodationDayResolver.js'

/** IDs estáveis das atividades visíveis no mapa (prévia premium). */
export function buildVisibleActivityIdSet(activities) {
  return new Set(
    (activities || [])
      .map((a) => String(a?.id ?? a?.placeId ?? a?.place_id ?? ''))
      .filter(Boolean),
  )
}

/** Garante que markers da API não incluem paradas bloqueadas. */
export function apiRouteMatchesVisibleActivities(routeData, visibleIds) {
  const markers = routeData?.markers
  if (!Array.isArray(markers) || markers.length === 0) return true
  if (!(visibleIds instanceof Set) || visibleIds.size === 0) return false
  return markers.every((m) => {
    const id = String(m?.activityId ?? '')
    return id && visibleIds.has(id)
  })
}

/** Garante que markers da API respeitam paradas visíveis (exclui refeições da rota principal). */
export function filterMarkersByVisibleIds(markers, visibleIds) {
  if (!Array.isArray(markers) || markers.length === 0) return []
  if (!(visibleIds instanceof Set) || visibleIds.size === 0) return markers
  return markers.filter((m) => {
    const id = String(m?.activityId ?? '')
    return id && visibleIds.has(id)
  })
}

export function resolveMapMarkers({
  localMarkers,
  apiMarkers,
  routeRestricted,
  apiRouteSafeForPreview = true,
  visibleActivityIds,
}) {
  if (routeRestricted && !apiRouteSafeForPreview) return []
  let markers = Array.isArray(apiMarkers) && apiMarkers.length > 0 ? apiMarkers : []
  markers = filterMarkersByVisibleIds(markers, visibleActivityIds)
  if (markers.length > 0) return markers
  // Pins otimistas enquanto a rota do dia carrega (coords já no itinerário).
  const local = Array.isArray(localMarkers) ? localMarkers : []
  return filterMarkersByVisibleIds(local, visibleActivityIds)
}

/**
 * Markers locais a partir das activities do dia (coords persistidas / likes).
 * Usados só até a API de rota responder.
 * @param {Record<string, unknown>[]} activities
 */
export function buildOptimisticMarkersFromActivities(activities) {
  const list = Array.isArray(activities) ? activities : []
  const out = []
  let order = 0
  for (let i = 0; i < list.length; i += 1) {
    const act = list[i]
    if (!act || typeof act !== 'object') continue
    const coords = readLatLng(act)
    if (!coords) continue
    order += 1
    const activityId = String(act.id || act.placeId || act.place_id || `idx-${i}`)
    out.push({
      order,
      activityId,
      name: String(act.name || act.title || act.placeName || 'Parada').trim() || 'Parada',
      startTime: act.startTime ?? act.start_time ?? act.time ?? null,
      source: act.source ?? null,
      placeId: act.placeId ?? act.place_id ?? null,
      coords,
      coordSource: 'optimistic',
    })
  }
  return out
}

/** Ordena dias para prefetch: vizinhos do atual primeiro, depois o restante. */
export function orderDaysForPrefetch(days, currentDay) {
  const list = [...new Set((days || []).map(Number).filter((d) => Number.isFinite(d) && d >= 1))]
  const cur = Number(currentDay)
  if (!Number.isFinite(cur)) return list.sort((a, b) => a - b)
  const rest = list.filter((d) => d !== cur)
  rest.sort((a, b) => {
    const da = Math.abs(a - cur)
    const db = Math.abs(b - cur)
    if (da !== db) return da - db
    return a - b
  })
  return rest
}

export function resolvePolylinePositions({
  routePayloadValid,
  routeData,
  markers,
  routeRestricted,
  apiRouteSafeForPreview,
}) {
  if (routePayloadValid && (!routeRestricted || apiRouteSafeForPreview)) {
    const fromApi = routeGeometryToLatLngs(routeData?.route)
    if (fromApi.length >= 2) return fromApi
  }
  if (markers.length >= 2) return markers.map((m) => m.coords)
  return []
}

/**
 * @param {{ route?: object } | null | undefined} legPayload
 * @param {[number, number]} from
 * @param {[number, number]} to
 */
export function resolveLegPolylinePositions(legPayload, from, to) {
  const fromApi = routeGeometryToLatLngs(legPayload?.route)
  if (fromApi.length >= 2) return fromApi
  if (from && to) return [from, to]
  return []
}

/**
 * @param {Record<string, unknown> | null | undefined} fromProp
 * @param {Record<string, unknown> | null | undefined} fromApi
 */
export function mergeAccommodationForMap(fromProp, fromApi) {
  const merged = mergeAccommodationsForMap(
    fromProp ? [fromProp] : [],
    fromApi ? [fromApi] : [],
  )
  return merged[0] ?? null
}

function normalizeMapAccommodation(acc, fallbackId = '') {
  const coords = readLatLng(acc)
  if (!acc || !coords) return null
  return {
    ...acc,
    id: accommodationStableId(acc, fallbackId),
    coords,
  }
}

/**
 * @param {Record<string, unknown>[]} fromProps
 * @param {Record<string, unknown>[]} fromApiList
 */
export function mergeAccommodationsForMap(fromProps, fromApiList) {
  /** @type {Map<string, Record<string, unknown>>} */
  const byId = new Map()

  for (let i = 0; i < (fromApiList || []).length; i += 1) {
    const item = normalizeMapAccommodation(fromApiList[i], `api-${i}`)
    if (!item) continue
    byId.set(String(item.id), item)
  }

  for (let i = 0; i < (fromProps || []).length; i += 1) {
    const item = normalizeMapAccommodation(fromProps[i], `prop-${i}`)
    if (!item) continue
    byId.set(String(item.id), item)
  }

  return [...byId.values()]
}

/** @param {Record<string, unknown>[]} fromProps */
export function plottableAccommodationsFromProps(fromProps) {
  return (fromProps || [])
    .filter((a) => isAccommodationPlottable(a))
    .map((a, i) => normalizeMapAccommodation(a, `prop-${i}`))
    .filter(Boolean)
}
