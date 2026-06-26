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

export function resolveMapMarkers({ localMarkers, apiMarkers, routeRestricted }) {
  if (routeRestricted) return localMarkers
  return localMarkers.length > 0 ? localMarkers : apiMarkers
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
