/**
 * Contrato de horários do roteiro: a atividade editada é prioritária (duração pode mudar);
 * as demais do mesmo dia deslocam em bloco preservando duração e gaps.
 */

import {
  getActivityDayNumber,
  sortDayActivities,
} from './itineraryDayHelpers.js'
import { minutesBetweenStarts } from './formatActivityDuration.js'

const DAY_MINUTES = 24 * 60
const DEFAULT_DURATION_MINUTES = 120

const TIME_PATCH_KEYS = new Set([
  'startTime',
  'start_time',
  'time',
  'endTime',
  'end_time',
])

/**
 * @param {unknown} patch
 * @returns {boolean}
 */
export function isScheduleTimePatch(patch) {
  if (!patch || typeof patch !== 'object') return false
  return Object.keys(patch).some((k) => TIME_PATCH_KEYS.has(k))
}

/**
 * @param {unknown} raw
 * @returns {number | null} minutos desde meia-noite
 */
export function parseTimeToMinutes(raw) {
  if (raw == null || raw === '') return null
  const m = /^(\d{1,2}):(\d{2})/.exec(String(raw).trim())
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (![h, min].every(Number.isFinite)) return null
  if (h < 0 || h > 23 || min < 0 || min > 59) return null
  return h * 60 + min
}

/**
 * Normaliza minutos para [0, 24h) (convenção do backend).
 * @param {number} totalMins
 * @returns {number}
 */
