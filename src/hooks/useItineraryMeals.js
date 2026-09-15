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
  /** Incrementa só em seleção/“ver no mapa” vindos do roteiro — dispara zoom de enquadramento. */
  const [mealMapFrameNonce, setMealMapFrameNonce] = useState(0)
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
    if (isLgUp) {
      scrollMealSlotHeaderIntoView(slotKey)
    } else {
      // Mobile: reframes o sheet ao trocar de pin no mapa.
      setMealMapFrameNonce((n) => n + 1)
    }
  }, [handleMealHighlight, isLgUp, scrollMealSlotHeaderIntoView])

  const handleMealViewOnMap = useCallback((slotKey) => {
    handleMealHighlight(slotKey)
    setMealMapFrameNonce((n) => n + 1)
    setMobileMapOpen(true)
  }, [handleMealHighlight, setMobileMapOpen])

  const handleMealDismiss = useCallback(() => setHighlightedMealSlotKey(null), [])

  /** Limpa destaque só se ainda for este slot (evita meal A→B apagar o B). */
  const handleMealDismissIfSlot = useCallback((slotKey) => {
    const key = String(slotKey ?? '')
    if (!key) return
    setHighlightedMealSlotKey((prev) =>
      prev != null && String(prev) === key ? null : prev,
    )
  }, [])

  const handleMealSelect = useCallback((slotKey, activityId) => {
    setMealSelections((previous) => {
      const next = { ...previous }
      if (!activityId || next[slotKey] === activityId) delete next[slotKey]
      else next[slotKey] = activityId
      return next
    })
    // Destaca no mapa; no mobile abre o drawer e pede zoom de enquadramento no pin
    // (padrão master–detail: seleção na lista → foco imediato no mapa).
    setHighlightedMealSlotKey(String(slotKey))
    if (activityId && !isLgUp) {
      setMealMapFrameNonce((n) => n + 1)
      setMobileMapOpen(true)
    }
  }, [isLgUp, setMobileMapOpen])

  return {
    mealSelections,
    highlightedMealSlotKey,
    mealMapFrameNonce,
    expandedMealSlotKey,
    setExpandedMealSlotKey,
    mealSlotHeaderRefs,
    handleMealSelect,
    handleMealViewOnMap,
    handleMealMapPinClick,
    handleMealGoToTimeline,
    handleMealViewOptions: handleMealGoToTimeline,
    handleMealDismiss,
    handleMealDismissIfSlot,
  }
}
