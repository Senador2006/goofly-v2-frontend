/**
 * Helpers para refeições sugeridas pelo agente otimizador (separadas de `activities[]`).
 */

import { getActivityDayNumber, sortDayActivities } from './itineraryDayHelpers.js'

const MEAL_TYPES = new Set(['breakfast', 'lunch', 'dinner'])

const FOOD_ACTIVITY_CATEGORIES = new Set([
  'food',
  'restaurant',
  'dining',
  'cafe',
  'café',
  'bakery',
  'bar',
])

/** @param {Record<string, unknown> | null | undefined} act */
function inferMealTypeFromFoodActivity(act) {
  if (!act || typeof act !== 'object') return null
  const existing = act.mealType ?? act.meal_type
  if (existing) return String(existing).toLowerCase().trim()

  const cat = String(act.category || '')
    .toLowerCase()
    .trim()
  const name = String(act.name ?? act.title ?? act.placeName ?? '')
  const isFoodCat = FOOD_ACTIVITY_CATEGORIES.has(cat)
  const isFoodName =
    /\b(almoço|almoco|lunch|jantar|dinner|café da manhã|cafe da manha|breakfast|brunch|refeição|refeicao)\b/i.test(
      name,
    )

  if (!isFoodCat && !isFoodName) return null

  if (/\b(breakfast|café da manhã|cafe da manha|brunch)\b/i.test(name)) return 'breakfast'
  if (/\b(lunch|almoço|almoco)\b/i.test(name)) return 'lunch'
  if (/\b(dinner|jantar)\b/i.test(name)) return 'dinner'

  const raw = act.startTime ?? act.start_time ?? act.time ?? act.expectedTime ?? ''
  const m = /^(\d{1,2}):/.exec(String(raw).trim())
  const hour = m ? Number(m[1]) : NaN
  if (Number.isFinite(hour)) {
    if (hour >= 6 && hour < 11) return 'breakfast'
    if (hour >= 11 && hour < 16) return 'lunch'
    if (hour >= 17 && hour < 23) return 'dinner'
  }
  return 'lunch'
}

/** @param {Record<string, unknown> | null | undefined} act */
export function isMealRecommendationActivity(act) {
  if (!act || typeof act !== 'object') return false
  if (act.isMealRecommendation === true) return true
  const mealType = String(act.mealType ?? act.meal_type ?? '')
    .toLowerCase()
    .trim()
  if (MEAL_TYPES.has(mealType)) return true
  return inferMealTypeFromFoodActivity(act) != null
}

/** Paradas que entram na rota do mapa (exclui sugestões de refeição). */
export function filterRouteActivities(activities) {
  return (activities || []).filter((a) => !isMealRecommendationActivity(a))
}

/** @param {Record<string, unknown>} act */
export function getMealSlotKey(act) {
  const mealType = String(
    act.mealType ?? act.meal_type ?? inferMealTypeFromFoodActivity(act) ?? 'meal',
  )
    .toLowerCase()
  const time = String(act.startTime ?? act.start_time ?? act.time ?? act.expectedTime ?? '')
    .trim()
    .slice(0, 5)
  return `${mealType}@${time || '00:00'}`
}

/** @param {string | null | undefined} mealType */
export function getMealTypeLabel(mealType) {
  const m = String(mealType || '')
    .toLowerCase()
    .trim()
  if (m === 'breakfast') return 'Café da manhã'
  if (m === 'lunch') return 'Almoço'
  if (m === 'dinner') return 'Jantar'
  return 'Refeição'
}

/** @param {string | null | undefined} mealType */
export function getMealTypeIcon(mealType) {
  const m = String(mealType || '')
    .toLowerCase()
    .trim()
  if (m === 'breakfast') return 'bakery_dining'
  if (m === 'lunch') return 'lunch_dining'
  if (m === 'dinner') return 'dinner_dining'
  return 'restaurant'
}

