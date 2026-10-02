import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { tripService } from '../services/tripService'
import { userService } from '../services/userService'
import { isRequestAbort } from '../services/api'
import { clearItineraryRouteCache } from '../components/itinerary/ItineraryDayMap'
import { buildDateToDayMap } from '../utils/itineraryDayHelpers'
import {
  isOptimizerPending,
  pollItineraryUntilOptimizerReady,
} from '../utils/optimizerPollHelpers'

export function itineraryActivitiesSignature(itineraryData) {
  return (itineraryData?.activities || [])
    .map((a) => `${a?.id ?? ''}:${a?.day ?? a?.dayNumber ?? ''}:${a?.title || a?.name || ''}`)
    .join('|')
}

export function itineraryLoadErrorMessage(err) {
  const raw = String(err?.response?.data?.error?.message || '').trim()
  if (!raw) return 'Não foi possível carregar as paradas do roteiro'
  if (/assignment to constant|cannot read propert|is not a function|unexpected token/i.test(raw)) {
    return 'Não foi possível carregar as paradas do roteiro'
  }
  return raw
}

/**
 * Carga inicial, refetch (debounce + single-flight) e poll do otimizador.
 * Extraído de Itinerary.jsx (C12) — comportamento preservado + coalesce de refetch paralelo.
 *
 * @param {string | undefined} tripId
 */
