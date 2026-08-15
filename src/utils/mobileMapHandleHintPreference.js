export const MOBILE_MAP_HANDLE_HINT_DISMISSED_KEY = 'goofly.mobileMapHandleHintDismissed'

/** @returns {boolean} */
export function readMobileMapHandleHintDismissed() {
  try {
    return localStorage.getItem(MOBILE_MAP_HANDLE_HINT_DISMISSED_KEY) === 'true'
  } catch {
    return false
  }
}

/** @param {boolean} value */
export function writeMobileMapHandleHintDismissed(value) {
  try {
    localStorage.setItem(MOBILE_MAP_HANDLE_HINT_DISMISSED_KEY, value ? 'true' : 'false')
  } catch {
    /* storage indisponível */
  }
}
