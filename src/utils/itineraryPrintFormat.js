/** @param {Record<string, any>} act */
export function resolveActivityTitle(act, fallbackIndex = 0) {
  return act?.title || act?.name || act?.placeName || `Atividade ${fallbackIndex + 1}`
}

/** @param {Record<string, any>} act */
export function resolveActivitySchedule(act) {
  const start = act?.startTime || act?.start_time || act?.time || ''
  const end = act?.endTime || act?.end_time
  if (typeof end === 'string' && end.trim() && start) {
    return `${start} – ${end.trim()}`
  }
  return start || null
}

/** @param {Record<string, any>} act */
export function resolveActivityDescription(act) {
  if (!act || typeof act !== 'object') return null
  const candidates = [
    act.description,
    act.notes,
    act.reasoning,
    act.summary,
    act.aiReasoning,
    act.ai_reasoning,
  ]
  for (const raw of candidates) {
    if (raw == null) continue
    const text = String(raw).trim()
    if (!text) continue
    const lower = text.toLowerCase()
    if (text.length < 5) continue
    if (['tbd', 'todo', 'placeholder', 'n/a', '-', '—', 'atividade sugerida'].includes(lower)) continue
    return text
  }
  return null
}

function normalizeHttpUrl(raw) {
  if (raw == null) return ''
  let u = String(raw).trim()
  if (!u) return ''
  u = u.replace(/[.,;:!?)\]}>]+$/, '').replace(/^<+|>+$/g, '')
  return /^https?:\/\//i.test(u) ? u : ''
}

/** @param {Record<string, any>} act */
export function resolveActivityLinks(act) {
  if (!act || typeof act !== 'object') return []
  const fields = [
    act.ticketUrl,
    act.ticket_url,
    act.bookingUrl,
    act.booking_url,
    act.booking_link,
    act.bookingLink,
    act.reservationUrl,
    act.reservation_url,
  ]
  const seen = new Set()
  const links = []
  for (const raw of fields) {
    const url = normalizeHttpUrl(raw)
    if (url && !seen.has(url)) {
      seen.add(url)
      links.push(url)
    }
  }
  return links
}

/** @param {string | undefined} iso YYYY-MM-DD */
export function formatIsoDatePt(iso) {
  if (!iso) return null
  const d = new Date(`${iso}T12:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

/** @param {import('./itineraryDayHelpers.js').buildDateToDayMap extends Function ? ReturnType<typeof import('./itineraryDayHelpers.js').buildDateToDayMap> : never} dateToDayMap */
export function formatTripDateRange(trip) {
  const dests = trip?.destinations || []
  if (!dests.length) return null
  const firstIso = dests[0]?.arrivalDate?.slice?.(0, 10)
  const lastIso = dests[dests.length - 1]?.departureDate?.slice?.(0, 10)
  if (!firstIso || !lastIso) return null
  if (firstIso === lastIso) return formatIsoDatePt(firstIso)
  const first = formatIsoDatePt(firstIso)
  const last = formatIsoDatePt(lastIso)
  return first && last ? `${first} — ${last}` : null
}
