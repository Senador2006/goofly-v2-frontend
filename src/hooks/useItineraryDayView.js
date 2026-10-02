import { useEffect, useMemo } from 'react'
import {
  computeDaysList,
  getActivityDayNumber,
  getIsoDateForDay,
  resolveEffectiveSelectedDay,
  sortDayActivities,
} from '../utils/itineraryDayHelpers'
import {
  buildDayTimelineItems,
  filterRouteActivities,
} from '../utils/itineraryMealHelpers'
import { buildDayEditUnits, getUnitDragId } from '../utils/itineraryDayUnits'
import {
  findDestinationCoveringIso,
  resolveAccommodationsForDay,
} from '../utils/accommodationDayResolver'
import {
  getPremiumDayTotals,
  normalizedPremiumRestriction,
} from '../utils/itineraryPremiumHelpers'

export function useItineraryDayView({
  trip,
  itinerary,
  dateToDayMap,
  selectedDay,
  setSelectedDay,
  roteiroEditOpen,
  draftActivities,
  likeReplace,
  trackedStopId,
  mode,
  isPlanning,
  hasFullAccess,
  modeRoteiro,
}) {
  const view = useMemo(() => {
    const persistedActivities = itinerary?.activities || []
    const activities =
      roteiroEditOpen && Array.isArray(draftActivities)
        ? draftActivities
        : likeReplace.open && Array.isArray(likeReplace.draftActivities)
          ? likeReplace.draftActivities
          : persistedActivities
    const days = computeDaysList(activities, dateToDayMap, trip)
    const effectiveSelectedDay = resolveEffectiveSelectedDay(selectedDay, days)
    const dayActivities = sortDayActivities(
      activities.filter(
        (activity) =>
          getActivityDayNumber(activity, dateToDayMap) === effectiveSelectedDay,
      ),
    )
    const dayTimelineItems = buildDayTimelineItems(dayActivities, effectiveSelectedDay)
    const dayEditUnits = buildDayEditUnits(dayActivities, effectiveSelectedDay)
    const dayRouteActivities = filterRouteActivities(dayActivities)
    const dayMealSlots = dayTimelineItems.filter((item) => item.type === 'mealSlot')
    const unitIndexByDragId = new Map(
      dayEditUnits.map((unit, index) => [getUnitDragId(unit), index]),
    )
    const dayAccommodations = resolveAccommodationsForDay(
      trip,
      effectiveSelectedDay,
      dateToDayMap,
    )
    const dayStays = resolveAccommodationsForDay(
      trip,
      effectiveSelectedDay,
      dateToDayMap,
      { plottableOnly: false },
    )
    const primaryStay = dayStays[0] ?? null
    const selectedDayIso = getIsoDateForDay(dateToDayMap, effectiveSelectedDay)
    const selectedDayDest = findDestinationCoveringIso(trip, selectedDayIso)
    const trackedMapIndex = trackedStopId
      ? dayRouteActivities.findIndex(
          (activity) => String(activity.id) === String(trackedStopId),
        )
      : -1
    const premiumRestriction = itinerary?._premiumRestriction
      ? normalizedPremiumRestriction(itinerary._premiumRestriction)
      : null
    const previewDayMapsReady = Boolean(
      premiumRestriction &&
        typeof premiumRestriction.totalByDay === 'object' &&
        typeof premiumRestriction.visibleByDay === 'object' &&
        (Object.keys(premiumRestriction.totalByDay).length ||
          Object.keys(premiumRestriction.visibleByDay).length),
    )
    const selectedDayPremium =
      previewDayMapsReady && premiumRestriction
        ? getPremiumDayTotals(premiumRestriction, effectiveSelectedDay)
        : null
    const isSelectedDayPremiumLockedUi =
      !hasFullAccess &&
      Boolean(premiumRestriction) &&
      selectedDayPremium != null &&
      selectedDayPremium.totalOnDay > 0 &&
      selectedDayPremium.visibleOnDay === 0 &&
      !isPlanning
    const hiddenPremiumStopsSameDay =
      selectedDayPremium &&
      selectedDayPremium.visibleOnDay > 0 &&
      selectedDayPremium.totalOnDay > selectedDayPremium.visibleOnDay
        ? selectedDayPremium.totalOnDay - selectedDayPremium.visibleOnDay
        : 0
    const showRoteiroSidebar = mode === modeRoteiro
    const roteiroEditAllowed =
      showRoteiroSidebar &&
      !isPlanning &&
      hasFullAccess &&
      persistedActivities.length > 0 &&
      !likeReplace.open

    return {
      persistedActivities,
      activities,
      days,
      effectiveSelectedDay,
      dayActivities,
      dayTimelineItems,
      dayEditUnits,
      unitIndexByDragId,
      dayRouteActivities,
      dayMealSlots,
      dayAccommodations,
      primaryStay,
      selectedDayIso,
      selectedDayDest,
      trackedMapHighlight: trackedMapIndex >= 0 ? trackedMapIndex : null,
      premiumRestriction,
      previewDayMapsReady,
      selectedDayPremium,
      isSelectedDayPremiumLockedUi,
      hiddenPremiumStopsSameDay,
      isRouteRestricted: !hasFullAccess && Boolean(premiumRestriction) && !isPlanning,
      showRoteiroSidebar,
      roteiroEditAllowed,
      canEditStay: roteiroEditAllowed && !roteiroEditOpen,
      showStayAnchors:
        showRoteiroSidebar &&
        !isPlanning &&
        activities.length > 0 &&
        !isSelectedDayPremiumLockedUi,
      canPrintItinerary:
        showRoteiroSidebar &&
        !isPlanning &&
        hasFullAccess &&
        !roteiroEditOpen &&
        !likeReplace.open &&
        persistedActivities.length > 0,
    }
  }, [
    trip,
    itinerary,
    dateToDayMap,
    selectedDay,
    roteiroEditOpen,
    draftActivities,
    likeReplace.open,
    likeReplace.draftActivities,
    trackedStopId,
    mode,
    isPlanning,
    hasFullAccess,
    modeRoteiro,
  ])

  useEffect(() => {
    if (!trip || !view.days.length) return
    setSelectedDay((previous) =>
      view.days.includes(previous) ? previous : view.days[0],
    )
  }, [trip, setSelectedDay, view.days])

  return view
}
