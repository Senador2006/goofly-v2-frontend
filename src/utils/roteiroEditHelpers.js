export function activityStableId(activity) {
  const id = activity?.id ?? activity?.placeId ?? activity?.place_id
  return id != null && String(id).trim() !== '' ? String(id) : null
}

export function ensureActivitiesHaveStableIds(activities) {
  return activities.map((activity, index) => {
    const id =
      activityStableId(activity) ||
      globalThis.crypto?.randomUUID?.() ||
      `act-${Date.now()}-${index}-${Math.random().toString(16).slice(2)}`
    return { ...activity, id }
  })
}

export function isPendingNewStop(activity) {
  return activity?.source === 'user_edit' && String(activity?.title || '').trim() === 'Nova parada'
}

export function focusStopTitleField(stopId, cardRoot) {
  const tryFocus = () => {
    const byId = document.getElementById(`activity-title-ac-${stopId}`)
    if (byId && typeof byId.focus === 'function') {
      byId.focus()
      return true
    }
    const scoped =
      cardRoot?.querySelector?.('input, textarea, gmp-place-autocomplete, [role="combobox"]') ??
      null
    if (scoped && typeof scoped.focus === 'function') {
      scoped.focus()
      return true
    }
    return false
  }
  requestAnimationFrame(() => {
    tryFocus()
    setTimeout(tryFocus, 80)
  })
}

export function captureDayFrozenLayout(dayActivities, premiumHiddenCount) {
  const indices = {}
  const isLast = {}
  dayActivities.forEach((activity, index) => {
    const id = String(activity.id)
    indices[id] = index
    isLast[id] = index === dayActivities.length - 1 && premiumHiddenCount === 0
  })
  return { indices, isLast }
}
