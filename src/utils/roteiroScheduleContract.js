/**
 * Contrato de horários do roteiro: a unidade editada é prioritária (duração pode mudar);
 * as demais do mesmo dia deslocam em bloco preservando duração e gaps.
 * Blocos de refeição (N opções) contam como uma única unidade de schedule.
 */

import {
  getActivityDayNumber,
  sortDayActivities,
} from './itineraryDayHelpers.js'
import {
  buildDayEditUnits,
  findUnitIndex,
  getUnitActivityIds,
  getUnitDragId,
  resolveUnitPrimaryActivity,
} from './itineraryDayUnits.js'
import { minutesBetweenStarts } from './formatActivityDuration.js'
import { resolveMealActivityId } from './itineraryMealHelpers.js'

const DAY_MINUTES = 24 * 60
const DEFAULT_DURATION_MINUTES = 120
/** Intervalo padrão ao inserir uma atividade no fim do dia (não altera reorder/edit). */
export const INSERT_END_GAP_MINUTES = 15

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
 * @param {any[]} allActivities
 * @param {Map<string, number>} dateToDayMap
 * @param {number} dayNum
 */
function dayContext(allActivities, dateToDayMap, dayNum) {
  const onDay = sortDayActivities(
    (allActivities || []).filter(
      (a) => getActivityDayNumber(a, dateToDayMap) === dayNum,
    ),
  )
  const units = buildDayEditUnits(onDay, dayNum)
  /** @type {Map<string, Record<string, unknown>>} */
  const byId = new Map(
    onDay.map((a) => [String(resolveMealActivityId(a)), a]),
  )
  return { onDay, units, byId }
}

/**
 * Duração da unidade: max das opções (meal) ou duração da parada.
 * @param {import('./itineraryDayUnits.js').DayEditUnit} unit
 * @param {Map<string, Record<string, unknown>>} byId
 */
function resolveUnitDurationMinutes(unit, byId) {
  const ids = getUnitActivityIds(unit)
  let max = 0
  for (const id of ids) {
    const act = byId.get(String(id))
    if (!act) continue
    max = Math.max(max, resolveActivityDurationMinutes(act))
  }
  if (max > 0) return max
  const primary = resolveUnitPrimaryActivity(unit, byId)
  return primary ? resolveActivityDurationMinutes(primary) : DEFAULT_DURATION_MINUTES
}

/**
 * @param {import('./itineraryDayUnits.js').DayEditUnit} unit
 * @param {Map<string, Record<string, unknown>>} byId
 */
function resolveUnitStartMinutes(unit, byId) {
  const primary = resolveUnitPrimaryActivity(unit, byId)
  return parseTimeToMinutes(readStartRaw(primary)) ?? 9 * 60
}

/**
 * Escreve o mesmo horário em todos os activity ids da unidade.
 * @param {Map<string, Record<string, unknown>>} updatedById
 * @param {import('./itineraryDayUnits.js').DayEditUnit} unit
 * @param {Map<string, Record<string, unknown>>} byId
 * @param {string} startStr
 * @param {string | null} endStr
 * @param {number} duration
 * @param {Record<string, unknown> | null} [mergedPrimary]
 */
function writeUnitSchedule(
  updatedById,
  unit,
  byId,
  startStr,
  endStr,
  duration,
  mergedPrimary = null,
) {
  const ids = getUnitActivityIds(unit)
  const primaryId = ids[0]
  for (const id of ids) {
    const base =
      mergedPrimary && String(id) === String(primaryId)
        ? mergedPrimary
        : byId.get(String(id))
    if (!base) continue
    const withPatch =
      mergedPrimary && String(id) !== String(primaryId)
        ? {
            ...base,
            ...Object.fromEntries(
              Object.entries(mergedPrimary).filter(([k]) => TIME_PATCH_KEYS.has(k)),
            ),
          }
        : base
    updatedById.set(
      String(id),
      writeScheduleFields(withPatch, startStr, endStr, duration),
    )
  }
}

