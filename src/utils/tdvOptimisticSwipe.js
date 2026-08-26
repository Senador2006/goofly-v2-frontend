/**
 * Helpers puros para swipe otimista do TDV.
 * O card avança na hora; a API confirma ou faz rollback.
 */

export function getOptimisticPlaceId(place) {
  if (!place || typeof place !== 'object') return null
  // Mesma ordem que getTdvPlaceId — evita mismatch like/dislike vs undo.
  const id = place.placeId ?? place.place_id ?? place.id
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
 * Aplica undo otimista: recoloca a carta no baralho e reverte like/dislike local.
 */
export function applyOptimisticUndo(state, entry) {
  const place = entry?.place
  const pid = getOptimisticPlaceId(place)
  if (!pid || !entry?.type) return state

  const places = [place, ...(state.places || []).filter((x) => getOptimisticPlaceId(x) !== pid)]
  if (entry.type === 'like') {
    return {
      places,
      likedPlaces: (state.likedPlaces || []).filter((p) => String(p.placeId) !== pid),
      dislikedPlaces: state.dislikedPlaces || [],
      undoStack: state.undoStack || [],
      totalLikes:
        typeof state.totalLikes === 'number'
          ? Math.max(0, state.totalLikes - 1)
          : state.totalLikes,
    }
  }
  return {
    places,
    likedPlaces: state.likedPlaces || [],
    dislikedPlaces: (state.dislikedPlaces || []).filter((p) => String(p.placeId) !== pid),
    undoStack: state.undoStack || [],
    totalLikes: state.totalLikes,
  }
}

/**
 * Rollback de undo otimista: remove a carta do baralho e restaura like/dislike + stack.
 */
export function rollbackOptimisticUndo(state, entry, likeEntry) {
  const place = entry?.place
  const pid = getOptimisticPlaceId(place)
  if (!pid || !entry?.type) return state

  const places = (state.places || []).filter((x) => getOptimisticPlaceId(x) !== pid)
  const undoStack = [...(state.undoStack || []), entry]

  if (entry.type === 'like') {
    return {
      places,
      likedPlaces: [
        likeEntry || { placeId: pid, name: place?.name },
        ...(state.likedPlaces || []).filter((p) => String(p.placeId) !== pid),
      ],
      dislikedPlaces: state.dislikedPlaces || [],
      undoStack,
      totalLikes:
        typeof state.totalLikes === 'number' ? state.totalLikes + 1 : state.totalLikes,
    }
  }
  return {
    places,
    likedPlaces: state.likedPlaces || [],
    dislikedPlaces: [
      { placeId: pid, name: place?.name },
      ...(state.dislikedPlaces || []).filter((p) => String(p.placeId) !== pid),
    ],
    undoStack,
    totalLikes: state.totalLikes,
  }
}

/**
 * True se o busy lock deve bloquear um segundo gesto.
 */
export function shouldBlockSwipeGesture(busy) {
  return Boolean(busy)
}

/** Cooldown curto anti double-tap de like/dislike — não bloqueia undo. */
export const TDV_SWIPE_COOLDOWN_MS = 100

/** Cooldown só contra double-undo. */
export const TDV_UNDO_COOLDOWN_MS = 80

/**
 * Se o swipe ainda está in-flight e o user desfez, a persistência deve
 * cancelar/reconciliar em vez de aplicar rollback de UI.
 */
export function shouldCancelInFlightSwipe(pending, expectedType) {
  if (!pending || pending.cancelled !== true) return false
  if (expectedType && pending.type !== expectedType) return false
  return true
}

/**
 * Undo otimista já restaurou a UI; NOT_LIKED / NOT_DISLIKED = estado já ok no servidor.
 */
export function isBenignUndoPersistError(err) {
  const code =
    err?.response?.data?.error?.code ||
    err?.code ||
    err?.response?.data?.code ||
    null
  return code === 'NOT_LIKED' || code === 'NOT_DISLIKED'
}