/**
 * HTML do pin de refeição no mapa Leaflet — mesmos ícones Material da timeline.
 * @param {string | null | undefined} mealType
 * @param {boolean} [isHighlighted]
 */
export function buildMealMapMarkerHtml(mealType, isHighlighted = false) {
  const size = isHighlighted ? 30 : 26
  const iconName = getMealTypeIcon(mealType)
  const iconSize = isHighlighted ? 16 : 15
  const ring = isHighlighted
    ? '0 0 0 3px #fff, 0 0 0 7px #f59e0b, 0 0 18px 4px rgba(245,158,11,0.85)'
    : '0 0 0 2px #fff, 0 0 0 4px rgba(245,158,11,0.45)'
  return (
    `<div style="width:${size}px;height:${size}px;border-radius:9999px;display:flex;align-items:center;justify-content:center;` +
    `border:2px solid rgba(245,158,11,0.75);background:#fffbeb;color:#b45309;box-shadow:${ring};">` +
    `<span class="material-icons-outlined" style="font-size:${iconSize}px;line-height:1;user-select:none">` +
    iconName +
    '</span></div>'
  )
}

/** @param {string | null | undefined} position */
export function getMealPositionLabel(position) {
  const p = String(position || '')
    .toLowerCase()
    .trim()
  if (p === 'near_previous') return 'Perto da parada anterior'
  if (p === 'on_the_way') return 'No caminho'
  if (p === 'near_next') return 'Perto da próxima parada'
  return null
}

/** @param {string | null | undefined} raw */
export function formatMealTimeLabel(raw) {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(raw || '').trim())
  if (!m) return 'Horário sugerido'
  return `${m[1].padStart(2, '0')}:${m[2]}`
}

/**
 * Agrupa atividades de refeição consecutivas (mesmo slot) e intercala com paradas normais,
 * preservando a ordem de `sortDayActivities`.
 *
 * @param {any[]} sortedActivities
 * @returns {Array<
 *   | { type: 'activity', act: any }
 *   | { type: 'mealSlot', slotKey: string, mealType: string, startTime: string, options: any[] }
 * >}
 */
export function buildDayTimelineItems(sortedActivities) {
  /** @type {ReturnType<typeof buildDayTimelineItems>} */
  const items = []
  const list = Array.isArray(sortedActivities) ? sortedActivities : []
  let i = 0

  while (i < list.length) {
    const act = list[i]
    if (!isMealRecommendationActivity(act)) {
      items.push({ type: 'activity', act })
      i += 1
      continue
    }

    const slotKey = getMealSlotKey(act)
    const options = [act]
    i += 1
    while (
      i < list.length &&
      isMealRecommendationActivity(list[i]) &&
      getMealSlotKey(list[i]) === slotKey
    ) {
      options.push(list[i])
      i += 1
    }

    items.push({
      type: 'mealSlot',
      slotKey,
      mealType:
        act.mealType ||
        act.meal_type ||
        inferMealTypeFromFoodActivity(act) ||
        'lunch',
      startTime:
        act.startTime ||
        act.start_time ||
        act.time ||
        act.expectedTime ||
        act.expected_time ||
        '',
      options,
    })
  }

  return items
}

/** @param {Record<string, unknown>} act @param {number} [idx] */
export function resolveMealActivityId(act, idx = 0) {
  return String(act?.id ?? act?.placeId ?? act?.place_id ?? idx)
}

/**
 * Escolhe a opção padrão de um slot de refeição.
 * @param {Record<string, unknown>[]} options
 */
