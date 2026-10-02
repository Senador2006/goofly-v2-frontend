import { useCallback, useEffect, useState } from 'react'
import {
  readShowAccommodationRoutesPreference,
  writeShowAccommodationRoutesPreference,
} from '../utils/mapAccommodationRoutesPreference'
import {
  readShowMealsOnMapPreference,
  writeShowMealsOnMapPreference,
} from '../utils/mapMealsPreference'

export function useItineraryMapUi(mode) {
  const [mobileMapOpen, setMobileMapOpen] = useState(false)
  const [showAccommodationRoutes, setShowAccommodationRoutes] = useState(
    () => readShowAccommodationRoutesPreference(),
  )
  const [showMealsOnMap, setShowMealsOnMap] = useState(
    () => readShowMealsOnMapPreference(),
  )
  const [isLgUp, setIsLgUp] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(min-width: 1024px)').matches,
  )

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const sync = () => setIsLgUp(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    setMobileMapOpen(false)
  }, [mode])

  const handleShowAccommodationRoutesChange = useCallback((next) => {
    setShowAccommodationRoutes(next)
    writeShowAccommodationRoutesPreference(next)
  }, [])

  const handleShowMealsOnMapChange = useCallback((next) => {
    setShowMealsOnMap(next)
    writeShowMealsOnMapPreference(next)
  }, [])

  return {
    mobileMapOpen,
    setMobileMapOpen,
    isLgUp,
    showAccommodationRoutes,
    showMealsOnMap,
    handleShowAccommodationRoutesChange,
    handleShowMealsOnMapChange,
  }
}
