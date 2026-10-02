import {
  assignActivityToDay,
  getActivityDayNumber,
  getIsoDateForDay,
  sortDayActivities,
} from './itineraryDayHelpers.js'

/** Campos permitidos no PUT de persistência (whitelist). */
const PERSIST_KEYS = [
  'id',
  'place_id',
  'placeId',
  'source',
  'day',
  'dayNumber',
  'day_number',
  'dayDate',
  'day_date',
  'canonicalDate',
  'canonical_date',
  'order',
  'title',
  'name',
  'placeName',
  'description',
  'category',
  'startTime',
  'start_time',
  'time',
  'endTime',
  'end_time',
  'duration',
  'duration_minutes',
  'coordinates',
  'location',
  'coordinatesSource',
  'geocodeQuery',
  'geocodeVersion',
  'isMealRecommendation',
  'mealType',
  'meal_type',
  'mealPosition',
  'meal_position',
  'position',
  'ticketRequired',
  'ticket_required',
  'ticketUrl',
  'ticket_url',
  'ticketPurchaseHint',
  'ticket_purchase_hint',
  'purchaseLinks',
  'purchase_links',
  'googleMapsUrl',
  'google_maps_url',
]

/** Campos suficientes para POST route/preview. */
const ROUTE_PREVIEW_KEYS = [
  'id',
  'place_id',
  'placeId',
  'source',
  'day',
  'dayNumber',
  'day_number',
  'order',
  'title',
  'name',
  'placeName',
  'category',
  'startTime',
  'start_time',
  'time',
  'endTime',
  'end_time',
  'coordinates',
  'location',
  'lat',
  'lng',
  'latitude',
  'longitude',
  'coordinatesSource',
  'geocodeQuery',
  'geocodeVersion',
  'googleMapsUrl',
  'google_maps_url',
  'isMealRecommendation',
  'mealType',
  'meal_type',
  'mealPosition',
  'meal_position',
  'position',
]

function pickDefined(act, keys) {
  if (!act || typeof act !== 'object') return act
  /** @type {Record<string, unknown>} */
  const out = {}
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(act, key) && act[key] !== undefined) {
      out[key] = act[key]
    }
  }
  return out
}

/**
 * Remove galerias e lixo pesado; mantém superfície editável do roteiro.
 * @param {object} act
 */
export function slimActivityForPersist(act) {
  return pickDefined(act, PERSIST_KEYS)
}

/**
 * @param {object[]} activities
 */
export function slimActivitiesForRoutePreview(activities) {
  if (!Array.isArray(activities)) return []
  return activities.map((a) => pickDefined(a, ROUTE_PREVIEW_KEYS))
}

/** Normaliza flags de ingresso para o contrato persistido (camelCase + snake_case ou ausência). */
export function normalizeActivityTicketForPersist(act) {
  const required =
    act.ticketRequired === true ||
    act.requiresTicket === true ||
    act.ticket_required === true ||
    act.needs_ticket === true
  const out = { ...act }
  delete out.requiresTicket
  delete out.needs_ticket
  if (required) {
    out.ticketRequired = true
    out.ticket_required = true
  } else {
    delete out.ticketRequired
    delete out.ticket_required
  }
  return out
}

/**
 * Reagrupa todos os dias, ordena dentro de cada dia e normaliza day/dayNumber/order/datas
 * para persistência, aplicando slim (sem image_urls etc.).
 */
export function normalizeActivitiesForPersist(activities, dateToDayMap, fallbackDay = 1) {
  const listIn = Array.isArray(activities) ? activities : []
  const fb = Math.max(1, Math.floor(Number(fallbackDay) || 1))
  const withDay = listIn.map((a) => {
    const fromMap = getActivityDayNumber(a, dateToDayMap)
    let dayNum = fromMap
    if (dayNum == null || !Number.isFinite(dayNum)) {
      const raw = Number(a.day ?? a.dayNumber ?? a.day_number)
      dayNum = Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : fb
    } else {
      dayNum = Math.floor(dayNum)
    }
    dayNum = Math.max(1, dayNum)
    const assigned = assignActivityToDay(
      { ...a, day: dayNum, dayNumber: dayNum, day_number: dayNum },
      dayNum,
      dateToDayMap,
    )
    const iso = getIsoDateForDay(dateToDayMap, dayNum)
    return iso ? assigned : { ...a, day: dayNum, dayNumber: dayNum, day_number: dayNum }
  })
  /** @type {Map<number, any[]>} */
  const map = new Map()
  for (const a of withDay) {
    const d = Math.floor(Number(a.day) || 1)
    if (!map.has(d)) map.set(d, [])
    map.get(d).push(a)
  }
  const sortedDays = [...map.keys()].sort((x, y) => x - y)
  const out = []
  for (const d of sortedDays) {
    const list = sortDayActivities(map.get(d))
    list.forEach((a, i) =>
      out.push(slimActivityForPersist(normalizeActivityTicketForPersist({ ...a, order: i }))),
    )
  }
  return out
}