export function pickPrimaryMealOption(options) {
  const list = Array.isArray(options) ? options : []
  if (list.length === 0) return null
  const positionPriority = { on_the_way: 0, near_previous: 1, near_next: 2 }
  return [...list].sort((a, b) => {
    const pa =
      positionPriority[
        String(a.mealPosition ?? a.meal_position ?? a.position ?? '')
          .toLowerCase()
          .trim()
      ] ?? 9
    const pb =
      positionPriority[
        String(b.mealPosition ?? b.meal_position ?? b.position ?? '')
          .toLowerCase()
          .trim()
      ] ?? 9
    if (pa !== pb) return pa - pb
    const oa = Number(a.order)
    const ob = Number(b.order)
    if (Number.isFinite(oa) && Number.isFinite(ob) && oa !== ob) return oa - ob
    return 0
  })[0]
}

/**
 * @param {Record<string, unknown>[]} options
 * @param {string | null | undefined} selectedId
 */
export function resolveSelectedMealForSlot(options, selectedId) {
  if (!options?.length) return null
  if (selectedId) {
    const found = options.find((o) => resolveMealActivityId(o) === selectedId)
    if (found) return found
  }
  return pickPrimaryMealOption(options)
}

/**
 * Opção primária de cada slot (a que vale no mapa antes de escolha manual).
 * @param {Record<string, unknown>[]} activities
 * @param {Map<string, number>} dateToDayMap
 * @returns {Record<string, string>}
 */
export function buildDefaultMealSelections(activities, dateToDayMap) {
  /** @type {Record<string, string>} */
  const selections = {}
  if (!Array.isArray(activities) || activities.length === 0) return selections

  const dayNumbers = [
    ...new Set(
      activities
        .map((a) => getActivityDayNumber(a, dateToDayMap))
        .filter((d) => d != null),
    ),
  ]

  for (const dayNum of dayNumbers) {
    const dayActs = sortDayActivities(
      activities.filter((a) => getActivityDayNumber(a, dateToDayMap) === dayNum),
    )
    const items = buildDayTimelineItems(dayActs)
    for (const item of items) {
      if (item.type !== 'mealSlot') continue
      const primary = pickPrimaryMealOption(item.options)
      if (primary) selections[item.slotKey] = resolveMealActivityId(primary)
    }
  }

  return selections
}

/**
 * @param {string} slotKey
 * @param {string} activityId
 * @param {Record<string, unknown>[]} activities
 * @param {Map<string, number>} dateToDayMap
 */
export function isMealSelectionValid(slotKey, activityId, activities, dateToDayMap) {
  if (!slotKey || !activityId) return false
  const dayNumbers = [
    ...new Set(
      activities
        .map((a) => getActivityDayNumber(a, dateToDayMap))
        .filter((d) => d != null),
    ),
  ]

  for (const dayNum of dayNumbers) {
    const dayActs = sortDayActivities(
      activities.filter((a) => getActivityDayNumber(a, dateToDayMap) === dayNum),
    )
    const items = buildDayTimelineItems(dayActs)
    for (const item of items) {
      if (item.type !== 'mealSlot' || item.slotKey !== slotKey) continue
      return item.options.some((opt, idx) => resolveMealActivityId(opt, idx) === activityId)
    }
  }

  return false
}

/**
 * Mescla defaults do otimizador com escolhas salvas/sessão (preferência do usuário).
 * @param {Record<string, string>} stored
 * @param {Record<string, unknown>[]} activities
 * @param {Map<string, number>} dateToDayMap
 */
export function mergeMealSelections(stored, activities, dateToDayMap) {
  const defaults = buildDefaultMealSelections(activities, dateToDayMap)
  /** @type {Record<string, string>} */
  const merged = { ...defaults }

  for (const [slotKey, activityId] of Object.entries(stored || {})) {
    if (isMealSelectionValid(slotKey, activityId, activities, dateToDayMap)) {
      merged[slotKey] = activityId
    }
  }

  return merged
}

/**
 * @param {Array<{ slotKey: string, options: Record<string, unknown>[] }>} mealSlots
 * @param {Record<string, string>} [selectedMealIds]
 */
export function buildSelectedMealActivities(mealSlots, selectedMealIds = {}) {
  return (mealSlots || [])
    .map((slot) =>
      resolveSelectedMealForSlot(slot.options, selectedMealIds[slot.slotKey]),
    )
    .filter(Boolean)
}

