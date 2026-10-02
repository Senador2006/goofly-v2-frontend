import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { tripService } from '../services/tripService'
import { hasItineraryFullAccess } from '../utils/planningAccess'

export const MODE_ROTEIRO = 'roteiro'
export const MODE_TDV = 'tdv'
export const MODE_DOCUMENTOS = 'documentos'

/** Deve bater com `transition` em `.tdv-overlay-panel` (index.css). */
export const TDV_OVERLAY_MS = 420

/**
 * Modos/abas, overlay TDV pós-unlock, deep links `?unlocked=1` / `?tab=tdv`.
 * Extraído de Itinerary.jsx (C12).
 *
 * @param {{
 *   tripId: string | undefined,
 *   trip: object | null,
 *   itinerary: object | null,
 *   setTrip: Function,
 *   finalizingTdv: boolean,
 *   refetchItineraryImmediate: Function,
 *   refreshUser: Function,
 *   searchParams: URLSearchParams,
 *   setSearchParams: Function,
 *   roteiroEditOpen: boolean,
 *   likeReplaceOpen: boolean,
 *   onDiscardRoteiroEdit: () => void,
 *   tdvLockTabHint: string,
 * }} opts
 */
export function usePlanningModes({
  tripId,
  trip,
  itinerary,
  setTrip,
  finalizingTdv,
  refetchItineraryImmediate,
  refreshUser,
  searchParams,
  setSearchParams,
  roteiroEditOpen,
  likeReplaceOpen,
  onDiscardRoteiroEdit,
  tdvLockTabHint,
}) {
  const [mode, setMode] = useState(MODE_ROTEIRO)
  const [tdvOverlayOpen, setTdvOverlayOpen] = useState(false)
  const [tdvOverlayAnimIn, setTdvOverlayAnimIn] = useState(false)
  const [tdvOverlayContentReady, setTdvOverlayContentReady] = useState(false)
  const [tdvOverlayExitTo, setTdvOverlayExitTo] = useState(null)
  const [tdvLockHint, setTdvLockHint] = useState(null)

  const tdvOverlayCloseTimerRef = useRef(null)
  const tdvOverlayContentTimerRef = useRef(null)
  const tdvOverlayPanelRef = useRef(null)
  const tdvOverlayOpenRef = useRef(false)

  const isPlanning = trip?.status === 'planejando'
  const hasFullAccess = hasItineraryFullAccess(itinerary, trip)
  const tdvTabLocked = Boolean(trip) && !isPlanning && !hasFullAccess
  const tdvAsOverlay = Boolean(trip) && !isPlanning && hasFullAccess
  const tdvUiActive = (isPlanning && mode === MODE_TDV) || tdvOverlayOpen

  useEffect(() => {
    if (!isPlanning && mode === MODE_TDV) {
      setMode(MODE_ROTEIRO)
    }
  }, [isPlanning, mode])

  useLayoutEffect(() => {
    tdvOverlayOpenRef.current = tdvOverlayOpen
    if (tdvOverlayContentTimerRef.current) {
      clearTimeout(tdvOverlayContentTimerRef.current)
      tdvOverlayContentTimerRef.current = null
    }
    if (!tdvOverlayOpen) {
      setTdvOverlayAnimIn(false)
      setTdvOverlayContentReady(false)
      return undefined
    }
    setTdvOverlayAnimIn(false)
    setTdvOverlayContentReady(false)
    const panel = tdvOverlayPanelRef.current
    if (panel) {
      panel.style.willChange = 'transform'
      void panel.offsetHeight
    }
    const id = requestAnimationFrame(() => {
      setTdvOverlayAnimIn(true)
      tdvOverlayContentTimerRef.current = setTimeout(() => {
        setTdvOverlayContentReady(true)
        tdvOverlayContentTimerRef.current = null
      }, 64)
    })
    return () => {
      cancelAnimationFrame(id)
      if (tdvOverlayContentTimerRef.current) {
        clearTimeout(tdvOverlayContentTimerRef.current)
        tdvOverlayContentTimerRef.current = null
      }
    }
  }, [tdvOverlayOpen])

  useEffect(() => {
    return () => {
      if (tdvOverlayCloseTimerRef.current) clearTimeout(tdvOverlayCloseTimerRef.current)
      if (tdvOverlayContentTimerRef.current) clearTimeout(tdvOverlayContentTimerRef.current)
    }
  }, [])

  useEffect(() => {
    const main = document.querySelector('main')
    if (!main) return undefined

    const mq = window.matchMedia('(max-width: 1023px)')
    const sync = () => {
      if (tdvUiActive && mq.matches) main.classList.add('tdv-mobile-lock')
      else main.classList.remove('tdv-mobile-lock')
    }
    sync()
    mq.addEventListener('change', sync)
    return () => {
      mq.removeEventListener('change', sync)
      main.classList.remove('tdv-mobile-lock')
    }
  }, [tdvUiActive])

  const unlockedFlag = searchParams.get('unlocked')
  const tdvTabFlag = searchParams.get('tab')

  useEffect(() => {
    if (unlockedFlag !== '1' || !tripId) return undefined
    let cancelled = false
    ;(async () => {
      await refreshUser().catch(() => null)
      const tripData = await tripService.getTrip(tripId).catch(() => null)
      if (cancelled) return
      if (tripData) setTrip(tripData)
      await refetchItineraryImmediate()
      if (cancelled) return
      setSearchParams(
        (prev) => {
          if (prev.get('unlocked') !== '1') return prev
          const next = new URLSearchParams(prev)
          next.delete('unlocked')
          return next
        },
        { replace: true },
      )
    })()
    return () => {
      cancelled = true
    }
  }, [tripId, unlockedFlag, refetchItineraryImmediate, refreshUser, setSearchParams, setTrip])

  useEffect(() => {
    if (tdvTabFlag !== 'tdv' || !trip) return

    const clearTabParam = () => {
      setSearchParams(
        (prev) => {
          if (prev.get('tab') !== 'tdv') return prev
          const next = new URLSearchParams(prev)
          next.delete('tab')
          return next
        },
        { replace: true },
      )
    }

    if (trip.status === 'planejando') {
      setMode(MODE_TDV)
      clearTabParam()
      return
    }

    const unlocked =
      unlockedFlag === '1' ||
      hasItineraryFullAccess(itinerary, trip) ||
      Boolean(trip.planning_unlocked_at || trip.planningUnlockedAt)

    if (!unlocked) return

    setMode(MODE_ROTEIRO)
    setTdvOverlayOpen(true)
    clearTabParam()
  }, [
    trip?.id,
    trip?.status,
    trip?.planning_unlocked_at,
    trip?.planningUnlockedAt,
    tdvTabFlag,
    unlockedFlag,
    setSearchParams,
    trip,
    itinerary,
  ])

  const closeTdvOverlay = useCallback(
    (exitTo = 'roteiro', options = {}) => {
      if (!tdvOverlayOpenRef.current) return
      const target = exitTo === 'documentos' ? 'documentos' : 'roteiro'
      const skipFollowUp = Boolean(options?.skipFollowUp)
      setTdvOverlayAnimIn(false)
      setTdvOverlayContentReady(false)
      const panel = tdvOverlayPanelRef.current
      if (panel) panel.style.willChange = 'transform'
      requestAnimationFrame(() => {
        setTdvOverlayExitTo(skipFollowUp ? null : target)
      })
      if (tdvOverlayCloseTimerRef.current) clearTimeout(tdvOverlayCloseTimerRef.current)
      tdvOverlayCloseTimerRef.current = setTimeout(() => {
        setTdvOverlayOpen(false)
        setTdvOverlayExitTo(null)
        tdvOverlayCloseTimerRef.current = null
        if (panel) panel.style.willChange = ''
        if (skipFollowUp) return
        if (target === 'documentos') {
          setMode(MODE_DOCUMENTOS)
        } else {
          setMode(MODE_ROTEIRO)
          if (!isPlanning) refetchItineraryImmediate()
        }
      }, TDV_OVERLAY_MS)
    },
    [isPlanning, refetchItineraryImmediate],
  )

  const openTdvOverlay = useCallback(() => {
    if (tdvOverlayCloseTimerRef.current) {
      clearTimeout(tdvOverlayCloseTimerRef.current)
      tdvOverlayCloseTimerRef.current = null
    }
    if (tdvOverlayContentTimerRef.current) {
      clearTimeout(tdvOverlayContentTimerRef.current)
      tdvOverlayContentTimerRef.current = null
    }
    setTdvOverlayExitTo(null)
    setTdvOverlayContentReady(false)
    setTdvOverlayAnimIn(false)
    setTdvOverlayOpen(true)
  }, [])

  const confirmDiscardRoteiro = () => {
    if (!roteiroEditOpen) return true
    if (
      typeof globalThis.confirm === 'function' &&
      globalThis.confirm('Tem alterações não salvas neste roteiro. Mudar mesmo assim e descartá-las?')
    ) {
      onDiscardRoteiroEdit()
      return true
    }
    return false
  }

  const guardedSwitchModeFromRoteiro = (nextMode) => {
    if (finalizingTdv) return
    if (likeReplaceOpen) {
      setTdvLockHint('Conclua ou cancele a modificação do roteiro antes de mudar de aba.')
      return
    }
    if (!roteiroEditOpen) {
      setMode(nextMode)
      return
    }
    if (confirmDiscardRoteiro()) {
      setMode(nextMode)
    }
  }

  const openTdvTab = () => {
    setTdvLockHint(null)
    if (finalizingTdv) return
    if (tdvTabLocked) {
      setTdvLockHint(tdvLockTabHint)
      return
    }
    if (likeReplaceOpen) {
      setTdvLockHint('Conclua ou cancele a modificação do roteiro antes de abrir o TDV.')
      return
    }
    if (tdvAsOverlay) {
      if (roteiroEditOpen && !confirmDiscardRoteiro()) return
      openTdvOverlay()
      return
    }
    guardedSwitchModeFromRoteiro(MODE_TDV)
  }

  const tdvTabActive =
    (isPlanning && mode === MODE_TDV) || (tdvAsOverlay && tdvOverlayOpen && !tdvOverlayExitTo)

  const activeModeTab =
    tdvOverlayExitTo === 'documentos'
      ? 'documentos'
      : tdvOverlayExitTo === 'roteiro'
        ? 'roteiro'
        : tdvTabActive
          ? 'tdv'
          : mode === MODE_DOCUMENTOS
            ? 'documentos'
            : mode === MODE_TDV
              ? 'tdv'
              : 'roteiro'

  const handleModeTabRoteiro = () => {
    if (finalizingTdv) return
    if (tdvAsOverlay && tdvOverlayOpen) {
      closeTdvOverlay('roteiro')
      return
    }
    setMode(MODE_ROTEIRO)
    if (!isPlanning) refetchItineraryImmediate()
  }

  const handleModeTabDocumentos = () => {
    if (finalizingTdv) return
    if (tdvAsOverlay && tdvOverlayOpen) {
      if (likeReplaceOpen) {
        setTdvLockHint('Conclua ou cancele a modificação do roteiro antes de mudar de aba.')
        return
      }
      if (roteiroEditOpen && !confirmDiscardRoteiro()) return
      closeTdvOverlay('documentos')
      return
    }
    guardedSwitchModeFromRoteiro(MODE_DOCUMENTOS)
  }

  return {
    mode,
    setMode,
    isPlanning,
    hasFullAccess,
    tdvTabLocked,
    tdvAsOverlay,
    tdvUiActive,
    tdvOverlayOpen,
    tdvOverlayAnimIn,
    tdvOverlayContentReady,
    tdvOverlayExitTo,
    tdvLockHint,
    setTdvLockHint,
    tdvOverlayPanelRef,
    closeTdvOverlay,
    openTdvOverlay,
    openTdvTab,
    activeModeTab,
    handleModeTabRoteiro,
    handleModeTabDocumentos,
  }
}