/**
 * Aplica edição de horário em uma unidade do dia e realinha as demais
 * preservando gaps e durações (exceto a editada).
 *
 * @param {unknown[]} allActivities
 * @param {Map<string, number>} dateToDayMap
 * @param {number} dayNum
 * @param {string | number} editedId activity id ou slotId
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

  const { units, byId } = dayContext(allActivities, dateToDayMap, dayNum)
  const k = findUnitIndex(units, editedId)
  if (k < 0) return allActivities

  const n = units.length
  const starts = units.map((u) => resolveUnitStartMinutes(u, byId))
  const durations = units.map((u) => resolveUnitDurationMinutes(u, byId))
  const endsResolved = starts.map((s, i) => s + durations[i])

  /** @type {number[]} */
  const gaps = []
  for (let i = 0; i < n - 1; i += 1) {
    gaps.push(Math.max(0, starts[i + 1] - endsResolved[i]))
  }

  const primary = resolveUnitPrimaryActivity(units[k], byId)
  if (!primary) return allActivities
  const merged = { ...primary, ...patch }

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
    const prevEndRaw = readEndRaw(primary)
    if (prevEndRaw && parseTimeToMinutes(prevEndRaw) != null) {
      endK = parseTimeToMinutes(prevEndRaw)
    } else {
      endK = startK + durations[k]
      clearEndOnEdited = !prevEndRaw
    }
  }

  if (!(endK > startK)) {
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

  /** @type {Map<string, Record<string, unknown>>} */
  const updatedById = new Map()
  for (let i = 0; i < n; i += 1) {
    const startStr = minutesToTime(layout[i].start)
    const endStr = minutesToTime(layout[i].end)
    const writeEnd = i === k && clearEndOnEdited ? null : endStr
    writeUnitSchedule(
      updatedById,
      units[i],
      byId,
      startStr,
      writeEnd,
      layout[i].duration,
      i === k ? merged : null,
    )
  }

  return allActivities.map((a) => {
    if (getActivityDayNumber(a, dateToDayMap) !== dayNum) return a
    const next = updatedById.get(String(resolveMealActivityId(a)))
    return next ?? a
  })
}

/**
 * @typedef {{
 *   anchorStart: number,
 *   gaps: number[],
 *   durationByUnitId: Map<string, number>,
 * }} DayScheduleSnapshot
 */

/**
 * Snapshot de âncora, gaps posicionais e durações do dia por unidade.
 *
 * @param {unknown[]} allActivities
 * @param {Map<string, number>} dateToDayMap
 * @param {number} dayNum
 * @returns {DayScheduleSnapshot | null}
 */
export function snapshotDaySchedule(allActivities, dateToDayMap, dayNum) {
  if (!Array.isArray(allActivities)) return null
  const { units, byId } = dayContext(allActivities, dateToDayMap, dayNum)
  if (units.length === 0) return null

  const starts = units.map((u) => resolveUnitStartMinutes(u, byId))
  const durations = units.map((u) => resolveUnitDurationMinutes(u, byId))
  const endsResolved = starts.map((s, i) => s + durations[i])

  /** @type {number[]} */
  const gaps = []
  for (let i = 0; i < units.length - 1; i += 1) {
    gaps.push(Math.max(0, starts[i + 1] - endsResolved[i]))
  }

  /** @type {Map<string, number>} */
  const durationByUnitId = new Map()
  for (let i = 0; i < units.length; i += 1) {
    durationByUnitId.set(getUnitDragId(units[i]), durations[i])
  }

  return {
    anchorStart: starts[0],
    gaps,
    durationByUnitId,
    /** @deprecated alias para testes legados que leem durationById */
    durationById: durationByUnitId,
  }
}

