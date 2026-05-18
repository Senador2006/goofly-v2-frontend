/**
 * Parsing defensivo de coordenadas (atividades, destinos, memórias).
 */

export function readLatLng(p) {
  const c = p?.coordinates ?? p?.location ?? p
  if (!c) return null
  if (Array.isArray(c) && c.length >= 2) {
    const [lat, lng] = c
    return Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0)
      ? [Number(lat), Number(lng)]
      : null
  }
  const lat = c.latitude ?? c.lat
  const lng = c.longitude ?? c.lng ?? c.lon
  if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) return null
  if (Number(lat) === 0 && Number(lng) === 0) return null
  return [Number(lat), Number(lng)]
}

/** GeoJSON LineString ORS [lon,lat] → Leaflet [lat,lng] */
export function routeGeometryToLatLngs(route) {
  const coords = route?.geometry?.coordinates
  if (!Array.isArray(coords) || coords.length === 0) return []
  return coords.map((pair) => {
    if (!Array.isArray(pair) || pair.length < 2) return null
    return [Number(pair[1]), Number(pair[0])]
  }).filter(Boolean)
}

export function formatRouteDistance(meters) {
  if (meters == null || !Number.isFinite(Number(meters))) return null
  const m = Number(meters)
  if (m >= 1000) return `${(m / 1000).toFixed(1)} km`
  return `${Math.round(m)} m`
}

export function formatRouteDuration(seconds) {
  if (seconds == null || !Number.isFinite(Number(seconds))) return null
  const s = Math.round(Number(seconds))
  const h = Math.floor(s / 3600)
  const min = Math.floor((s % 3600) / 60)
  if (h > 0) return `${h}h ${min}min`
  return `${min} min`
}
