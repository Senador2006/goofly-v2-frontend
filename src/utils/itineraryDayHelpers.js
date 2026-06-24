/** Garante a qual dia (1-based) cada atividade pertence — `day`, `dayNumber` ou datas (`dayDate`, `canonicalDate`, etc.). */
export function getActivityDayNumber(act, dateToDayMap) {
  if (!act || typeof act !== 'object') return null
  const raw = act.day ?? act.dayNumber ?? act.day_number
  if (raw != null && raw !== '') {
    const n = Number(raw)
    if (Number.isFinite(n) && n >= 1) return Math.floor(n)
    if (typeof raw === 'string') {
      const isoMatch = /^(\d{4}-\d{2}-\d{2})/.exec(raw)
      if (isoMatch && dateToDayMap.has(isoMatch[1])) return dateToDayMap.get(isoMatch[1])
    }
  }
  const candidates = [
    act.dayDate,
    act.day_date,
    act.date,
    act.canonicalDate,
    act.canonical_date,
    act.scheduledDate,
    act.scheduled_date,
    act.itineraryDate,
    act.itinerary_date,
  ]
  for (const d of candidates) {
    if (typeof d !== 'string') continue
    const isoMatch = /^(\d{4}-\d{2}-\d{2})/.exec(d)
    if (isoMatch && dateToDayMap.has(isoMatch[1])) return dateToDayMap.get(isoMatch[1])
  }
  return null
}

/** Mapa `YYYY-MM-DD` → número do dia (1-based) na ordem das datas da trip. */
export function buildDateToDayMap(trip) {
  const map = new Map()
  if (!trip) return map
  let dayNum = 1
  for (const dest of trip?.destinations || []) {
    const start = new Date(dest.arrivalDate)
    const end = new Date(dest.departureDate)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) continue
    const d = new Date(start)
    while (d <= end) {
      map.set(d.toISOString().split('T')[0], dayNum)
      dayNum += 1
      d.setDate(d.getDate() + 1)
    }
  }
  return map
}

function startTimeKey(act) {
  const raw = act?.startTime || act?.start_time || act?.time || ''
  const m = /^(\d{1,2}):(\d{2})/.exec(String(raw))
  if (!m) return 99 * 60
  return Number(m[1]) * 60 + Number(m[2])
}

function activityOrderKey(act) {
  const o = Number(act?.order)
  if (Number.isFinite(o) && o >= 0) return o
  return Number.MAX_SAFE_INTEGER
}

/** Ordena atividades de UM dia por `order` (do agente) e desempata por `startTime`. */
export function sortDayActivities(list) {
  return [...list].sort((a, b) => {
    const oa = activityOrderKey(a)
    const ob = activityOrderKey(b)
    if (oa !== ob) return oa - ob
    return startTimeKey(a) - startTimeKey(b)
  })
}

/**
 * Troca uma atividade com a vizinha (mesmo dia) e reindexa `order` para refletir
 * a nova ordem exibida por `sortDayActivities`.
 *
 * @param {any[]} all
 * @param {Map<string, number>} dateToDayMap
 * @param {number} dayNum
 * @param {string | number} activityId
 * @param {-1 | 1} direction
 */
export function reorderActivityInSameDay(all, dateToDayMap, dayNum, activityId, direction) {
  const onDay = sortDayActivities(
    all.filter((a) => getActivityDayNumber(a, dateToDayMap) === dayNum),
  )
  const indexInSortedDay = onDay.findIndex((a) => String(a.id) === String(activityId))
  if (indexInSortedDay < 0) return all

  const swapIdx = indexInSortedDay + direction
  if (swapIdx < 0 || swapIdx >= onDay.length) return all

  ;[onDay[indexInSortedDay], onDay[swapIdx]] = [onDay[swapIdx], onDay[indexInSortedDay]]

  const orderById = new Map(onDay.map((a, i) => [String(a.id), i]))

  return all.map((a) => {
    if (getActivityDayNumber(a, dateToDayMap) !== dayNum) return a
    const nextOrder = orderById.get(String(a.id))
    return nextOrder != null ? { ...a, order: nextOrder } : a
  })
}

/**
 * Move uma atividade para um índice arbitrário no mesmo dia e reindexa `order`.
 *
 * @param {any[]} all
 * @param {Map<string, number>} dateToDayMap
 * @param {number} dayNum
 * @param {string | number} activityId
 * @param {number} toIndex destino 0-based no dia ordenado
 */
export function moveActivityToIndexInSameDay(all, dateToDayMap, dayNum, activityId, toIndex) {
  const onDay = sortDayActivities(
    all.filter((a) => getActivityDayNumber(a, dateToDayMap) === dayNum),
  )
  const fromIndex = onDay.findIndex((a) => String(a.id) === String(activityId))
  if (fromIndex < 0) return all

  const clampedTo = Math.max(0, Math.min(Math.floor(Number(toIndex) || 0), onDay.length - 1))
  if (fromIndex === clampedTo) return all

  const [moved] = onDay.splice(fromIndex, 1)
  onDay.splice(clampedTo, 0, moved)

  const orderById = new Map(onDay.map((a, i) => [String(a.id), i]))

  return all.map((a) => {
    if (getActivityDayNumber(a, dateToDayMap) !== dayNum) return a
    const nextOrder = orderById.get(String(a.id))
    return nextOrder != null ? { ...a, order: nextOrder } : a
  })
}

/** Agrupa atividades por número do dia (1-based), ordenadas dentro de cada dia. */
export function groupActivitiesByDay(activities, dateToDayMap, dayNumbers = []) {
  const byDay = new Map()
  for (const act of activities || []) {
    const day = getActivityDayNumber(act, dateToDayMap) ?? 1
    if (!byDay.has(day)) byDay.set(day, [])
    byDay.get(day).push(act)
  }

  const dayList =
    dayNumbers.length > 0
      ? [...new Set(dayNumbers)].sort((a, b) => a - b)
      : [...byDay.keys()].sort((a, b) => a - b)

  return dayList.map((day) => ({
    day,
    activities: sortDayActivities(byDay.get(day) || []),
  }))
}

/** Primeira data ISO (YYYY-MM-DD) associada ao número do dia. */
export function getIsoDateForDay(dateToDayMap, dayNum) {
  for (const [iso, num] of dateToDayMap.entries()) {
    if (num === dayNum) return iso
  }
  return null
}
