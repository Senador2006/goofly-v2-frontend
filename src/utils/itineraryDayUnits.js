/**
 * Unidades editáveis do dia: cada parada é uma unidade; cada bloco de refeição
 * (N opções no mesmo slot) é uma única unidade.
 */

import {
  assignActivityToDay,
  getActivityDayNumber,
  sortDayActivities,
} from './itineraryDayHelpers.js'
import {
  getMealSlotGroupKey,
  getMealSlotStableId,
  isMealRecommendationActivity,
  MAX_MEAL_SLOT_OPTIONS,
  resolveMealActivityId,
} from './itineraryMealHelpers.js'

/**
 * @param {Record<string, unknown>} act
 * @param {number} [idx]
 */
function activityIdOf(act, idx = 0) {
  return resolveMealActivityId(act, idx)
}

/**
 * @typedef {{ type: 'activity', id: string, act: Record<string, unknown> }} ActivityEditUnit
 * @typedef {{
 *   type: 'mealSlot',
 *   slotId: string,
 *   mealType: string,
 *   ids: string[],
 *   options: Record<string, unknown>[],
 * }} MealSlotEditUnit
 * @typedef {ActivityEditUnit | MealSlotEditUnit} DayEditUnit
 */

/**
 * @param {DayEditUnit} unit
 * @returns {string}
 */
export function getUnitDragId(unit) {
  if (!unit) return ''
  return unit.type === 'mealSlot' ? String(unit.slotId) : String(unit.id)
}

/**
 * @param {any[]} sortedDayActivities
 * @param {number} [dayNum]
 * @returns {DayEditUnit[]}
 */
export function buildDayEditUnits(sortedDayActivities, dayNum = 1) {
  /** @type {DayEditUnit[]} */
  const units = []
  const list = Array.isArray(sortedDayActivities) ? sortedDayActivities : []
  const day = Math.max(1, Math.floor(Number(dayNum) || 1))
  let i = 0

  while (i < list.length) {
    const act = list[i]
    if (!isMealRecommendationActivity(act)) {
      units.push({
        type: 'activity',
        id: activityIdOf(act, i),
        act,
      })
      i += 1
      continue
    }

    const groupKey = getMealSlotGroupKey(act)
    /** @type {Record<string, unknown>[]} */
    const options = [act]
    i += 1
    while (
      i < list.length &&
      isMealRecommendationActivity(list[i]) &&
      getMealSlotGroupKey(list[i]) === groupKey
    ) {
      options.push(list[i])
      i += 1
    }

    const mealType =
      String(act.mealType ?? act.meal_type ?? groupKey ?? 'lunch')
        .toLowerCase()
        .trim() || 'lunch'
    const ids = options.map((opt, idx) => activityIdOf(opt, idx))
    units.push({
      type: 'mealSlot',
      slotId: getMealSlotStableId(day, mealType, ids),
      mealType,
      ids,
      options,
    })
  }

  return units
}

/**
 * @param {any[]} all
 * @param {Map<string, number>} dateToDayMap
 * @param {number} dayNum
 */
function daySorted(all, dateToDayMap, dayNum) {
  return sortDayActivities(
    (all || []).filter((a) => getActivityDayNumber(a, dateToDayMap) === dayNum),
  )
}

/**
 * @param {DayEditUnit[]} units
 * @returns {Map<string, number>}
 */
export function expandUnitsToOrderById(units) {
  /** @type {Map<string, number>} */
  const orderById = new Map()
  let order = 0
  for (const unit of units || []) {
    if (unit.type === 'activity') {
      orderById.set(String(unit.id), order)
      order += 1
    } else {
      for (const id of unit.ids || []) {
        orderById.set(String(id), order)
        order += 1
      }
    }
  }
  return orderById
}

/**
 * @param {any[]} all
 * @param {Map<string, number>} dateToDayMap
 * @param {number} dayNum
 * @param {Map<string, number>} orderById
 */
