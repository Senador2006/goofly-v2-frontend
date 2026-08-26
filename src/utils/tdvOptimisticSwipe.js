/**
 * Helpers puros para swipe otimista do TDV.
 * O card avança na hora; a API confirma ou faz rollback.
 */

export function getOptimisticPlaceId(place) {
  if (!place || typeof place !== 'object') return null
  const id = place.id ?? place.placeId ?? place.place_id
  if (id == null || String(id).trim() === '') return null
  return String(id).trim()
}

/**
 * Aplica like otimista: remove do deck, adiciona às curtidas e ao undo stack.
 */
export function applyOptimisticLike(state, place, placeId, likeEntry) {
  const pid = String(placeId)
  return {
    places: (state.places || []).filter((x) => getOptimisticPlaceId(x) !== pid),
    likedPlaces: [likeEntry || { placeId: pid, name: place?.name }, ...(state.likedPlaces || [])],
    undoStack: [...(state.undoStack || []), { type: 'like', place: { ...place } }],
    totalLikes:
      typeof state.totalLikes === 'number' ? state.totalLikes + 1 : state.totalLikes,
  }
}

/**
 * Rollback de like otimista após falha da API.
 */
export function rollbackOptimisticLike(state, place, placeId) {
  const pid = String(placeId)
  const undoStack = [...(state.undoStack || [])]
  for (let i = undoStack.length - 1; i >= 0; i -= 1) {
    const e = undoStack[i]
    if (e?.type === 'like' && getOptimisticPlaceId(e.place) === pid) {
      undoStack.splice(i, 1)
      break
    }
  }
  return {
    places: [place, ...(state.places || []).filter((x) => getOptimisticPlaceId(x) !== pid)],
    likedPlaces: (state.likedPlaces || []).filter((p) => String(p.placeId) !== pid),
    undoStack,
    totalLikes:
      typeof state.totalLikes === 'number'
        ? Math.max(0, state.totalLikes - 1)
        : state.totalLikes,
  }
}

/**
 * Aplica dislike otimista.
 */
export function applyOptimisticDislike(state, place, placeId) {
  const pid = String(placeId)
  return {
    places: (state.places || []).filter((x) => getOptimisticPlaceId(x) !== pid),
    dislikedPlaces: [
      { placeId: pid, name: place?.name },
      ...(state.dislikedPlaces || []),
    ],
    undoStack: [...(state.undoStack || []), { type: 'dislike', place: { ...place } }],
  }
}

/**
 * Rollback de dislike otimista após falha da API.
 */
export function rollbackOptimisticDislike(state, place, placeId) {
  const pid = String(placeId)
  const undoStack = [...(state.undoStack || [])]
  for (let i = undoStack.length - 1; i >= 0; i -= 1) {
    const e = undoStack[i]
    if (e?.type === 'dislike' && getOptimisticPlaceId(e.place) === pid) {
      undoStack.splice(i, 1)
      break
    }
  }
  return {
    places: [place, ...(state.places || []).filter((x) => getOptimisticPlaceId(x) !== pid)],
    dislikedPlaces: (state.dislikedPlaces || []).filter((p) => String(p.placeId) !== pid),
    undoStack,
  }
}

/**
 * True se o busy lock deve bloquear um segundo gesto.
 */
export function shouldBlockSwipeGesture(busy) {
  return Boolean(busy)
}
