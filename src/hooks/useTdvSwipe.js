import { useCallback, useEffect, useRef, useState } from 'react'
import { tdvSwipeService } from '../services/tdvSwipeService'
import { buildTdvLikePlaceData } from '../utils/tdvLikePlaceData'
import { getTdvPlaceId, likeEntryFromTdvPlace } from '../utils/tdvLikeEntry'
import {
  applyOptimisticDislike,
  applyOptimisticLike,
  isBenignUndoPersistError,
  rollbackOptimisticDislike,
  rollbackOptimisticLike,
  shouldBlockSwipeGesture,
  shouldCancelInFlightSwipe,
  TDV_SWIPE_COOLDOWN_MS,
  TDV_UNDO_COOLDOWN_MS,
} from '../utils/tdvOptimisticSwipe'
import { getRequestErrorMessage } from '../utils/errors'

function getPlaceId(p) {
  return getTdvPlaceId(p)
}

/**
 * Lock anti double-tap + handlers optimistic de like/dislike/undo do TDV.
 */
export function useTdvSwipe({
  tripId,
  finalizingTdv = false,
  onItineraryUpdate,
  currentPlace,
  totalLikes,
  placesRef,
  setPlaces,
  setLikedPlaces,
  setDislikedPlaces,
  setTotalLikes,
  setCurrentIndex,
  setError,
  setDeckUnavailable,
  sessionDeckBaselineRef,
  consumedSinceSessionRef,
}) {
  const [swipeFeedback, setSwipeFeedback] = useState(null)
  /** Pilha LIFO: desfazer só a última curtida/descarte (espelha o servidor). */
  const [undoStack, setUndoStack] = useState([])
  const [undoNotice, setUndoNotice] = useState(null)
  /** Lock anti double-tap de like/dislike — undo NÃO usa este lock. */
  const swipeLockRef = useRef(false)
  const swipeLockTimerRef = useRef(null)
  const undoLockRef = useRef(false)
  const undoLockTimerRef = useRef(null)
  const undoStackRef = useRef(undoStack)
  /** placeId → { type: 'like'|'dislike', cancelled: boolean } enquanto a API do swipe não terminou. */
  const pendingSwipeRef = useRef(new Map())

  const acquireSwipeLock = useCallback(() => {
    if (shouldBlockSwipeGesture(swipeLockRef.current)) return false
    swipeLockRef.current = true
    if (swipeLockTimerRef.current != null) window.clearTimeout(swipeLockTimerRef.current)
    swipeLockTimerRef.current = window.setTimeout(() => {
      swipeLockRef.current = false
      swipeLockTimerRef.current = null
    }, TDV_SWIPE_COOLDOWN_MS)
    return true
  }, [])

  const acquireUndoLock = useCallback(() => {
    if (shouldBlockSwipeGesture(undoLockRef.current)) return false
    undoLockRef.current = true
    if (undoLockTimerRef.current != null) window.clearTimeout(undoLockTimerRef.current)
    undoLockTimerRef.current = window.setTimeout(() => {
      undoLockRef.current = false
      undoLockTimerRef.current = null
    }, TDV_UNDO_COOLDOWN_MS)
    return true
  }, [])

  const replaceUndoStack = useCallback((next) => {
    undoStackRef.current = next
    setUndoStack(next)
  }, [])

  useEffect(() => {
    return () => {
      if (swipeLockTimerRef.current != null) {
        window.clearTimeout(swipeLockTimerRef.current)
        swipeLockTimerRef.current = null
      }
      if (undoLockTimerRef.current != null) {
        window.clearTimeout(undoLockTimerRef.current)
        undoLockTimerRef.current = null
      }
      swipeLockRef.current = false
      undoLockRef.current = false
    }
  }, [])

  const handleLike = useCallback(() => {
    if (finalizingTdv || !currentPlace || !tripId) return
    if (!acquireSwipeLock()) return
    const placeId = getPlaceId(currentPlace)
    if (!placeId) {
      setError('Lugar sem ID válido')
      return
    }
    const placeSnapshot = {
      ...currentPlace,
      id: currentPlace.id ?? placeId,
      placeId: currentPlace.placeId ?? currentPlace.place_id ?? placeId,
    }
    const likeEntry = likeEntryFromTdvPlace(placeSnapshot)
    setSwipeFeedback('like')
    setUndoNotice(null)
    setTimeout(() => setSwipeFeedback(null), 400)

    setPlaces((prev) => {
      const next = applyOptimisticLike(
        { places: prev, likedPlaces: [], undoStack: [], totalLikes },
        placeSnapshot,
        placeId,
        likeEntry
      ).places
      placesRef.current = next
      return next
    })
    setLikedPlaces((prev) =>
      applyOptimisticLike(
        { places: [], likedPlaces: prev, undoStack: [], totalLikes },
        placeSnapshot,
        placeId,
        likeEntry
      ).likedPlaces
    )
    setUndoStack((prev) => {
      const next = applyOptimisticLike(
        { places: [], likedPlaces: [], undoStack: prev, totalLikes },
        placeSnapshot,
        placeId,
        likeEntry
      ).undoStack
      undoStackRef.current = next
      return next
    })
    setTotalLikes((prev) => (typeof prev === 'number' ? prev + 1 : prev))
    consumedSinceSessionRef.current = true
    setCurrentIndex(0)

    pendingSwipeRef.current.set(placeId, { type: 'like', cancelled: false })
    void (async () => {
      try {
        const placeData = buildTdvLikePlaceData(placeSnapshot)
        const res = await tdvSwipeService.like(tripId, placeId, placeData)
        const pending = pendingSwipeRef.current.get(placeId)
        pendingSwipeRef.current.delete(placeId)
        if (shouldCancelInFlightSwipe(pending, 'like')) {
          try {
            const undoRes = await tdvSwipeService.undoLike(tripId, placeId)
            if (typeof undoRes?.likesUsedTotal === 'number') setTotalLikes(undoRes.likesUsedTotal)
          } catch {
            /* like pode não ter persistido; UI já desfeita */
          }
          return
        }
        if (typeof res?.likesUsedTotal === 'number') setTotalLikes(res.likesUsedTotal)
        onItineraryUpdate?.()
      } catch (err) {
        const pending = pendingSwipeRef.current.get(placeId)
        pendingSwipeRef.current.delete(placeId)
        // Undo já restituiu a carta (ou cancelou): não mexer no baralho.
        if (shouldCancelInFlightSwipe(pending, 'like')) return
        if (placesRef.current.some((p) => getPlaceId(p) === placeId)) return
        setSwipeFeedback(null)
        setPlaces((prev) => {
          const next = rollbackOptimisticLike(
            { places: prev, likedPlaces: [], undoStack: [], totalLikes: 0 },
            placeSnapshot,
            placeId
          ).places
          placesRef.current = next
          return next
        })
        setLikedPlaces((prev) =>
          rollbackOptimisticLike(
            { places: [], likedPlaces: prev, undoStack: [], totalLikes: 0 },
            placeSnapshot,
            placeId
          ).likedPlaces
        )
        setUndoStack((prev) => {
          const next = rollbackOptimisticLike(
            { places: [], likedPlaces: [], undoStack: prev, totalLikes: 0 },
            placeSnapshot,
            placeId
          ).undoStack
          undoStackRef.current = next
          return next
        })
        setTotalLikes((prev) => (typeof prev === 'number' ? Math.max(0, prev - 1) : prev))
        setError(getRequestErrorMessage(err, 'Erro ao dar like'))
      }
    })()
  }, [
    finalizingTdv,
    currentPlace,
    tripId,
    totalLikes,
    onItineraryUpdate,
    acquireSwipeLock,
    placesRef,
    setPlaces,
    setLikedPlaces,
    setTotalLikes,
    setCurrentIndex,
    setError,
    consumedSinceSessionRef,
  ])

  const handleDislike = useCallback(() => {
    if (finalizingTdv || !currentPlace || !tripId) return
    if (!acquireSwipeLock()) return
    const placeId = getPlaceId(currentPlace)
    if (!placeId) {
      setError('Lugar sem ID válido')
      return
    }
    const placeSnapshot = {
      ...currentPlace,
      id: currentPlace.id ?? placeId,
      placeId: currentPlace.placeId ?? currentPlace.place_id ?? placeId,
    }
    setSwipeFeedback('dislike')
    setUndoNotice(null)
    setTimeout(() => setSwipeFeedback(null), 400)

    setPlaces((prev) => {
      const next = applyOptimisticDislike(
        { places: prev, dislikedPlaces: [], undoStack: [] },
        placeSnapshot,
        placeId
      ).places
      placesRef.current = next
      return next
    })
    setDislikedPlaces((prev) =>
      applyOptimisticDislike(
        { places: [], dislikedPlaces: prev, undoStack: [] },
        placeSnapshot,
        placeId
      ).dislikedPlaces
    )
    setUndoStack((prev) => {
      const next = applyOptimisticDislike(
        { places: [], dislikedPlaces: [], undoStack: prev },
        placeSnapshot,
        placeId
      ).undoStack
      undoStackRef.current = next
      return next
    })
    consumedSinceSessionRef.current = true
    setCurrentIndex(0)

    pendingSwipeRef.current.set(placeId, { type: 'dislike', cancelled: false })
    void (async () => {
      try {
        await tdvSwipeService.dislike(tripId, placeId, placeSnapshot)
        const pending = pendingSwipeRef.current.get(placeId)
        pendingSwipeRef.current.delete(placeId)
        if (shouldCancelInFlightSwipe(pending, 'dislike')) {
          try {
            await tdvSwipeService.undoDislike(tripId, placeId)
          } catch {
            /* dislike pode não ter persistido; UI já desfeita */
          }
          return
        }
      } catch (err) {
        const pending = pendingSwipeRef.current.get(placeId)
        pendingSwipeRef.current.delete(placeId)
        // Undo já restituiu a carta: NÃO fazer rollback (era o bug do desfazer após dislike).
        if (shouldCancelInFlightSwipe(pending, 'dislike')) return
        if (placesRef.current.some((p) => getPlaceId(p) === placeId)) return
        setSwipeFeedback(null)
        setPlaces((prev) => {
          const next = rollbackOptimisticDislike(
            { places: prev, dislikedPlaces: [], undoStack: [] },
            placeSnapshot,
            placeId
          ).places
          placesRef.current = next
          return next
        })
        setDislikedPlaces((prev) =>
          rollbackOptimisticDislike(
            { places: [], dislikedPlaces: prev, undoStack: [] },
            placeSnapshot,
            placeId
          ).dislikedPlaces
        )
        setUndoStack((prev) => {
          const next = rollbackOptimisticDislike(
            { places: [], dislikedPlaces: [], undoStack: prev },
            placeSnapshot,
            placeId
          ).undoStack
          undoStackRef.current = next
          return next
        })
        setError(getRequestErrorMessage(err, 'Erro ao descartar'))
      }
    })()
  }, [
    finalizingTdv,
    currentPlace,
    tripId,
    acquireSwipeLock,
    placesRef,
    setPlaces,
    setDislikedPlaces,
    setCurrentIndex,
    setError,
    consumedSinceSessionRef,
  ])

  const handleUndo = useCallback(() => {
    if (finalizingTdv || !tripId) return
    if (!acquireUndoLock()) return

    const stack = undoStackRef.current
    if (stack.length === 0) return
    const entry = stack[stack.length - 1]
    if (!entry?.place || (entry.type !== 'like' && entry.type !== 'dislike')) return

    const pid = getPlaceId(entry.place)
    if (!pid) return

    const placeToRestore = {
      ...entry.place,
      id: entry.place.id ?? entry.place.placeId ?? entry.place.place_id ?? pid,
      placeId: entry.place.placeId ?? entry.place.place_id ?? entry.place.id ?? pid,
    }

    replaceUndoStack(stack.slice(0, -1))
    setUndoNotice(null)
    setSwipeFeedback(null)

    // Sempre restaura a partir do estado React atual — like e dislike iguais.
    setPlaces((prev) => {
      const next = [placeToRestore, ...prev.filter((x) => getPlaceId(x) !== pid)]
      placesRef.current = next
      if (next.length === sessionDeckBaselineRef.current) {
        consumedSinceSessionRef.current = false
      }
      return next
    })
    setCurrentIndex(0)
    setDeckUnavailable(false)

    if (entry.type === 'like') {
      setLikedPlaces((prev) => prev.filter((p) => String(p?.placeId ?? p?.place_id ?? p?.id) !== pid))
      setTotalLikes((prev) => (typeof prev === 'number' ? Math.max(0, prev - 1) : prev))
    } else {
      setDislikedPlaces((prev) =>
        prev.filter((p) => String(p?.placeId ?? p?.place_id ?? p?.id) !== pid)
      )
    }

    const pending = pendingSwipeRef.current.get(pid)
    if (pending && pending.type === entry.type) {
      pending.cancelled = true
      // Mesmo com swipe in-flight, a UI já voltou. A reconciliação do swipe chama undo*.
      return
    }

    void (async () => {
      try {
        if (entry.type === 'like') {
          const res = await tdvSwipeService.undoLike(tripId, pid)
          if (typeof res?.likesUsedTotal === 'number') setTotalLikes(res.likesUsedTotal)
          onItineraryUpdate?.()
        } else {
          await tdvSwipeService.undoDislike(tripId, pid)
        }
      } catch (err) {
        // A carta já está de volta na UI — nunca remover por falha de persistência.
        if (isBenignUndoPersistError(err)) return
        setUndoNotice(
          err.response?.data?.error?.message || err.message || 'Não foi possível sincronizar o desfazer'
        )
        // Retry best-effort: se o dislike/like ainda ficou no servidor, tenta de novo.
        try {
          if (entry.type === 'like') await tdvSwipeService.undoLike(tripId, pid)
          else await tdvSwipeService.undoDislike(tripId, pid)
        } catch {
          /* keep optimistic UI */
        }
      }
    })()
  }, [
    finalizingTdv,
    tripId,
    onItineraryUpdate,
    acquireUndoLock,
    replaceUndoStack,
    placesRef,
    setPlaces,
    setLikedPlaces,
    setDislikedPlaces,
    setTotalLikes,
    setCurrentIndex,
    setDeckUnavailable,
    sessionDeckBaselineRef,
    consumedSinceSessionRef,
  ])

  useEffect(() => {
    if (finalizingTdv) return undefined
    const onKeyDown = (e) => {
      if (!currentPlace) return
      // Desktop: ← → trocam fotos (PlaceCardGallery). Mobile: curtida/descarte.
      if (typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches) {
        return
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        handleDislike()
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        handleLike()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [finalizingTdv, currentPlace, handleLike, handleDislike])

  return {
    swipeFeedback,
    undoStack,
    undoNotice,
    replaceUndoStack,
    handleLike,
    handleDislike,
    handleUndo,
  }
}
