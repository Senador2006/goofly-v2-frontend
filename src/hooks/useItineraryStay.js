import { useCallback, useEffect, useState } from 'react'
import { tripService } from '../services/tripService'
import { clearItineraryRouteCache } from '../components/itinerary/ItineraryDayMap'

export function useItineraryStay({
  tripId,
  setTrip,
  primaryStay,
  runReorganizeStay,
  handleShowAccommodationRoutesChange,
}) {
  const [stayEditor, setStayEditor] = useState(null)
  const [staySaving, setStaySaving] = useState(false)
  const [stayEditorError, setStayEditorError] = useState(null)
  const [stayToast, setStayToast] = useState(null)
  const [reorganizePrompt, setReorganizePrompt] = useState(null)

  useEffect(() => {
    if (!stayToast) return undefined
    const timer = setTimeout(() => setStayToast(null), 4200)
    return () => clearTimeout(timer)
  }, [stayToast])

  const persistAccommodations = useCallback(async (
    nextAccommodations,
    { promptReorganize = false, stayName = '', toast } = {},
  ) => {
    setStaySaving(true)
    setStayEditorError(null)
    try {
      const updated = await tripService.updateTrip(tripId, {
        accommodations: nextAccommodations,
      })
      setTrip(updated)
      clearItineraryRouteCache(tripId)
      if ((nextAccommodations || []).length > 0) {
        handleShowAccommodationRoutesChange(true)
      }
      setStayEditor(null)
      setStayToast(toast || 'Hospedagens atualizadas.')
      if (promptReorganize) setReorganizePrompt({ name: stayName || '' })
    } catch (error) {
      setStayEditorError(
        error.response?.data?.error?.message || 'Não foi possível salvar a hospedagem',
      )
    } finally {
      setStaySaving(false)
    }
  }, [tripId, handleShowAccommodationRoutesChange, setTrip])

  const openStayManager = useCallback((options = {}) => {
    setStayEditorError(null)
    const intent = options.intent || 'manage'
    setStayEditor({
      intent,
      focusStayId: options.focusStayId || (intent === 'manage' ? primaryStay?.id : null),
    })
  }, [primaryStay])

  const handleReorganizeStay = useCallback(async () => {
    setReorganizePrompt(null)
    await runReorganizeStay()
  }, [runReorganizeStay])

  const closeStayEditor = useCallback(() => {
    if (staySaving) return
    setStayEditor(null)
    setStayEditorError(null)
  }, [staySaving])

  return {
    stayEditor,
    staySaving,
    stayEditorError,
    stayToast,
    reorganizePrompt,
    setReorganizePrompt,
    persistAccommodations,
    openStayManager,
    handleReorganizeStay,
    closeStayEditor,
  }
}
