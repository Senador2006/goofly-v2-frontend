import { useCallback, useEffect, useRef, useState } from 'react'
import { tripService } from '../services/tripService'
import { clearItineraryRouteCache } from '../components/itinerary/ItineraryDayMap'
import {
  clearFinalizeTdvSession,
  finalizeTdvSessionDeadline,
  isFinalizeRequestAbort,
  markFinalizeTdvSession,
  readFinalizeTdvSession,
} from '../utils/finalizeTdvSession'
import {
  isOptimizerPending,
  pollItineraryUntilOptimizerReady,
} from '../utils/optimizerPollHelpers'

/**
 * Finalize TDV → optimize + resume pós-refresh (sessionStorage).
 * Extraído de Itinerary.jsx (C12). `onSuccess` aplica modo/aba no orquestrador.
 *
 * @param {{
 *   tripId: string | undefined,
 *   trip: object | null,
 *   loading: boolean,
 *   itinerary: object | null,
 *   hasFullAccess: boolean,
 *   setTrip: Function,
 *   setItinerary: Function,
 *   setSelectedDay: Function,
 *   onSuccess?: (payload: { tripData: object | null, itineraryData: object | null }) => void,
 *   lockWarnBody: string,
 *   onBeforeFinalize?: () => void,
 * }} opts
 */
export function useFinalizeTdv({
  tripId,
  trip,
  loading,
  itinerary,
  hasFullAccess,
  setTrip,
  setItinerary,
  setSelectedDay,
  onSuccess,
  lockWarnBody,
  onBeforeFinalize,
}) {
  const [finalizingTdv, setFinalizingTdv] = useState(() => Boolean(readFinalizeTdvSession(tripId)))
  const [finalizeError, setFinalizeError] = useState(null)
  const [finalizeResumeKey, setFinalizeResumeKey] = useState(0)
  const finalizeInFlightRef = useRef(false)

  const applyFinalizeSuccess = useCallback(
    (tripData, itineraryData) => {
      clearFinalizeTdvSession(tripId)
      if (tripData) setTrip(tripData)
      if (itineraryData) {
        clearItineraryRouteCache(tripId)
        setItinerary(itineraryData)
        const firstDay = itineraryData?.activities?.[0]?.day
        if (firstDay != null && firstDay !== '') {
          const asNum = Number(firstDay)
          setSelectedDay(Number.isFinite(asNum) && asNum >= 1 ? asNum : firstDay)
        }
      }
      setFinalizeError(null)
      finalizeInFlightRef.current = false
      setFinalizingTdv(false)
      onSuccess?.({ tripData, itineraryData })
    },
    [tripId, setTrip, setItinerary, setSelectedDay, onSuccess],
  )

  const handleFinalizeTdv = useCallback(async () => {
    if (!tripId || finalizeInFlightRef.current) return
    finalizeInFlightRef.current = true
    onBeforeFinalize?.()
    markFinalizeTdvSession(tripId)
    setFinalizingTdv(true)
    setFinalizeError(null)
    try {
      const result = await tripService.finalizeTdvPlanning(tripId)
      let itineraryData = result?.itinerary || (await tripService.getItinerary(tripId))
      if (isOptimizerPending(itineraryData) || result?.optimizerPending) {
        itineraryData = await pollItineraryUntilOptimizerReady(
          tripId,
          (id, opts) => tripService.getItinerary(id, opts),
          {
            retryOptimize: (id) => tripService.optimizeItinerary(id),
            intervalMs: 4000,
            expectOptimization: true,
          },
        )
      }
      applyFinalizeSuccess(result?.trip, itineraryData)
    } catch (err) {
      if (isFinalizeRequestAbort(err) || !err.response) {
        finalizeInFlightRef.current = false
        setFinalizeResumeKey((k) => k + 1)
        return
      }
      clearFinalizeTdvSession(tripId)
      setFinalizeError(err.response?.data?.error?.message || 'Não foi possível finalizar o TDV')
      finalizeInFlightRef.current = false
      setFinalizingTdv(false)
    }
  }, [tripId, applyFinalizeSuccess, onBeforeFinalize])

  const requestFinalizeTdv = useCallback(() => {
    if (!hasFullAccess) {
      const ok = globalThis.confirm?.(lockWarnBody)
      if (!ok) return
    }
    handleFinalizeTdv()
  }, [hasFullAccess, handleFinalizeTdv, lockWarnBody])

  useEffect(() => {
    if (!tripId || loading || !trip) return undefined
    const session = readFinalizeTdvSession(tripId)
    if (!session) return undefined

    if (trip.status === 'ativa') {
      let cancelled = false
      ;(async () => {
        try {
          let itineraryData =
            itinerary || (await tripService.getItinerary(tripId, { refresh: true }))
          if (isOptimizerPending(itineraryData)) {
            itineraryData = await pollItineraryUntilOptimizerReady(
              tripId,
              (id, opts) => tripService.getItinerary(id, opts),
              {
                retryOptimize: (id) => tripService.optimizeItinerary(id),
                intervalMs: 4000,
                expectOptimization: true,
              },
            )
          }
          if (cancelled) return
          applyFinalizeSuccess(trip, itineraryData)
        } catch {
          if (!cancelled) {
            clearFinalizeTdvSession(tripId)
            setFinalizingTdv(false)
          }
        }
      })()
      return () => {
        cancelled = true
      }
    }

    if (finalizeInFlightRef.current) return undefined

    let cancelled = false
    setFinalizingTdv(true)

    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

    ;(async () => {
      while (!cancelled) {
        const deadline = finalizeTdvSessionDeadline(session)
        const remaining = deadline - Date.now()
        if (remaining <= 0) {
          clearFinalizeTdvSession(tripId)
          setFinalizingTdv(false)
          setFinalizeError(
            'A geração está demorando mais do que o esperado. Atualize a página ou tente gerar novamente.',
          )
          return
        }
        try {
          const tripData = await tripService.getTrip(tripId)
          if (cancelled) return
          if (tripData?.status === 'ativa') {
            let itineraryData = await tripService.getItinerary(tripId, { refresh: true })
            if (isOptimizerPending(itineraryData)) {
              itineraryData = await pollItineraryUntilOptimizerReady(
                tripId,
                (id, opts) => tripService.getItinerary(id, opts),
                {
                  retryOptimize: (id) => tripService.optimizeItinerary(id),
                  intervalMs: 4000,
                  expectOptimization: true,
                },
              )
            }
            if (cancelled) return
            applyFinalizeSuccess(tripData, itineraryData)
            return
          }
        } catch {
          /* mantém poll */
        }
        await sleep(Math.min(2500, Math.max(500, remaining)))
      }
    })()

    return () => {
      cancelled = true
    }
    // itinerary só como cache no atalho `ativa`; poll é guiado por session + status.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId, trip, loading, applyFinalizeSuccess, finalizeResumeKey])

  return {
    finalizingTdv,
    finalizeError,
    setFinalizeError,
    handleFinalizeTdv,
    requestFinalizeTdv,
  }
}
