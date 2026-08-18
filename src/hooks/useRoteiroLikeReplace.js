import { useCallback, useMemo, useRef, useState } from 'react'
import { getActivityDayNumber } from '../utils/itineraryDayHelpers'
import { CROSS_SWAP_MS, playCrossContainerSwap } from '../utils/playCrossContainerSwap'

const MOTION_MS = 320

function placeIdOf(item) {
  const id = item?.placeId ?? item?.place_id ?? item?.id
  return id != null && String(id).trim() !== '' ? String(id) : null
}

function prefersReducedMotion() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function activityFromLike(like, day) {
  const nid =
    globalThis.crypto?.randomUUID?.() || `tdv-${Date.now()}-${Math.random().toString(16).slice(2)}`
  const title = like?.name || like?.title || 'Parada do TDV'
  const act = {
    id: nid,
    placeId: like.placeId,
    place_id: like.placeId,
    title,
    name: title,
    description: like.description || '',
    location: like.location || null,
    day,
    dayNumber: day,
    order: 999,
    startTime: '10:00',
    ticketRequired: false,
    source: 'tdv_like',
  }
  if (like.coordinates) act.coordinates = like.coordinates
  if (like.image_url) act.image_url = like.image_url
  if (Array.isArray(like.image_urls) && like.image_urls.length) act.image_urls = like.image_urls
  return act
}

function applyLikeOntoActivity(activity, like) {
  const title = like?.name || like?.title || activity.title
  const next = {
    ...activity,
    placeId: like.placeId,
    place_id: like.placeId,
    title,
    name: title,
    description: like.description ?? activity.description ?? '',
    location: like.location ?? activity.location ?? null,
    source: activity.source === 'user_edit' ? 'user_edit' : 'tdv_like',
  }
  if (like.coordinates) next.coordinates = like.coordinates
  if (like.image_url) next.image_url = like.image_url
  if (Array.isArray(like.image_urls) && like.image_urls.length) next.image_urls = like.image_urls
  return next
}

/** Converte a parada deslocada num item da caixa (só com placeId real). */
function likeFromActivity(activity) {
  const pid = activity?.placeId ?? activity?.place_id
  if (pid == null || String(pid).trim() === '') return null
  const title = activity?.title || activity?.name || 'Parada'
  const like = {
    placeId: String(pid),
    place_id: String(pid),
    name: title,
    title,
    description: activity?.description || '',
    location: activity?.location || null,
  }
  if (activity?.coordinates) like.coordinates = activity.coordinates
  if (activity?.image_url) like.image_url = activity.image_url
  if (Array.isArray(activity?.image_urls) && activity.image_urls.length) {
    like.image_urls = activity.image_urls
  }
  return like
}

/**
 * Garante que a parada deslocada aparece no índice da curtida consumida,
 * para a troca visual cair no mesmo slot da caixa.
 */
function placeDisplacedAtLikeSlot(likedPlaces, likePid, displacedLike) {
  const displacedPid = placeIdOf(displacedLike)
  if (!displacedPid) return likedPlaces
  const next = (likedPlaces || []).filter((l) => String(placeIdOf(l)) !== String(displacedPid))
  const likeIdx = next.findIndex((l) => String(placeIdOf(l)) === String(likePid))
  if (likeIdx >= 0) next.splice(likeIdx, 0, displacedLike)
  else next.push(displacedLike)
  return next
}

/**
 * Modo "Modificar Roteiro": draft local + curtidas TDV para insert / remove / swap 1:1.
 * Expõe `rowMotion` / `likeMotion` para animações de entrada, saída e troca.
 */