/**
 * Realinha horários do dia na ordem de unidades dada.
 *
 * @param {unknown[]} allActivities
 * @param {Map<string, number>} dateToDayMap
 * @param {number} dayNum
 * @param {Array<string | number>} orderedUnitIds
 * @param {DayScheduleSnapshot} snapshot
 * @returns {unknown[]}
 */
export function relayoutDaySchedule(
  allActivities,
  dateToDayMap,
  dayNum,
  orderedUnitIds,
  snapshot,
) {
  if (!Array.isArray(allActivities) || !snapshot || !Array.isArray(orderedUnitIds)) {
    return allActivities
  }
  if (orderedUnitIds.length === 0) return allActivities

  const { units, byId } = dayContext(allActivities, dateToDayMap, dayNum)
  /** @type {Map<string, (typeof units)[number]>} */
  const unitByDragId = new Map(units.map((u) => [getUnitDragId(u), u]))

  /** @type {Map<string, Record<string, unknown>>} */
  const updatedById = new Map()
  let cursor = snapshot.anchorStart
  const durationMap = snapshot.durationByUnitId ?? snapshot.durationById

  for (let i = 0; i < orderedUnitIds.length; i += 1) {
    const unitKey = String(orderedUnitIds[i])
    const unit = unitByDragId.get(unitKey)
    if (!unit) continue

    const primary = resolveUnitPrimaryActivity(unit, byId)
    const duration =
      durationMap?.get(unitKey) ??
      (primary ? resolveActivityDurationMinutes(primary) : DEFAULT_DURATION_MINUTES)
    const start = cursor
    const end = start + duration
    writeUnitSchedule(
      updatedById,
      unit,
      byId,
      minutesToTime(start),
      minutesToTime(end),
      duration,
    )

    if (i < orderedUnitIds.length - 1) {
      const gap = snapshot.gaps[i] ?? 0
      cursor = end + gap
    }
  }

  return allActivities.map((a) => {
    if (getActivityDayNumber(a, dateToDayMap) !== dayNum) return a
    return updatedById.get(String(resolveMealActivityId(a))) ?? a
  })
}

/**
 * Após mutação de ordem no mesmo dia, realinha horários preservando
 * âncora, gaps posicionais e duração de cada unidade.
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

  const { units } = dayContext(next, dateToDayMap, dayNum)
  const orderedUnitIds = units.map((u) => getUnitDragId(u))

  return relayoutDaySchedule(next, dateToDayMap, dayNum, orderedUnitIds, snapshot)
}

/**
 * Anexa uma atividade no fim do dia com horário após a última unidade.
 * Dia vazio: 09:00. Dia com paradas: fim da última + INSERT_END_GAP_MINUTES.
 *
 * @param {unknown[]} allActivities
 * @param {Map<string, number>} dateToDayMap
 * @param {number} dayNum
 * @param {Record<string, unknown>} newAct
 * @returns {unknown[]}
 */
export function scheduleActivityInsertedAtEnd(
  allActivities,
  dateToDayMap,
  dayNum,
  newAct,
) {
  const list = Array.isArray(allActivities) ? allActivities : []
  if (!newAct || typeof newAct !== 'object') return list

  const day = Math.max(1, Math.floor(Number(dayNum) || 1))
  const { units, byId } = dayContext(list, dateToDayMap, day)

  const duration = resolveActivityDurationMinutes(newAct)
  let startMins = 9 * 60
  if (units.length > 0) {
    const lastUnit = units[units.length - 1]
    const lastStart = resolveUnitStartMinutes(lastUnit, byId)
    startMins =
      lastStart + resolveUnitDurationMinutes(lastUnit, byId) + INSERT_END_GAP_MINUTES
  }

  const start = minutesToTime(startMins)
  const end = endFromStartAndDuration(startMins, duration)
  const scheduled = writeScheduleFields(
    { ...newAct, day, dayNumber: day, order: 999 },
    start,
    end,
    duration,
  )
  return [...list, scheduled]
}