export function normalizeDayMinutes(totalMins) {
  const n = Math.round(Number(totalMins))
  if (!Number.isFinite(n)) return 0
  return ((n % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES
}

/**
 * @param {number} totalMins
 * @returns {string} HH:mm
 */
export function minutesToTime(totalMins) {
  const n = normalizeDayMinutes(totalMins)
  const h = Math.floor(n / 60)
  const m = n % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/**
 * @param {number} startMins
 * @param {number} durationMins
 * @returns {string}
 */
export function endFromStartAndDuration(startMins, durationMins) {
  return minutesToTime(startMins + Number(durationMins))
}

/**
 * @param {Record<string, unknown>} act
 * @returns {string}
 */
function readStartRaw(act) {
  return act?.startTime || act?.start_time || act?.time || '09:00'
}

/**
 * @param {Record<string, unknown>} act
 * @returns {string}
 */
function readEndRaw(act) {
  const e = act?.endTime ?? act?.end_time
  return typeof e === 'string' ? e.trim() : ''
}

/**
 * @param {Record<string, unknown>} act
 * @returns {number}
 */
export function resolveActivityDurationMinutes(act) {
  const start = parseTimeToMinutes(readStartRaw(act))
  const endRaw = readEndRaw(act)
  const end = endRaw ? parseTimeToMinutes(endRaw) : null
  if (start != null && end != null) {
    const window = minutesBetweenStarts(minutesToTime(start), minutesToTime(end))
    if (window != null) return window
  }
  const stored = Number(act?.duration_minutes ?? act?.durationMinutes)
  if (Number.isFinite(stored) && stored > 0) return Math.round(stored)
  return DEFAULT_DURATION_MINUTES
}

/**
 * @param {Record<string, unknown>} act
 * @param {string} start
 * @param {string | null} end
 * @param {number} [durationMinutes]
 * @returns {Record<string, unknown>}
 */
function writeScheduleFields(act, start, end, durationMinutes) {
  const out = {
    ...act,
    startTime: start,
    start_time: start,
    time: start,
  }
  if (end) {
    out.endTime = end
    out.end_time = end
  } else {
    out.endTime = ''
    out.end_time = ''
  }
  if (durationMinutes != null && Number.isFinite(durationMinutes) && durationMinutes > 0) {
    out.duration_minutes = durationMinutes
    out.durationMinutes = durationMinutes
  }
  return out
}

/**
 * Aplica edição de horário em uma atividade do dia e realinha as demais
 * preservando gaps e durações (exceto a editada).
 *
 * @param {unknown[]} allActivities
 * @param {Map<string, number>} dateToDayMap
 * @param {number} dayNum
 * @param {string | number} editedId
 * @param {Record<string, unknown>} patch
 * @returns {unknown[]}
 */
export function applyRoteiroScheduleEdit(
  allActivities,
  dateToDayMap,
  dayNum,
  editedId,
  patch,
) {
  if (!Array.isArray(allActivities) || !isScheduleTimePatch(patch)) {
    return allActivities
  }

  const onDay = sortDayActivities(
    allActivities.filter((a) => getActivityDayNumber(a, dateToDayMap) === dayNum),
  )
  const k = onDay.findIndex((a) => String(a.id) === String(editedId))
  if (k < 0) return allActivities

  const n = onDay.length
  const starts = onDay.map((a) => parseTimeToMinutes(readStartRaw(a)) ?? 9 * 60)
  const durations = onDay.map((a) => resolveActivityDurationMinutes(a))
  const endsResolved = starts.map((s, i) => s + durations[i])

  /** @type {number[]} */
  const gaps = []
  for (let i = 0; i < n - 1; i += 1) {
    gaps.push(Math.max(0, starts[i + 1] - endsResolved[i]))
  }

  const merged = { ...onDay[k], ...patch }

  const patchHasStart =
    Object.prototype.hasOwnProperty.call(patch, 'startTime') ||
    Object.prototype.hasOwnProperty.call(patch, 'start_time') ||
    Object.prototype.hasOwnProperty.call(patch, 'time')
  const patchHasEnd =
    Object.prototype.hasOwnProperty.call(patch, 'endTime') ||
    Object.prototype.hasOwnProperty.call(patch, 'end_time')

  let startK = patchHasStart
    ? parseTimeToMinutes(readStartRaw(merged))
    : starts[k]
  if (startK == null) startK = starts[k]

  let endK
  /** Se true, a editada fica sem fim explícito (âncora usa duração). */
  let clearEndOnEdited = false
  if (patchHasEnd) {
    const endRaw = readEndRaw(merged)
    if (!endRaw) {
      endK = startK + durations[k]
      clearEndOnEdited = true
    } else {
      const parsedEnd = parseTimeToMinutes(endRaw)
      if (parsedEnd == null) {
        return allActivities
      }
      endK = parsedEnd
    }
  } else {
    // Só início: se havia fim explícito, mantém o fim absoluto (duração muda);
    // se não, desloca o bloco com duração snapshot.
    const prevEndRaw = readEndRaw(onDay[k])
    if (prevEndRaw && parseTimeToMinutes(prevEndRaw) != null) {
      endK = parseTimeToMinutes(prevEndRaw)
    } else {
      endK = startK + durations[k]
      clearEndOnEdited = !prevEndRaw
    }
  }

  if (!(endK > startK)) {
    // Janela inválida: não aplica
    return allActivities
  }

  const durationK = endK - startK

  /** @type {{ start: number, end: number, duration: number }[]} */
  const layout = Array.from({ length: n }, (_, i) => ({
    start: starts[i],
    end: endsResolved[i],
    duration: durations[i],
  }))
  layout[k] = { start: startK, end: endK, duration: durationK }

  for (let i = k + 1; i < n; i += 1) {
    const start = layout[i - 1].end + gaps[i - 1]
    const duration = durations[i]
    layout[i] = { start, end: start + duration, duration }
  }

  for (let i = k - 1; i >= 0; i -= 1) {
    const end = layout[i + 1].start - gaps[i]
    const duration = durations[i]
    layout[i] = { start: end - duration, end, duration }
  }

  const updatedById = new Map()
  for (let i = 0; i < n; i += 1) {
    const startStr = minutesToTime(layout[i].start)
    const endStr = minutesToTime(layout[i].end)
    const base = i === k ? merged : onDay[i]
    const writeEnd = i === k && clearEndOnEdited ? null : endStr
    updatedById.set(
      String(onDay[i].id),
      writeScheduleFields(base, startStr, writeEnd, layout[i].duration),
    )
  }

  return allActivities.map((a) => {
    if (getActivityDayNumber(a, dateToDayMap) !== dayNum) return a
    const next = updatedById.get(String(a.id))
    return next ?? a
  })
}

/**
 * @typedef {{ anchorStart: number, gaps: number[], durationById: Map<string, number> }} DayScheduleSnapshot
 */

/**
 * Snapshot de âncora, gaps posicionais e durações do dia (ordem atual).
 *
 * @param {unknown[]} allActivities
 * @param {Map<string, number>} dateToDayMap
 * @param {number} dayNum
 * @returns {DayScheduleSnapshot | null}
 */
export function snapshotDaySchedule(allActivities, dateToDayMap, dayNum) {
  if (!Array.isArray(allActivities)) return null
  const onDay = sortDayActivities(
    allActivities.filter((a) => getActivityDayNumber(a, dateToDayMap) === dayNum),
  )
  if (onDay.length === 0) return null

  const starts = onDay.map((a) => parseTimeToMinutes(readStartRaw(a)) ?? 9 * 60)
  const durations = onDay.map((a) => resolveActivityDurationMinutes(a))
  const endsResolved = starts.map((s, i) => s + durations[i])

  /** @type {number[]} */
  const gaps = []
  for (let i = 0; i < onDay.length - 1; i += 1) {
    gaps.push(Math.max(0, starts[i + 1] - endsResolved[i]))
  }

  /** @type {Map<string, number>} */
  const durationById = new Map()
  for (let i = 0; i < onDay.length; i += 1) {
    durationById.set(String(onDay[i].id), durations[i])
  }

  return {
    anchorStart: starts[0],
    gaps,
    durationById,
  }
}

/**
 * Realinha horários do dia na ordem dada, usando snapshot (âncora + gaps + durações).
 *
 * @param {unknown[]} allActivities
 * @param {Map<string, number>} dateToDayMap
 * @param {number} dayNum
 * @param {Array<string | number>} orderedIds
 * @param {DayScheduleSnapshot} snapshot
 * @returns {unknown[]}
 */
export function relayoutDaySchedule(
  allActivities,
  dateToDayMap,
  dayNum,
  orderedIds,
  snapshot,
) {
  if (!Array.isArray(allActivities) || !snapshot || !Array.isArray(orderedIds)) {
    return allActivities
  }
  if (orderedIds.length === 0) return allActivities

  const byId = new Map(
    allActivities
      .filter((a) => getActivityDayNumber(a, dateToDayMap) === dayNum)
      .map((a) => [String(a.id), a]),
  )

  /** @type {Map<string, Record<string, unknown>>} */
  const updatedById = new Map()
  let cursor = snapshot.anchorStart

  for (let i = 0; i < orderedIds.length; i += 1) {
    const id = String(orderedIds[i])
    const base = byId.get(id)
    if (!base) continue

    const duration =
      snapshot.durationById.get(id) ?? resolveActivityDurationMinutes(base)
    const start = cursor
    const end = start + duration
    updatedById.set(
      id,
      writeScheduleFields(base, minutesToTime(start), minutesToTime(end), duration),
    )

    if (i < orderedIds.length - 1) {
      const gap = snapshot.gaps[i] ?? 0
      cursor = end + gap
    }
  }

  return allActivities.map((a) => {
    if (getActivityDayNumber(a, dateToDayMap) !== dayNum) return a
    return updatedById.get(String(a.id)) ?? a
  })
}

/**
 * Após mutação de ordem no mesmo dia, realinha horários preservando
 * âncora, gaps posicionais e duração de cada atividade.
 *
 * @param {unknown[]} allActivities
 * @param {Map<string, number>} dateToDayMap
 * @param {number} dayNum
 * @param {(list: unknown[]) => unknown[]} mutateFn
 * @returns {unknown[]}
 */
export function applyRoteiroScheduleReorder(
  allActivities,
  dateToDayMap,
  dayNum,
  mutateFn,
) {
  if (!Array.isArray(allActivities) || typeof mutateFn !== 'function') {
    return allActivities
  }

  const snapshot = snapshotDaySchedule(allActivities, dateToDayMap, dayNum)
  if (!snapshot) return allActivities

  const next = mutateFn(allActivities)
  if (next === allActivities || !Array.isArray(next)) return allActivities

  const orderedIds = sortDayActivities(
    next.filter((a) => getActivityDayNumber(a, dateToDayMap) === dayNum),
  ).map((a) => a.id)

  return relayoutDaySchedule(next, dateToDayMap, dayNum, orderedIds, snapshot)
}
