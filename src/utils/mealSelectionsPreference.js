const MEAL_SELECTIONS_STORAGE_KEY_PREFIX = 'goofly.map.mealSelections.'

/** @returns {Record<string, string>} */
export function readMealSelectionsPreference(tripId) {
  if (!tripId) return {}
  try {
    const raw = localStorage.getItem(`${MEAL_SELECTIONS_STORAGE_KEY_PREFIX}${tripId}`)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    /** @type {Record<string, string>} */
    const out = {}
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === 'string' && value.trim()) out[key] = value
    }
    return out
  } catch {
    return {}
  }
}

/** @param {Record<string, string>} selections */
export function writeMealSelectionsPreference(tripId, selections) {
  if (!tripId) return
  try {
    localStorage.setItem(
      `${MEAL_SELECTIONS_STORAGE_KEY_PREFIX}${tripId}`,
      JSON.stringify(selections || {}),
    )
  } catch {
    /* storage indisponível */
  }
}
