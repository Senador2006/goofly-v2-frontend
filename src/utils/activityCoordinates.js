/** @param {unknown} x */
function finiteNum(x) {
  if (x == null) return NaN
  if (typeof x === 'number' && Number.isFinite(x)) return x
  const p =
    typeof x === 'string' ? parseFloat(String(x).replace(',', '.').trim()) : Number.NaN
  return Number.isFinite(p) ? p : Number.NaN
}

/** @param {unknown} source */
export function normalizeWgs84Point(source) {
  if (source == null) return null
  if (Array.isArray(source) && source.length >= 2) {
    const latitude = finiteNum(source[0])
    const longitude = finiteNum(source[1])
    if (
      Number.isFinite(latitude) &&
      Number.isFinite(longitude) &&
      Math.abs(latitude) <= 90 &&
      Math.abs(longitude) <= 180
    )
      return { latitude, longitude }
    return null
  }
  if (typeof source !== 'object') return null
  const o = /** @type {Record<string, unknown>} */ (source)
  const latitude = finiteNum(o.latitude ?? o.lat ?? o.Latitude ?? o.Lat)
  const longitude = finiteNum(o.longitude ?? o.lng ?? o.lon ?? o.Longitude ?? o.Lng)
  if (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180 &&
    !(latitude === 0 && longitude === 0)
  )
    return { latitude, longitude }
  return null
}

/**
 * @param {Record<string, unknown>} fragment
 */
function resolveFromNested(fragment) {
  const nested = ['coordinates', 'location', 'geo', 'position', 'latLng']
  /** @type {unknown[]} */
  const cands = []
  for (const k of nested)
    if (k in fragment && fragment[k] != null) cands.push(fragment[k])
  const g =
    fragment.geometry && typeof fragment.geometry === 'object' ? fragment.geometry : null
  if (g?.location != null) cands.push(g.location)
  const pl = fragment.place && typeof fragment.place === 'object' ? fragment.place : null
  if (pl) {
    for (const k of nested)
      if (k in pl && /** @type {Record<string, unknown>} */ (pl)[k] != null)
        cands.push(/** @type {Record<string, unknown>} */ (pl)[k])
  }
  cands.push(fragment)
  for (const c of cands) {
    const n = normalizeWgs84Point(c)
    if (n) return n
  }
  return null
}

/** @param {unknown} act */
export function resolveActivityCoordinates(act) {
  if (!act || typeof act !== 'object') return null
  return resolveFromNested(/** @type {Record<string, unknown>} */ (act))
}

/** @param {{ latitude: number, longitude: number }} c */
export function googleMapsPlaceUrl(c) {
  const q = `${c.latitude.toFixed(6)},${c.longitude.toFixed(6)}`
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`
}