/**
 * Índices do bloco de refeição (várias opções consecutivas) na ordem do dia.
 * @param {Record<string, unknown>[]} sortedDayActivities
 * @param {Record<string, unknown>} mealAct
 */
function findMealSlotBounds(sortedDayActivities, mealAct) {
  const list = Array.isArray(sortedDayActivities) ? sortedDayActivities : []
  const slotKey = getMealSlotKey(mealAct)
  let start = -1
  let end = -1

  for (let i = 0; i < list.length; i += 1) {
    const act = list[i]
    if (isMealRecommendationActivity(act) && getMealSlotKey(act) === slotKey) {
      if (start < 0) start = i
      end = i
    } else if (start >= 0) {
      break
    }
  }

  if (start < 0) {
    const mealId = resolveMealActivityId(mealAct)
    const idx = list.findIndex((act) => resolveMealActivityId(act) === mealId)
    if (idx >= 0) return { start: idx, end: idx }
  }

  return { start, end }
}

/** @param {Record<string, unknown>[]} sortedDayActivities @param {number} fromIndex @param {'prev' | 'next'} direction */
function findAdjacentRouteActivity(sortedDayActivities, fromIndex, direction) {
  const list = Array.isArray(sortedDayActivities) ? sortedDayActivities : []
  if (direction === 'prev') {
    for (let i = fromIndex - 1; i >= 0; i -= 1) {
      if (!isMealRecommendationActivity(list[i])) return list[i]
    }
    return null
  }
  for (let i = fromIndex + 1; i < list.length; i += 1) {
    if (!isMealRecommendationActivity(list[i])) return list[i]
  }
  return null
}

/**
 * Parada da rota principal prevista para o ramo da refeição no mapa,
 * com base na ordem do roteiro e em `mealPosition` (não proximidade geográfica).
 *
 * @param {Record<string, unknown>[]} sortedDayActivities — dia completo (paradas + refeições), ordenado
 * @param {Record<string, unknown>} mealAct
 */
export function resolveMealRouteAnchor(sortedDayActivities, mealAct) {
  const list = Array.isArray(sortedDayActivities) ? sortedDayActivities : []
  if (list.length === 0 || !mealAct) return null

  const { start, end } = findMealSlotBounds(list, mealAct)
  if (start < 0) return null

  const previous = findAdjacentRouteActivity(list, start, 'prev')
  const next = findAdjacentRouteActivity(list, end, 'next')

  const position = String(
    mealAct?.mealPosition ?? mealAct?.meal_position ?? mealAct?.position ?? 'near_previous',
  )
    .toLowerCase()
    .trim()

  if (position === 'near_next') {
    return next ?? previous
  }
  if (position === 'on_the_way') {
    return previous ?? next
  }
  // near_previous (padrão)
  return previous ?? next
}

/**
 * Agrupa markers de refeição da API — 1 por slot conforme seleção do usuário.
 * @param {Array<Record<string, unknown>>} apiMealMarkers
 * @param {Array<{ slotKey: string, options: Record<string, unknown>[] }>} mealSlots
 * @param {Record<string, string>} [selectedMealIds]
 */
export function resolveVisibleMealMarkers(apiMealMarkers, mealSlots, selectedMealIds = {}) {
  const byActivityId = new Map(
    (apiMealMarkers || []).map((m) => [String(m.activityId ?? ''), m]),
  )
  /** @type {Record<string, unknown>[]} */
  const out = []

  for (const slot of mealSlots || []) {
    const selected = resolveSelectedMealForSlot(slot.options, selectedMealIds[slot.slotKey])
    if (!selected) continue
    const id = resolveMealActivityId(selected)
    const marker = byActivityId.get(id)
    if (marker) {
      out.push({ ...marker, slotKey: slot.slotKey, optionCount: slot.options.length })
    }
  }

  return out
}
