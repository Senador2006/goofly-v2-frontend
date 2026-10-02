import { toIsoCalendarPrefix } from './accommodationDayResolver.js'

export function addDaysIso(iso, delta) {
  const prefix = toIsoCalendarPrefix(iso)
  if (!prefix) return null
  const d = new Date(`${prefix}T00:00:00`)
  d.setDate(d.getDate() + delta)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function formatStayDayPt(iso) {
  const prefix = toIsoCalendarPrefix(iso)
  if (!prefix) return ''
  const [y, m, d] = prefix.split('-')
  return `${d}/${m}/${y}`
}

function stayDisplayName(acc) {
  return String(acc?.name || acc?.address || '').trim() || 'Nova hospedagem'
}

function stayHasContent(acc) {
  return Boolean(String(acc?.name || acc?.address || '').trim())
}

/** Dias de calendário ocupados (check-in e check-out inclusive). */
export function occupiedStayDays(acc) {
  const start = toIsoCalendarPrefix(acc?.checkIn ?? acc?.check_in)
  const end = toIsoCalendarPrefix(acc?.checkOut ?? acc?.check_out)
  if (!start || !end || start > end) return []
  const days = []
  let cur = start
  while (cur <= end) {
    days.push(cur)
    cur = addDaysIso(cur, 1)
    if (!cur) break
  }
  return days
}

export function occupiedStayDaySet(accommodations, { excludeId } = {}) {
  const set = new Set()
  for (const a of accommodations || []) {
    if (excludeId != null && String(a.id) === String(excludeId)) continue
    for (const iso of occupiedStayDays(a)) set.add(iso)
  }
  return set
}

function stayRange(acc) {
  const start = toIsoCalendarPrefix(acc?.checkIn ?? acc?.check_in)
  const end = toIsoCalendarPrefix(acc?.checkOut ?? acc?.check_out)
  if (!start || !end || start > end) return null
  return { start, end }
}

function rangeOverlap(aStart, aEnd, bStart, bEnd) {
  const start = aStart > bStart ? aStart : bStart
  const end = aEnd < bEnd ? aEnd : bEnd
  if (start > end) return null
  return { start, end }
}

function replacementMessage(winner, loser, overlapStart, overlapEnd) {
  return `Hospedagem ${stayDisplayName(winner)} substituirá hospedagem ${stayDisplayName(loser)} nos dias ${formatStayDayPt(overlapStart)} até ${formatStayDayPt(overlapEnd)}`
}

function newSplitId(baseId, suffix) {
  const base = baseId != null && String(baseId).trim() ? String(baseId) : 'acc'
  return `${base}-part-${suffix}-${Math.random().toString(36).slice(2, 7)}`
}

/**
 * Remove o intervalo [winStart, winEnd] da estadia perdedora.
 * Pode gerar 0, 1 ou 2 fragmentos.
 */
export function subtractStayRange(loser, winStart, winEnd) {
  const range = stayRange(loser)
  if (!range) return []
  const { start: lStart, end: lEnd } = range
  const parts = []

  if (lStart < winStart) {
    const beforeEnd = addDaysIso(winStart, -1)
    if (beforeEnd && beforeEnd >= lStart) {
      parts.push({
        ...loser,
        checkIn: lStart,
        checkOut: beforeEnd,
        check_in: undefined,
        check_out: undefined,
      })
    }
  }

  if (lEnd > winEnd) {
    const afterStart = addDaysIso(winEnd, 1)
    if (afterStart && afterStart <= lEnd) {
      parts.push({
        ...loser,
        id: parts.length > 0 ? newSplitId(loser.id, 'b') : loser.id,
        checkIn: afterStart,
        checkOut: lEnd,
        check_in: undefined,
        check_out: undefined,
      })
    }
  }

  return parts
}

/**
 * Resolve sobreposições: estadias posteriores (ou `priorityId`) vencem e encurtam as anteriores.
 * @returns {{ accommodations: Record<string, unknown>[], warnings: { message: string, overlapStart: string, overlapEnd: string, winnerId: unknown, loserId: unknown }[] }}
 */
export function resolveAccommodationDayOverlaps(accommodations, { priorityId } = {}) {
  const list = accommodations || []
  const empty = list.filter((a) => !stayHasContent(a))
  const filled = list.filter(stayHasContent)

  let ordered = [...filled]
  if (priorityId != null) {
    const idx = ordered.findIndex((a) => String(a.id) === String(priorityId))
    if (idx >= 0) {
      const [priority] = ordered.splice(idx, 1)
      ordered.push(priority)
    }
  }

  /** @type {Record<string, unknown>[]} */
  let kept = []
  /** @type {{ message: string, overlapStart: string, overlapEnd: string, winnerId: unknown, loserId: unknown }[]} */
  const warnings = []

  for (const incoming of ordered) {
    const incomingRange = stayRange(incoming)
    if (!incomingRange) {
      kept.push(incoming)
      continue
    }

    /** @type {Record<string, unknown>[]} */
    const nextKept = []
    for (const existing of kept) {
      const existingRange = stayRange(existing)
      if (!existingRange) {
        nextKept.push(existing)
        continue
      }
      const overlap = rangeOverlap(
        existingRange.start,
        existingRange.end,
        incomingRange.start,
        incomingRange.end,
      )
      if (!overlap) {
        nextKept.push(existing)
        continue
      }
      warnings.push({
        message: replacementMessage(incoming, existing, overlap.start, overlap.end),
        overlapStart: overlap.start,
        overlapEnd: overlap.end,
        winnerId: incoming.id,
        loserId: existing.id,
      })
      nextKept.push(...subtractStayRange(existing, incomingRange.start, incomingRange.end))
    }
    nextKept.push(incoming)
    kept = nextKept
  }

  return { accommodations: [...empty, ...kept], warnings }
}

/**
 * Prévia das substituições sem mutar a lista (mesma regra do resolve).
 */
export function previewAccommodationReplacements(accommodations, options = {}) {
  return resolveAccommodationDayOverlaps(accommodations, options).warnings
}

/**
 * @returns {{ message: string, iso?: string, conflictingStay?: Record<string, unknown> } | null}
 */
export function findAccommodationDayConflict(accommodations) {
  const dayToStay = new Map()
  const filled = (accommodations || []).filter(stayHasContent)
  for (const a of filled) {
    const start = toIsoCalendarPrefix(a.checkIn ?? a.check_in)
    const end = toIsoCalendarPrefix(a.checkOut ?? a.check_out)
    if (start && end && start > end) {
      return {
        message: 'Check-out deve ser no mesmo dia ou depois do check-in',
      }
    }
    for (const iso of occupiedStayDays(a)) {
      if (dayToStay.has(iso)) {
        const conflictingStay = dayToStay.get(iso)
        return {
          message: replacementMessage(a, conflictingStay, iso, iso),
          iso,
          conflictingStay,
        }
      }
      dayToStay.set(iso, a)
    }
  }
  return null
}

/** Após resolve, deve retornar null. Mantido como rede de segurança. */
export function validateOneAccommodationPerDay(accommodations) {
  const invalid = findAccommodationDayConflict(accommodations)
  if (invalid && !invalid.iso) return invalid.message
  if (invalid) {
    return `Ainda há sobreposição de hospedagens em ${formatStayDayPt(invalid.iso)}.`
  }
  return null
}

/**
 * Primeira janela livre no destino (dias consecutivos sem outra hospedagem).
 * @returns {{ checkIn: string, checkOut: string } | null}
 */
export function suggestFreeStayWindow(dest, accommodations, preferredIso) {
  const occupied = occupiedStayDaySet(accommodations)
  const startBound = toIsoCalendarPrefix(dest?.arrivalDate ?? dest?.arrival_date)
  const endBound = toIsoCalendarPrefix(dest?.departureDate ?? dest?.departure_date)
  if (!startBound || !endBound || startBound > endBound) return null

  const isFree = (iso) => iso >= startBound && iso <= endBound && !occupied.has(iso)
  const preferred = toIsoCalendarPrefix(preferredIso)

  let start = preferred && isFree(preferred) ? preferred : null
  if (!start) {
    let cur = startBound
    while (cur && cur <= endBound) {
      if (isFree(cur)) {
        start = cur
        break
      }
      cur = addDaysIso(cur, 1)
    }
  }
  if (!start) return null

  let end = start
  let next = addDaysIso(end, 1)
  while (next && next <= endBound && isFree(next)) {
    end = next
    next = addDaysIso(end, 1)
  }
  return { checkIn: start, checkOut: end }
}

/**
 * Janela sugerida para nova hospedagem — livre se possível; senão o intervalo do destino
 * (conflitos serão resolvidos por substituição).
 */
export function suggestStayWindowAllowingOverlap(dest, accommodations, preferredIso) {
  const free = suggestFreeStayWindow(dest, accommodations, preferredIso)
  if (free) return free
  const startBound = toIsoCalendarPrefix(dest?.arrivalDate ?? dest?.arrival_date)
  const endBound = toIsoCalendarPrefix(dest?.departureDate ?? dest?.departure_date)
  if (!startBound || !endBound || startBound > endBound) return null
  const preferred = toIsoCalendarPrefix(preferredIso)
  if (preferred && preferred >= startBound && preferred <= endBound) {
    return { checkIn: preferred, checkOut: preferred }
  }
  return { checkIn: startBound, checkOut: endBound }
}

export function destinationHasFreeStayDay(dest, accommodations) {
  return Boolean(suggestFreeStayWindow(dest, accommodations))
}

export function tripHasFreeStayDay(destinations, accommodations) {
  return (destinations || []).some((dest) => destinationHasFreeStayDay(dest, accommodations))
}

function stayFingerprint(acc) {
  if (!acc) return ''
  const checkIn = toIsoCalendarPrefix(acc.checkIn ?? acc.check_in) || ''
  const checkOut = toIsoCalendarPrefix(acc.checkOut ?? acc.check_out) || ''
  const dest = String(acc.destinationId || acc.destination_id || '')
  const name = String(acc.name || '').trim()
  const address = String(acc.address || '').trim()
  const lat = acc.coordinates?.latitude ?? acc.latitude ?? ''
  const lng = acc.coordinates?.longitude ?? acc.longitude ?? ''
  return `${dest}|${checkIn}|${checkOut}|${name}|${address}|${lat}|${lng}`
}

/**
 * Identifica a hospedagem adicionada ou materialmente alterada entre duas listas.
 * @returns {Record<string, unknown> | null}
 */
export function findChangedAccommodation(previous, next) {
  const prevList = previous || []
  const nextList = next || []
  const prevById = new Map(prevList.map((a) => [String(a.id), a]))

  for (const a of nextList) {
    if (a?.id == null) continue
    if (!prevById.has(String(a.id))) return a
  }

  for (const a of nextList) {
    if (a?.id == null) continue
    const p = prevById.get(String(a.id))
    if (p && stayFingerprint(p) !== stayFingerprint(a)) return a
  }

  const nextIds = new Set(nextList.map((a) => String(a.id)))
  for (const p of prevList) {
    if (p?.id != null && !nextIds.has(String(p.id))) {
      return nextList[nextList.length - 1] || null
    }
  }

  return null
}

export function accommodationNeedsReorganize(previous, changed) {
  if (!changed) return false
  const prev = (previous || []).find((a) => String(a.id) === String(changed.id))
  if (!prev) return true
  const prevIn = toIsoCalendarPrefix(prev.checkIn ?? prev.check_in)
  const prevOut = toIsoCalendarPrefix(prev.checkOut ?? prev.check_out)
  const nextIn = toIsoCalendarPrefix(changed.checkIn ?? changed.check_in)
  const nextOut = toIsoCalendarPrefix(changed.checkOut ?? changed.check_out)
  if (prevIn !== nextIn || prevOut !== nextOut) return true
  const prevLat = prev.coordinates?.latitude ?? prev.latitude
  const prevLng = prev.coordinates?.longitude ?? prev.longitude
  const nextLat = changed.coordinates?.latitude ?? changed.latitude
  const nextLng = changed.coordinates?.longitude ?? changed.longitude
  return String(prevLat) !== String(nextLat) || String(prevLng) !== String(nextLng)
}
