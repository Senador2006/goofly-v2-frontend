import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { isRequestAbort } from '../services/api'
import { tripService } from '../services/tripService'
import { buildNewTripPayload } from '../utils/newTripPayload'
import { newCreateIdempotencyKey } from '../utils/newTripFormHelpers'
import { trackMetaEvent } from '../utils/metaPixel'

export const CREATE_TRIP_IDEMPOTENCY_HEADER = 'Idempotency-Key'

export function useCreateTrip({
  step,
  setStep,
  formDataRef,
  collectForStep,
  showStepErrors,
  clearFormErrors,
  setApiError,
  errorBannerRef,
}) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const createIdempotencyKeyRef = useRef(null)
  const createAbortRef = useRef(null)
  const createInFlightRef = useRef(false)

  useEffect(() => {
    if (step === 4 && !createIdempotencyKeyRef.current) {
      createIdempotencyKeyRef.current = newCreateIdempotencyKey()
    }
  }, [step])

  useEffect(() => () => createAbortRef.current?.abort(), [])

  const runCreateTrip = async () => {
    for (let value = 1; value <= 4; value += 1) {
      const list = collectForStep(value, formDataRef.current)
      if (list.length > 0) {
        showStepErrors(list)
        setStep(value)
        return
      }
    }
    if (createInFlightRef.current) return
    createInFlightRef.current = true
    if (!createIdempotencyKeyRef.current) {
      createIdempotencyKeyRef.current = newCreateIdempotencyKey()
    }

    createAbortRef.current?.abort()
    const ac = new AbortController()
    createAbortRef.current = ac
    setLoading(true)
    clearFormErrors()
    try {
      const payload = buildNewTripPayload(formDataRef.current)
      const trip = await tripService.createTrip(payload, {
        signal: ac.signal,
        idempotencyKey: createIdempotencyKeyRef.current,
      })
      if (ac.signal.aborted) return
      const dest = payload.destinations?.[0]
      const destLabel = dest ? [dest.city, dest.country].filter(Boolean).join(', ') : undefined
      trackMetaEvent('Lead', {
        content_name: destLabel || 'nova_viagem',
        content_ids: trip?.id ? [String(trip.id)] : undefined,
        content_category: 'trip_planning',
      })
      navigate(`/trips/${trip.id}/itinerary?tab=tdv`)
    } catch (err) {
      if (isRequestAbort(err) || ac.signal.aborted) return
      setApiError(err.response?.data?.error?.message || err.message || 'Erro ao criar viagem')
      requestAnimationFrame(() => {
        errorBannerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      })
    } finally {
      if (createAbortRef.current === ac) {
        createInFlightRef.current = false
        if (!ac.signal.aborted) setLoading(false)
      }
    }
  }

  return {
    loading,
    runCreateTrip,
    handleCreateTripClick: () => void runCreateTrip(),
  }
}