function applyDayOrder(all, dateToDayMap, dayNum, orderById) {
  return all.map((a) => {
    if (getActivityDayNumber(a, dateToDayMap) !== dayNum) return a
    const nextOrder = orderById.get(activityIdOf(a))
    return nextOrder != null ? { ...a, order: nextOrder } : a
  })
}

/**
 * Localiza o índice da unidade que contém `unitOrActivityId` (activity id ou slotId).
 * @param {DayEditUnit[]} units
 * @param {string | number} unitOrActivityId
 */
export function findUnitIndex(units, unitOrActivityId) {
  const key = String(unitOrActivityId)
  return (units || []).findIndex((unit) => {
    if (getUnitDragId(unit) === key) return true
    if (unit.type === 'activity') return String(unit.id) === key
    return (unit.ids || []).some((id) => String(id) === key)
  })
}

/**
 * @param {DayEditUnit[]} units
 * @param {string | number} unitOrActivityId
 * @returns {DayEditUnit | null}
 */
export function findUnit(units, unitOrActivityId) {
  const idx = findUnitIndex(units, unitOrActivityId)
  return idx >= 0 ? units[idx] : null
}

/**
 * Troca uma unidade com a vizinha e reindexa `order` expandindo o slot.
 *
 * @param {any[]} all
 * @param {Map<string, number>} dateToDayMap
 * @param {number} dayNum
 * @param {string | number} unitOrActivityId
 * @param {-1 | 1} direction
 */
export function reorderUnitInSameDay(
  all,
  dateToDayMap,
  dayNum,
  unitOrActivityId,
  direction,
) {
  const onDay = daySorted(all, dateToDayMap, dayNum)
  const units = buildDayEditUnits(onDay, dayNum)
  const index = findUnitIndex(units, unitOrActivityId)
  if (index < 0) return all

  const swapIdx = index + direction
  if (swapIdx < 0 || swapIdx >= units.length) return all

  ;[units[index], units[swapIdx]] = [units[swapIdx], units[index]]
  return applyDayOrder(all, dateToDayMap, dayNum, expandUnitsToOrderById(units))
}

/**
 * Move uma unidade para um índice de unidade e reindexa `order`.
 *
 * @param {any[]} all
 * @param {Map<string, number>} dateToDayMap
 * @param {number} dayNum
 * @param {string | number} unitOrActivityId
 * @param {number} toUnitIndex
 */
export function moveUnitToIndexInSameDay(
  all,
  dateToDayMap,
  dayNum,
  unitOrActivityId,
  toUnitIndex,
) {
  const onDay = daySorted(all, dateToDayMap, dayNum)
  const units = buildDayEditUnits(onDay, dayNum)
  const fromIndex = findUnitIndex(units, unitOrActivityId)
  if (fromIndex < 0) return all

  const clampedTo = Math.max(
    0,
    Math.min(Math.floor(Number(toUnitIndex) || 0), units.length - 1),
  )
  if (fromIndex === clampedTo) return all

  const [moved] = units.splice(fromIndex, 1)
  units.splice(clampedTo, 0, moved)
  return applyDayOrder(all, dateToDayMap, dayNum, expandUnitsToOrderById(units))
}

/**
 * Remove o bloco de refeição inteiro (todas as opções) ou uma parada.
 * Blocos de refeição **não** são removidos por esta API — use
 * `removeMealOptionFromSlot` para opções individuais.
 *
 * @param {any[]} all
 * @param {Map<string, number>} dateToDayMap
 * @param {number} dayNum
 * @param {string | number} unitOrActivityId
 */
