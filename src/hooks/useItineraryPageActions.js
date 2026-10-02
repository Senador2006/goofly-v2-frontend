import { useCallback, useRef, useState } from 'react'
import { tripService } from '../services/tripService'

export function useItineraryPageActions({
  tripId,
  navigate,
  setError,
  setSelectedDay,
  runRebuildFromTdvLikes,
  runAdminUnlock,
}) {
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const deleteInFlightRef = useRef(false)

  const handleDeletePlanning = useCallback(async () => {
    if (deleteInFlightRef.current) return
    deleteInFlightRef.current = true
    try {
      setDeleting(true)
      await tripService.deleteTrip(tripId)
      navigate('/trips', { replace: true })
    } catch (error) {
      setError(error.response?.data?.error?.message || 'Erro ao apagar planejamento')
    } finally {
      deleteInFlightRef.current = false
      setDeleting(false)
      setShowDeleteConfirm(false)
    }
  }, [navigate, setError, tripId])

  const handleReoptimizeItinerary = useCallback(async () => {
    const confirmed = globalThis.confirm?.(
      'Isso recria o roteiro a partir das curtidas TDV e descarta edições manuais do Modificar Roteiro. Continuar?',
    )
    if (confirmed) await runRebuildFromTdvLikes()
  }, [runRebuildFromTdvLikes])

  const handleAdminUnlock = useCallback(() => {
    runAdminUnlock(setSelectedDay)
  }, [runAdminUnlock, setSelectedDay])

  return {
    deleting,
    showDeleteConfirm,
    setShowDeleteConfirm,
    deleteInFlightRef,
    handleDeletePlanning,
    handleReoptimizeItinerary,
    handleAdminUnlock,
  }
}
