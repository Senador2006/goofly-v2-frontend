import { useCallback, useEffect, useRef, useState } from 'react'
import {
  readMealSelectionsPreference,
  writeMealSelectionsPreference,
} from '../utils/mealSelectionsPreference'
import { mergeMealSelections } from '../utils/itineraryMealHelpers'
import { scrollElementToContainerTopAfterLayout } from '../utils/itineraryScrollHelpers'

export function useItineraryMeals({
  tripId,
  activities,
  dateToDayMap,
  selectedDay,
  isLgUp,
  setMobileMapOpen,
  roteiroListScrollRef,
}) {
  const [mealSelections, setMealSelections] = useState({})
  const [highlightedMealSlotKey, setHighlightedMealSlotKey] = useState(null)
  const [expandedMealSlotKey, setExpandedMealSlotKey] = useState(null)
  const mealSlotHeaderRefs = useRef(new Map())

  useEffect(() => {
    if (tripId) writeMealSelectionsPreference(tripId, mealSelections)
  }, [tripId, mealSelections])

  useEffect(() => {
    setHighlightedMealSlotKey(null)
    setExpandedMealSlotKey(null)
  }, [selectedDay])

  useEffect(() => {
    if (!tripId) {
      setMealSelections({})
      return
    }
    if (!Array.isArray(activities) || activities.length === 0) {
      setMealSelections(readMealSelectionsPreference(tripId))
      return
    }
    const stored = readMealSelectionsPreference(tripId)
    setMealSelections(mergeMealSelections(stored, activities, dateToDayMap))
  }, [tripId, activities, dateToDayMap])

  const scrollMealSlotHeaderIntoView = useCallback((slotKey) => {
    const header = mealSlotHeaderRefs.current.get(String(slotKey))
    scrollElementToContainerTopAfterLayout(header, roteiroListScrollRef.current, 10)
  }, [roteiroListScrollRef])

  const handleMealHighlight = useCallback((slotKey) => {
    setHighlightedMealSlotKey(String(slotKey))
  }, [])

  const handleMealGoToTimeline = useCallback((slotKey) => {
    const key = String(slotKey)
    setHighlightedMealSlotKey(key)
    setExpandedMealSlotKey(key)
    const scroll = () => scrollMealSlotHeaderIntoView(key)
    if (!isLgUp) {
      setMobileMapOpen(false)
      window.setTimeout(scroll, 520)
    } else {
      scroll()
    }
  }, [isLgUp, scrollMealSlotHeaderIntoView, setMobileMapOpen])

  const handleMealMapPinClick = useCallback((slotKey) => {
    handleMealHighlight(slotKey)
    if (isLgUp) scrollMealSlotHeaderIntoView(slotKey)
  }, [handleMealHighlight, isLgUp, scrollMealSlotHeaderIntoView])

  const handleMealViewOnMap = useCallback((slotKey) => {
    handleMealHighlight(slotKey)
    setMobileMapOpen(true)
  }, [handleMealHighlight, setMobileMapOpen])

  const handleMealDismiss = useCallback(() => setHighlightedMealSlotKey(null), [])

  const handleMealSelect = useCallback((slotKey, activityId) => {
    setMealSelections((previous) => {
      const next = { ...previous }
      if (!activityId || next[slotKey] === activityId) delete next[slotKey]
      else next[slotKey] = activityId
      return next
    })
    setHighlightedMealSlotKey(String(slotKey))
  }, [])

  return {
    mealSelections,
    highlightedMealSlotKey,
    expandedMealSlotKey,
    setExpandedMealSlotKey,
    mealSlotHeaderRefs,
    handleMealSelect,
    handleMealViewOnMap,
    handleMealMapPinClick,
    handleMealGoToTimeline,
    handleMealViewOptions: handleMealGoToTimeline,
    handleMealDismiss,
  }
}