export function useItineraryData(tripId) {
  const [trip, setTrip] = useState(null)
  const [itinerary, setItinerary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [itineraryLoading, setItineraryLoading] = useState(true)
  const [error, setError] = useState(null)
  const [itineraryError, setItineraryError] = useState(null)
  const [reorganizingStay, setReorganizingStay] = useState(false)

  const refetchTimeoutRef = useRef(null)
  const itineraryActsSigRef = useRef('')
  /** Coalesce GET itinerary paralelos (unlock + tab + overlay). */
  const refetchInFlightRef = useRef(null)

  const refetchItineraryImmediate = useCallback(
    async (options = {}) => {
      if (!tripId) return null
      if (refetchTimeoutRef.current) {
        clearTimeout(refetchTimeoutRef.current)
        refetchTimeoutRef.current = null
      }

      // Com AbortSignal próprio, não compartilha o in-flight (ex.: unmount do load inicial).
      if (!options.signal && refetchInFlightRef.current) {
        return refetchInFlightRef.current
      }

      const run = (async () => {
        try {
          const itineraryData = await tripService.getItinerary(tripId, {
            refresh: true,
            signal: options.signal,
          })
          const nextSig = itineraryActivitiesSignature(itineraryData)
          if (nextSig !== itineraryActsSigRef.current) {
            clearItineraryRouteCache(tripId)
            itineraryActsSigRef.current = nextSig
          }
          setItinerary(itineraryData)
          setItineraryError(null)
          return itineraryData
        } catch (err) {
          if (isRequestAbort(err)) return null
          setItineraryError(itineraryLoadErrorMessage(err))
          return null
        }
      })()

      if (!options.signal) {
        refetchInFlightRef.current = run
        try {
          return await run
        } finally {
          if (refetchInFlightRef.current === run) refetchInFlightRef.current = null
        }
      }

      return run
    },
    [tripId],
  )

  const refetchItinerary = useCallback(() => {
    if (!tripId) return
    if (refetchTimeoutRef.current) clearTimeout(refetchTimeoutRef.current)
    refetchTimeoutRef.current = setTimeout(refetchItineraryImmediate, 400)
  }, [tripId, refetchItineraryImmediate])

  const retryItineraryLoad = useCallback(async () => {
    setItineraryError(null)
    setItineraryLoading(true)
    try {
      await refetchItineraryImmediate()
    } finally {
      setItineraryLoading(false)
    }
  }, [refetchItineraryImmediate])

  useEffect(() => {
    if (!tripId) return undefined
    const ac = new AbortController()
    ;(async () => {
      setError(null)
      setItineraryError(null)
      setLoading(true)
      setItineraryLoading(true)

      const tripPromise = tripService.getTrip(tripId, { signal: ac.signal })
      const itineraryPromise = tripService.getItinerary(tripId, {
        refresh: true,
        signal: ac.signal,
      })

      try {
        const tripData = await tripPromise
        if (ac.signal.aborted) return
        setTrip(tripData)
      } catch (err) {
        if (ac.signal.aborted || isRequestAbort(err)) return
        setError(err.response?.data?.error?.message || 'Erro ao carregar roteiro')
        setTrip(null)
      } finally {
        if (!ac.signal.aborted) setLoading(false)
      }

      try {
        const itineraryData = await itineraryPromise
        if (ac.signal.aborted) return
        itineraryActsSigRef.current = itineraryActivitiesSignature(itineraryData)
        setItinerary(itineraryData)
        setItineraryError(null)
      } catch (err) {
        if (ac.signal.aborted || isRequestAbort(err)) return
        setItineraryError(itineraryLoadErrorMessage(err))
      } finally {
        if (!ac.signal.aborted) setItineraryLoading(false)
      }
    })()
    return () => {
      ac.abort()
      if (refetchTimeoutRef.current) {
        clearTimeout(refetchTimeoutRef.current)
        refetchTimeoutRef.current = null
      }
    }
  }, [tripId])

  const runOptimize = useCallback(
    async (mode = 'reorder_existing') => {
      setReorganizingStay(true)
      try {
        let data = await tripService.optimizeItinerary(tripId, { mode })
        if (isOptimizerPending(data)) {
          data = await pollItineraryUntilOptimizerReady(
            tripId,
            (id, opts) => tripService.getItinerary(id, opts),
            {
              retryOptimize: (id) => tripService.optimizeItinerary(id, { mode }),
            },
          )
        }
        if (data) setItinerary(data)
        clearItineraryRouteCache(tripId)
        const tripData = await tripService.getTrip(tripId)
        if (tripData) setTrip(tripData)
      } catch (err) {
        setError(err.response?.data?.error?.message || 'Não foi possível reorganizar o roteiro')
      } finally {
        setReorganizingStay(false)
      }
    },
    [tripId],
  )

  /** C17 — reordena o roteiro atual (preserva Modificar Roteiro). */
  const handleReorganizeStay = useCallback(async () => {
    await runOptimize('reorder_existing')
  }, [runOptimize])

  /** C17 — rebuild a partir das likes TDV (destrutivo; UI deve confirmar). */
  const handleRebuildFromTdvLikes = useCallback(async () => {
    await runOptimize('from_tdv_likes')
  }, [runOptimize])

  const handleAdminUnlock = useCallback(
    async (setSelectedDay) => {
      if (!tripId) return
      try {
        const activated = await userService.activatePlanningAdmin(tripId)
        if (activated?.trip) {
          setTrip((prev) => (prev ? { ...prev, ...activated.trip } : activated.trip))
        }
        const data = await refetchItineraryImmediate()
        if (data?.activities?.[0]?.day != null && typeof setSelectedDay === 'function') {
          const d = Number(data.activities[0].day)
          setSelectedDay(Number.isFinite(d) && d >= 1 ? d : data.activities[0].day)
        }
      } catch (err) {
        setError(err.response?.data?.error?.message || 'Não foi possível ativar o planejamento.')
      }
    },
    [tripId, refetchItineraryImmediate],
  )

  const dateToDayMap = useMemo(() => buildDateToDayMap(trip), [trip])

  return {
    trip,
    setTrip,
    itinerary,
    setItinerary,
    loading,
    itineraryLoading,
    error,
    setError,
    itineraryError,
    setItineraryError,
    dateToDayMap,
    refetchItinerary,
    refetchItineraryImmediate,
    retryItineraryLoad,
    reorganizingStay,
    setReorganizingStay,
    handleReorganizeStay,
    handleRebuildFromTdvLikes,
    handleAdminUnlock,
  }
}