export function removeDayUnit(all, dateToDayMap, dayNum, unitOrActivityId) {
  if (!Array.isArray(all)) return all
  const onDay = daySorted(all, dateToDayMap, dayNum)
  const units = buildDayEditUnits(onDay, dayNum)
  const unit = findUnit(units, unitOrActivityId)
  if (!unit) {
    const key = String(unitOrActivityId)
    return all.filter((a) => activityIdOf(a) !== key)
  }

  // Bloco de refeição é permanente no dia — não excluir o slot inteiro.
  if (unit.type === 'mealSlot') return all

  /** @type {Set<string>} */
  const removeIds = new Set([String(unit.id)])
  const next = all.filter((a) => !removeIds.has(activityIdOf(a)))
  const remainingDay = daySorted(next, dateToDayMap, dayNum)
  const remainingUnits = buildDayEditUnits(remainingDay, dayNum)
  return applyDayOrder(
    next,
    dateToDayMap,
    dayNum,
    expandUnitsToOrderById(remainingUnits),
  )
}

/**
 * Remove uma opção (restaurante) de um bloco de refeição.
 * Mantém pelo menos 1 opção no slot.
 *
 * @param {any[]} all
 * @param {Map<string, number>} dateToDayMap
 * @param {number} dayNum
 * @param {string | number} slotIdOrAnyOptionId
 * @param {string | number} optionId
 */
export function removeMealOptionFromSlot(
  all,
  dateToDayMap,
  dayNum,
  slotIdOrAnyOptionId,
  optionId,
) {
  if (!Array.isArray(all)) return all
  const onDay = daySorted(all, dateToDayMap, dayNum)
  const units = buildDayEditUnits(onDay, dayNum)
  const unit = findUnit(units, slotIdOrAnyOptionId)
  if (!unit || unit.type !== 'mealSlot') return all
  if ((unit.ids || []).length <= 1) return all

  const optKey = String(optionId)
  if (!unit.ids.some((id) => String(id) === optKey)) return all

  const next = all.filter((a) => activityIdOf(a) !== optKey)
  const remainingDay = daySorted(next, dateToDayMap, dayNum)
  return applyDayOrder(
    next,
    dateToDayMap,
    dayNum,
    expandUnitsToOrderById(buildDayEditUnits(remainingDay, dayNum)),
  )
}

/**
 * Adiciona uma opção de restaurante ao bloco (máx. MAX_MEAL_SLOT_OPTIONS).
 *
 * @param {any[]} all
 * @param {Map<string, number>} dateToDayMap
 * @param {number} dayNum
 * @param {string | number} slotIdOrAnyOptionId
 * @param {Record<string, unknown>} placeFields
 */
export function addMealOptionToSlot(
  all,
  dateToDayMap,
  dayNum,
  slotIdOrAnyOptionId,
  placeFields,
) {
  if (!Array.isArray(all) || !placeFields || typeof placeFields !== 'object') {
    return all
  }
  const onDay = daySorted(all, dateToDayMap, dayNum)
  const units = buildDayEditUnits(onDay, dayNum)
  const unit = findUnit(units, slotIdOrAnyOptionId)
  if (!unit || unit.type !== 'mealSlot') return all
  if ((unit.ids || []).length >= MAX_MEAL_SLOT_OPTIONS) return all

  /** @type {Map<string, Record<string, unknown>>} */
  const byId = new Map(onDay.map((a) => [activityIdOf(a), a]))
  const primary = resolveUnitPrimaryActivity(unit, byId)
  if (!primary) return all

  const newId =
    globalThis.crypto?.randomUUID?.() ||
    `meal-${Date.now()}-${Math.random().toString(16).slice(2)}`

  const name = String(
    placeFields.name || placeFields.title || placeFields.placeName || '',
  ).trim()
  if (!name) return all

  const start =
    primary.startTime || primary.start_time || primary.time || '12:30'
  const end = primary.endTime || primary.end_time || ''
  const duration =
    primary.duration_minutes ?? primary.durationMinutes ?? undefined

  /** @type {Record<string, unknown>} */
  const newAct = {
    ...placeFields,
    id: newId,
    title: name,
    name,
    placeName: name,
    category: placeFields.category || 'food',
    isMealRecommendation: true,
    mealType: unit.mealType,
    meal_type: unit.mealType,
    day: dayNum,
    dayNumber: dayNum,
    day_number: dayNum,
    startTime: start,
    start_time: start,
    time: start,
    source: 'user_edit',
  }
  if (end) {
    newAct.endTime = end
    newAct.end_time = end
  }
  if (duration != null) {
    newAct.duration_minutes = duration
    newAct.durationMinutes = duration
  }
  if (primary.dayDate) newAct.dayDate = primary.dayDate
  if (primary.canonicalDate) newAct.canonicalDate = primary.canonicalDate

  // Reconstruir o dia a partir das unidades, inserindo a nova opção no slot
  // (evita sortDayActivities empurrar item sem `order` para o fim do dia).
  /** @type {Record<string, unknown>[]} */
  const nextDayFlat = []
  for (const u of units) {
    if (u.type === 'activity') {
      const act = byId.get(String(u.id))
      if (act) nextDayFlat.push(act)
      continue
    }
    for (const id of u.ids || []) {
      const act = byId.get(String(id))
      if (act) nextDayFlat.push(act)
    }
    if (getUnitDragId(u) === getUnitDragId(unit)) {
      nextDayFlat.push(newAct)
    }
  }

  const others = all.filter(
    (a) => getActivityDayNumber(a, dateToDayMap) !== dayNum,
  )
  const next = [...others, ...nextDayFlat]
  return applyDayOrder(
    next,
    dateToDayMap,
    dayNum,
    expandUnitsToOrderById(buildDayEditUnits(nextDayFlat, dayNum)),
  )
}

