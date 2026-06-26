export const SHOW_ACCOMMODATION_ROUTES_STORAGE_KEY = 'goofly.map.showAccommodationRoutes'

/** @returns {boolean} */
export function readShowAccommodationRoutesPreference() {
  try {
    const raw = localStorage.getItem(SHOW_ACCOMMODATION_ROUTES_STORAGE_KEY)
    if (raw === 'false') return false
    if (raw === 'true') return true
  } catch {
    /* storage indisponível */
  }
  return true
}

/** @param {boolean} value */
export function writeShowAccommodationRoutesPreference(value) {
  try {
    localStorage.setItem(SHOW_ACCOMMODATION_ROUTES_STORAGE_KEY, value ? 'true' : 'false')
  } catch {
    /* storage indisponível */
  }
}