export function useRoteiroLikeReplace({ dateToDayMap, selectedDay }) {
  const [open, setOpen] = useState(false)
  const [draftActivities, setDraftActivities] = useState(null)
  const [likedPlaces, setLikedPlaces] = useState([])
  const [selectedLikeId, setSelectedLikeId] = useState(null)
  const [saving, setSaving] = useState(false)
  /** @type {[Record<string, 'enter' | 'exit' | 'swap-hide'>, Function]} */
  const [rowMotion, setRowMotion] = useState({})
  /** @type {[Record<string, 'exit' | 'swap-hide'>, Function]} */
  const [likeMotion, setLikeMotion] = useState({})
  /** Curtidas em saída (ainda renderizadas até o fim da animação). */
  const [exitingLikes, setExitingLikes] = useState([])
  const timersRef = useRef(/** @type {ReturnType<typeof setTimeout>[]} */ ([]))
  /** @type {React.MutableRefObject<Map<string, HTMLElement>>} */
  const likeCardRefs = useRef(new Map())
  /** @type {React.MutableRefObject<Map<string, HTMLElement>>} */
  const rowCardRefs = useRef(new Map())

  const clearTimers = useCallback(() => {
    for (const t of timersRef.current) clearTimeout(t)
    timersRef.current = []
  }, [])

  const later = useCallback((fn, ms) => {
    const id = setTimeout(fn, ms)
    timersRef.current.push(id)
    return id
  }, [])

  const registerLikeCardRef = useCallback((placeId, el) => {
    const key = String(placeId)
    if (el) likeCardRefs.current.set(key, el)
    else likeCardRefs.current.delete(key)
  }, [])

  const registerRowCardRef = useCallback((activityId, el) => {
    const key = String(activityId)
    if (el) rowCardRefs.current.set(key, el)
    else rowCardRefs.current.delete(key)
  }, [])

  const usedPlaceIds = useMemo(() => {
    const set = new Set()
    for (const a of draftActivities || []) {
      const pid = placeIdOf(a)
      if (pid) set.add(pid)
    }
    return set
  }, [draftActivities])

  const availableLikes = useMemo(() => {
    const active = (likedPlaces || []).filter((like) => {
      const pid = placeIdOf(like)
      return pid && !usedPlaceIds.has(pid)
    })
    const exitingIds = new Set(exitingLikes.map((l) => String(placeIdOf(l))))
    const merged = [...active]
    for (const like of exitingLikes) {
      const pid = String(placeIdOf(like))
      if (!merged.some((l) => String(placeIdOf(l)) === pid)) merged.push(like)
    }
    return merged
      .filter((like, idx, arr) => {
        const pid = String(placeIdOf(like))
        return arr.findIndex((l) => String(placeIdOf(l)) === pid) === idx
      })
      .map((like) => ({
        ...like,
        _exiting: exitingIds.has(String(placeIdOf(like))),
      }))
  }, [likedPlaces, usedPlaceIds, exitingLikes])

  const selectedLike = useMemo(
    () =>
      availableLikes.find(
        (l) => !l._exiting && String(placeIdOf(l)) === String(selectedLikeId),
      ) || null,
    [availableLikes, selectedLikeId],
  )

  const pulseLikeExit = useCallback(
    (like) => {
      const pid = String(placeIdOf(like))
      if (!pid || prefersReducedMotion()) return
      setExitingLikes((prev) => [...prev.filter((l) => String(placeIdOf(l)) !== pid), like])
      setLikeMotion((prev) => ({ ...prev, [pid]: 'exit' }))
      later(() => {
        setLikeMotion((prev) => {
          const next = { ...prev }
          delete next[pid]
          return next
        })
        setExitingLikes((prev) => prev.filter((l) => String(placeIdOf(l)) !== pid))
      }, MOTION_MS)
    },
    [later],
  )

  const start = useCallback(
    (activities, likes) => {
      clearTimers()
      setDraftActivities(Array.isArray(activities) ? activities.map((a) => ({ ...a })) : [])
      setLikedPlaces(Array.isArray(likes) ? likes : [])
      setSelectedLikeId(null)
      setSaving(false)
      setRowMotion({})
      setLikeMotion({})
      setExitingLikes([])
      likeCardRefs.current.clear()
      rowCardRefs.current.clear()
      setOpen(true)
    },
    [clearTimers],
  )

  const cancel = useCallback(() => {
    clearTimers()
    setOpen(false)
    setDraftActivities(null)
    setLikedPlaces([])
    setSelectedLikeId(null)
    setSaving(false)
    setRowMotion({})
    setLikeMotion({})
    setExitingLikes([])
    likeCardRefs.current.clear()
    rowCardRefs.current.clear()
  }, [clearTimers])

  const selectLike = useCallback((placeId) => {
    setSelectedLikeId((prev) => (String(prev) === String(placeId) ? null : String(placeId)))
  }, [])

  const insertSelectedLike = useCallback(() => {
    if (!selectedLike) return
    const day = Math.max(1, Math.floor(Number(selectedDay) || 1))
    const nextAct = activityFromLike(selectedLike, day)
    const likeSnapshot = selectedLike
    pulseLikeExit(likeSnapshot)
    setSelectedLikeId(null)
    setDraftActivities((prev) => [...(prev || []), nextAct])
    if (!prefersReducedMotion()) {
      setRowMotion((prev) => ({ ...prev, [String(nextAct.id)]: 'enter' }))
      later(() => {
        setRowMotion((prev) => {
          const next = { ...prev }
          delete next[String(nextAct.id)]
          return next
        })
      }, MOTION_MS)
    }
  }, [selectedLike, selectedDay, pulseLikeExit, later])

  const swapWithActivity = useCallback(
    (activityId) => {
      if (!selectedLike || activityId == null) return
      const likeSnapshot = selectedLike
      const likePid = String(placeIdOf(likeSnapshot))
      const aid = String(activityId)

      const activitySnapshot = (draftActivities || []).find((item) => String(item.id) === aid)
      if (!activitySnapshot) return

      const likeEl = likeCardRefs.current.get(likePid) || null
      const rowEl = rowCardRefs.current.get(aid) || null
      const canAnimate = Boolean(likeEl && rowEl && !prefersReducedMotion())

      const displacedLike = likeFromActivity(activitySnapshot)
      const displacedPid = displacedLike ? String(placeIdOf(displacedLike)) : null

      if (canAnimate) {
        setLikeMotion((prev) => {
          const next = { ...prev, [likePid]: 'swap-hide' }
          if (displacedPid) next[displacedPid] = 'swap-hide'
          return next
        })
        setRowMotion((prev) => ({ ...prev, [aid]: 'swap-hide' }))
      }

      setSelectedLikeId(null)
      if (displacedLike) {
        setLikedPlaces((prev) => placeDisplacedAtLikeSlot(prev, likePid, displacedLike))
      }
      setDraftActivities((prev) =>
        (prev || []).map((item) =>
          String(item.id) === aid ? applyLikeOntoActivity(item, likeSnapshot) : item,
        ),
      )

      const reveal = () => {
        setLikeMotion((prev) => {
          const next = { ...prev }
          delete next[likePid]
          if (displacedPid) delete next[displacedPid]
          return next
        })
        setRowMotion((prev) => {
          const next = { ...prev }
          delete next[aid]
          return next
        })
      }

      if (!canAnimate) {
        reveal()
        return
      }

      // Destino + faces finais após layout sem hints — morph no meio do voo.
      playCrossContainerSwap(likeEl, rowEl, {
        durationMs: CROSS_SWAP_MS,
        onComplete: reveal,
        resolveDestinations: () => {
          const rowDest = rowCardRefs.current.get(aid) || null
          const likeDest = displacedPid ? likeCardRefs.current.get(displacedPid) || null : null
          return {
            toA: rowDest?.getBoundingClientRect() ?? null,
            toB: likeDest?.getBoundingClientRect() ?? null,
            endElA: rowDest,
            endElB: likeDest,
          }
        },
      })
    },
    [selectedLike, draftActivities],
  )

  const removeActivity = useCallback(
    (activityId) => {
      const aid = String(activityId)
      if (prefersReducedMotion()) {
        setDraftActivities((prev) => (prev || []).filter((item) => String(item.id) !== aid))
        return
      }
      setRowMotion((prev) => ({ ...prev, [aid]: 'exit' }))
      later(() => {
        setDraftActivities((prev) => (prev || []).filter((item) => String(item.id) !== aid))
        setRowMotion((prev) => {
          const next = { ...prev }
          delete next[aid]
          return next
        })
      }, MOTION_MS)
    },
    [later],
  )

  const patchActivity = useCallback((activityId, patch) => {
    setDraftActivities((prev) =>
      (prev || []).map((item) => (String(item.id) === String(activityId) ? { ...item, ...patch } : item)),
    )
  }, [])

  const moveActivityDay = useCallback((activityId, day) => {
    const nextDay = Math.max(1, Math.floor(Number(day) || 1))
    setDraftActivities((prev) =>
      (prev || []).map((item) => {
        if (String(item.id) !== String(activityId)) return item
        return { ...item, day: nextDay, dayNumber: nextDay }
      }),
    )
  }, [])

  const dayOf = useCallback(
    (act) => getActivityDayNumber(act, dateToDayMap),
    [dateToDayMap],
  )

  return {
    open,
    draftActivities,
    setDraftActivities,
    likedPlaces,
    availableLikes,
    selectedLikeId,
    selectedLike,
    saving,
    setSaving,
    rowMotion,
    likeMotion,
    registerLikeCardRef,
    registerRowCardRef,
    start,
    cancel,
    selectLike,
    insertSelectedLike,
    swapWithActivity,
    removeActivity,
    patchActivity,
    moveActivityDay,
    dayOf,
  }
}