/**
 * Move uma unidade (parada ou slot de refeição) para outro dia.
 *
 * @param {any[]} all
 * @param {Map<string, number>} dateToDayMap
 * @param {number} fromDay
 * @param {string | number} unitOrActivityId
 * @param {number} toDay
 */
export function assignDayUnitToDay(
  all,
  dateToDayMap,
  fromDay,
  unitOrActivityId,
  toDay,
) {
  if (!Array.isArray(all)) return all
  const targetDay = Math.floor(Number(toDay))
  if (!Number.isFinite(targetDay) || targetDay < 1) return all

  const onDay = daySorted(all, dateToDayMap, fromDay)
  const units = buildDayEditUnits(onDay, fromDay)
  const unit = findUnit(units, unitOrActivityId)
  if (!unit) return all

  /** @type {Set<string>} */
  const moveIds = new Set(
    unit.type === 'mealSlot' ? unit.ids.map(String) : [String(unit.id)],
  )

  const moved = all.map((a) => {
    if (!moveIds.has(activityIdOf(a))) return a
    return assignActivityToDay(a, targetDay, dateToDayMap)
  })

  const fromRemaining = daySorted(moved, dateToDayMap, fromDay)
  const toSorted = daySorted(moved, dateToDayMap, targetDay)
  let next = applyDayOrder(
    moved,
    dateToDayMap,
    fromDay,
    expandUnitsToOrderById(buildDayEditUnits(fromRemaining, fromDay)),
  )
  next = applyDayOrder(
    next,
    dateToDayMap,
    targetDay,
    expandUnitsToOrderById(buildDayEditUnits(toSorted, targetDay)),
  )
  return next
}

/**
 * Primeira activity de uma unidade (para horário/duração).
 * @param {DayEditUnit} unit
 * @param {Map<string, Record<string, unknown>>} byId
 */
export function resolveUnitPrimaryActivity(unit, byId) {
  if (!unit) return null
  if (unit.type === 'activity') {
    return byId.get(String(unit.id)) ?? unit.act ?? null
  }
  for (const id of unit.ids || []) {
    const act = byId.get(String(id))
    if (act) return act
  }
  return unit.options?.[0] ?? null
}

/**
 * Todos os activity ids de uma unidade.
 * @param {DayEditUnit} unit
 * @returns {string[]}
 */
export function getUnitActivityIds(unit) {
  if (!unit) return []
  if (unit.type === 'activity') return [String(unit.id)]
  return (unit.ids || []).map(String)
}

export { getMealSlotGroupKey, getMealSlotStableId, MAX_MEAL_SLOT_OPTIONS }
