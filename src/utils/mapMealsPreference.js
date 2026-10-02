export const SHOW_MEALS_ON_MAP_STORAGE_KEY = 'goofly.map.showMealsOnMap'

/** @returns {boolean} */
export function readShowMealsOnMapPreference() {
  try {
    const raw = localStorage.getItem(SHOW_MEALS_ON_MAP_STORAGE_KEY)
    if (raw === 'false') return false
    if (raw === 'true') return true
  } catch {
    /* storage indisponível */
  }
  return true
}

/** @param {boolean} value */
export function writeShowMealsOnMapPreference(value) {
  try {
    localStorage.setItem(SHOW_MEALS_ON_MAP_STORAGE_KEY, value ? 'true' : 'false')
  } catch {
    /* storage indisponível */
  }
}
