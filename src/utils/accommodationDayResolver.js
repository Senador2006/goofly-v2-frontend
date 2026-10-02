import { readLatLng } from './coordinates.js'
import { getIsoDateForDay } from './itineraryDayHelpers.js'

/** @param {unknown} raw */
export function toIsoCalendarPrefix(raw) {
  if (raw == null || raw === '') return null
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(raw).trim())
  return m ? m[1] : null
}

/** @param {Record<string, unknown> | null | undefined} acc */
export function accommodationDisplayLabel(acc) {
  if (!acc) return ''
  return String(acc.name || acc.address || '').trim()
}

/** @param {Record<string, unknown> | null | undefined} acc */
export function isAccommodationPlottable(acc) {
  if (!acc) return false
  return Boolean(accommodationDisplayLabel(acc)) && Boolean(readLatLng(acc))
}

/** @param {Record<string, unknown> | null | undefined} acc */
export function accommodationStableId(acc, fallback = '') {
  const id = acc?.id ?? acc?.accommodationId ?? acc?.accommodation_id
  if (id != null && String(id).trim()) return String(id)
  return fallback
}

/**
 * @param {Record<string, unknown> | null | undefined} trip
 * @param {string} iso
 */
export function findDestinationCoveringIso(trip, iso) {
  for (const dest of trip?.destinations || []) {
    const arr = toIsoCalendarPrefix(dest.arrivalDate ?? dest.arrival_date)
    const dep = toIsoCalendarPrefix(dest.departureDate ?? dest.departure_date)
    if (arr && dep && iso >= arr && iso <= dep) return dest
  }
  return null
}

/**
 * @param {Record<string, unknown>[]} matches
 * @param {Record<string, unknown> | null | undefined} dest
 */
export function preferStayForDestination(matches, dest) {
  if (!matches?.length) return null
  if (matches.length === 1) return matches[0]
  if (dest?.id) {
    const match = matches.find(
      (a) => (a.destinationId || a.destination_id) === dest.id,
    )
    if (match) return match
  }
  return matches[0]
}

/**
 * Resolve por data primeiro; destino só desempata se houver mais de uma (legado).
 * @param {Record<string, unknown> | null | undefined} trip
 * @param {number} dayNum
 * @param {Map<string, number>} dateToDayMap
 * @param {{ plottableOnly?: boolean }} [options]
 */
export function resolveAccommodationsForDay(trip, dayNum, dateToDayMap, options = {}) {
  const plottableOnly = options.plottableOnly !== false
  if (!trip || dayNum == null || !Number.isFinite(Number(dayNum)) || Number(dayNum) < 1) {
    return []
  }

  const iso = getIsoDateForDay(dateToDayMap, dayNum)
  if (!iso) return []

  const dest = findDestinationCoveringIso(trip, iso)
  const allAccs = trip.accommodations || []

  /** @type {Record<string, unknown>[]} */
  const results = []
  for (let i = 0; i < allAccs.length; i += 1) {
    const acc = allAccs[i]
    const checkIn = toIsoCalendarPrefix(acc.checkIn ?? acc.check_in)
    const checkOut = toIsoCalendarPrefix(acc.checkOut ?? acc.check_out)
    if (!checkIn || !checkOut) continue
    if (iso < checkIn || iso > checkOut) continue
    if (plottableOnly && !isAccommodationPlottable(acc)) continue
    const coords = readLatLng(acc)
    results.push({
      ...acc,
      id: accommodationStableId(acc, `acc-day-${dayNum}-${i}`),
      coords,
      destinationCity: dest?.city || null,
    })
  }

  if (results.length <= 1 || !dest?.id) return results

  const preferred = preferStayForDestination(results, dest)
  if (!preferred) return results
  return [preferred, ...results.filter((a) => a !== preferred)]
}

/**
 * @param {Record<string, unknown> | null | undefined} trip
 * @param {number} dayNum
 * @param {Map<string, number>} dateToDayMap
 */
export function resolveAccommodationForDay(trip, dayNum, dateToDayMap) {
  const list = resolveAccommodationsForDay(trip, dayNum, dateToDayMap)
  const iso = getIsoDateForDay(dateToDayMap, dayNum)
  const dest = findDestinationCoveringIso(trip, iso)
  return preferStayForDestination(list, dest)
}

/**
 * Hospedagem usada nas pernas verde/vermelha (a mais próxima da 1ª parada se houver várias).
 * @param {Record<string, unknown>[]} accommodations
 * @param {{ coords: [number, number] }[]} [markers]
 */
export function pickPrimaryAccommodationForLegs(accommodations, markers = []) {
  const plottable = (accommodations || []).filter((a) => a?.coords || readLatLng(a))
  if (plottable.length === 0) return null
  if (plottable.length === 1) {
    const acc = plottable[0]
    return { ...acc, coords: acc.coords || readLatLng(acc) }
  }

  const first = markers[0]?.coords
  if (!first) return { ...plottable[0], coords: plottable[0].coords || readLatLng(plottable[0]) }

  let best = plottable[0]
  let bestDist = Number.POSITIVE_INFINITY
  for (const acc of plottable) {
    const c = acc.coords || readLatLng(acc)
    if (!c) continue
    const dist = (c[0] - first[0]) ** 2 + (c[1] - first[1]) ** 2
    if (dist < bestDist) {
      bestDist = dist
      best = { ...acc, coords: c }
    }
  }
  return best
}

/** @param {Record<string, unknown> | null | undefined} acc */
export function accommodationCacheSignature(acc) {
  if (!acc) return 'noacc'
  const c = readLatLng(acc)
  const coord = c ? `${c[0].toFixed(5)},${c[1].toFixed(5)}` : 'nocoord'
  return `${accommodationStableId(acc, 'noid')}:${accommodationDisplayLabel(acc)}@${coord}`
}

/** @param {Record<string, unknown>[]} accs */
export function accommodationsCacheSignature(accs) {
  if (!Array.isArray(accs) || accs.length === 0) return 'noacc'
  return accs.map((acc, i) => accommodationCacheSignature(acc) || `empty${i}`).join(';')
}

/** @param {Record<string, unknown>[]} accs */
export function hasPlottableAccommodation(accs) {
  return (accs || []).some((a) => isAccommodationPlottable(a))
}

/** Verifica sobreposição de intervalos ISO (inclusivo). */
export function accommodationDateRangesOverlap(startA, endA, startB, endB) {
  if (!startA || !endA || !startB || !endB) return false
  return startA <= endB && startB <= endA
}
