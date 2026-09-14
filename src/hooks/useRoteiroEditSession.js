import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { placeService } from '../services/placeService'
import { tripService } from '../services/tripService'
import { clearItineraryRouteCache } from '../components/itinerary/ItineraryDayMap'
import { useRoteiroDragReorder } from './useRoteiroDragReorder'
import { useRoteiroDaySwap } from './useRoteiroDaySwap'
import { useRoteiroLikeReplace } from './useRoteiroLikeReplace'
import { useRoteiroLikeDrag } from './useRoteiroLikeDrag'
import {
  assignActivityToDay,
  computeDaysList,
  getActivityDayNumber,
  reorderActivityInSameDay,
  resolveEffectiveSelectedDay,
  sortDayActivities,
  swapActivitiesBetweenDays,
} from '../utils/itineraryDayHelpers'
import { filterRouteActivities } from '../utils/itineraryMealHelpers'
import { normalizeActivitiesForPersist } from '../utils/itineraryPersistPayload'
import {
  applyRoteiroScheduleEdit,
  applyRoteiroScheduleReorder,
  isScheduleTimePatch,
  scheduleActivityInsertedAtEnd,
} from '../utils/roteiroScheduleContract'
import {
  captureReorderSnapshot,
  playReorderSwapAnimation,
  prefersReducedFlipMotion,
} from '../utils/flipListAnimation'
import {
  captureDayFrozenLayout,
  ensureActivitiesHaveStableIds,
  focusStopTitleField,
  isPendingNewStop,
} from '../utils/roteiroEditHelpers'
import { mergeTdvLikeListsById } from '../utils/tdvLikeEntry'

export function useRoteiroEditSession({
  tripId,
  trip,
  itinerary,
  dateToDayMap,
  selectedDay,
  setSelectedDay,
  loading,
  hasFullAccess,
  setError,
  setItinerary,
  closeTdvOverlay,
  setMode,
  modeRoteiro,
  discardRoteiroEditRef,
  onStartEdit,
}) {
  const [roteiroEditOpen, setRoteiroEditOpen] = useState(false)
  const [draftActivities, setDraftActivities] = useState(null)
  const [savingRoteiro, setSavingRoteiro] = useState(false)
  const [trackedStopId, setTrackedStopId] = useState(null)
  const stopCardRefs = useRef(new Map())
  const dayChipRefs = useRef(new Map())
  const dayChipsScrollRef = useRef(null)
  const roteiroListScrollRef = useRef(null)
  const roteiroCardsListRef = useRef(null)
  const likeInsertZoneRef = useRef(null)
  const flipBeforeReorderRef = useRef(null)
  const reorderFrozenLayoutRef = useRef(null)
  const trackedFollowRef = useRef({ id: null, reason: null })
  const [, setReorderLayoutEpoch] = useState(0)

  const likeReplace = useRoteiroLikeReplace({ dateToDayMap, selectedDay })
  const persistedActivities = useMemo(
    () => itinerary?.activities || [],
    [itinerary?.activities],
  )
  const { swapLikeWithActivity, insertLike } = likeReplace
  const dragListContext = useMemo(() => {
    const activities =
      roteiroEditOpen && Array.isArray(draftActivities)
        ? draftActivities
        : likeReplace.open && Array.isArray(likeReplace.draftActivities)
          ? likeReplace.draftActivities
          : persistedActivities
    const days = computeDaysList(activities, dateToDayMap, trip)
    const dayNum = resolveEffectiveSelectedDay(selectedDay, days)
    return {
      dayNum,
      dayActivities: sortDayActivities(
        activities.filter(
          (activity) => getActivityDayNumber(activity, dateToDayMap) === dayNum,
        ),
      ),
    }
  }, [
    roteiroEditOpen,
    draftActivities,
    likeReplace.open,
    likeReplace.draftActivities,
    persistedActivities,
    dateToDayMap,
    trip,
    selectedDay,
  ])

  const handleLikeDropSwap = useCallback(
    (like, activityId) => swapLikeWithActivity(like, activityId),
    [swapLikeWithActivity],
  )
  const handleLikeDropInsert = useCallback(
    (like) => insertLike(like),
    [insertLike],
  )
  const likeDrag = useRoteiroLikeDrag({
    enabled: likeReplace.open && !loading && !likeReplace.saving,
    availableLikes: likeReplace.availableLikes,
    dayActivityIds: filterRouteActivities(dragListContext.dayActivities).map(
      (activity) => String(activity.id),
    ),
    rowCardRefs: likeReplace.rowCardRefs,
    insertZoneRef: likeInsertZoneRef,
    scrollRef: roteiroListScrollRef,
    onDropSwap: handleLikeDropSwap,
    onDropInsert: handleLikeDropInsert,
    onTapLike: likeReplace.selectLike,
  })

  const dragReorder = useRoteiroDragReorder({
    enabled: roteiroEditOpen && !loading && Boolean(trip),
    dayActivities: filterRouteActivities(dragListContext.dayActivities),
    dateToDayMap,
    dayNum: dragListContext.dayNum,
    setDraftActivities,
    scrollRef: roteiroListScrollRef,
    listRef: roteiroCardsListRef,
    itemRefs: stopCardRefs,
  })
  const dragReorderCancelRef = useRef(dragReorder.cancelDrag)
  dragReorderCancelRef.current = dragReorder.cancelDrag
  const dragInteractionBlockedRef = useRef(dragReorder.isInteractionBlocked)
  dragInteractionBlockedRef.current = dragReorder.isInteractionBlocked
  const daySwapCancelRef = useRef(null)

  const handleSelectDay = useCallback((day) => {
    dragReorderCancelRef.current?.()
    daySwapCancelRef.current?.()
    trackedFollowRef.current = { id: null, reason: null }
    setSelectedDay(day)
  }, [setSelectedDay])

  const handleDaySwap = useCallback((fromDay, toDay) => {
    setDraftActivities((previous) =>
      previous
        ? swapActivitiesBetweenDays(previous, dateToDayMap, fromDay, toDay)
        : previous,
    )
    setSelectedDay(toDay)
  }, [dateToDayMap, setSelectedDay])

  const daysForSwap = useMemo(() => {
    const activities =
      roteiroEditOpen && Array.isArray(draftActivities)
        ? draftActivities
        : likeReplace.open && Array.isArray(likeReplace.draftActivities)
          ? likeReplace.draftActivities
          : persistedActivities
    return computeDaysList(activities, dateToDayMap, trip)
  }, [
    roteiroEditOpen,
    draftActivities,
    likeReplace.open,
    likeReplace.draftActivities,
    persistedActivities,
    dateToDayMap,
    trip,
  ])

  const daySwap = useRoteiroDaySwap({
    enabled: roteiroEditOpen && !loading && Boolean(trip) && hasFullAccess,
    days: daysForSwap,
    selectedDay,
    chipRefs: dayChipRefs,
    scrollRef: dayChipsScrollRef,
    onSwap: handleDaySwap,
    onSelectDay: handleSelectDay,
    onFocusSwapDay: (day) => {
      trackedFollowRef.current = { id: null, reason: null }
      setSelectedDay(day)
    },
    onSwapGestureStart: () => dragReorderCancelRef.current?.(),
  })
  daySwapCancelRef.current = daySwap.cancelSwap

  const onActivityDragHandlePointerDown = useCallback((activityId, event) => {
    daySwapCancelRef.current?.()
    dragReorder.onDragHandlePointerDown(activityId, event)
  }, [dragReorder])

  const onDayChipPointerDown = useCallback((day, event) => {
    if (dragReorder.phase !== 'idle') dragReorderCancelRef.current?.()
    daySwap.onChipPointerDown(day, event)
  }, [dragReorder.phase, daySwap])

  const handleCancelRoteiroEdit = useCallback(() => {
    dragReorderCancelRef.current?.()
    daySwapCancelRef.current?.()
    setRoteiroEditOpen(false)
    setDraftActivities(null)
    setSavingRoteiro(false)
    setTrackedStopId(null)
    stopCardRefs.current.clear()
    reorderFrozenLayoutRef.current = null
    trackedFollowRef.current = { id: null, reason: null }
  }, [])
  discardRoteiroEditRef.current = handleCancelRoteiroEdit

  useEffect(() => {
    setRoteiroEditOpen(false)
    setDraftActivities(null)
    setTrackedStopId(null)
    stopCardRefs.current.clear()
    dayChipRefs.current.clear()
    trackedFollowRef.current = { id: null, reason: null }
  }, [tripId])

  useLayoutEffect(() => {
    if (
      loading ||
      !trip ||
      !roteiroEditOpen ||
      !trackedStopId ||
      !Array.isArray(draftActivities) ||
      dragInteractionBlockedRef.current ||
      dragReorder.phase !== 'idle'
    ) return
    const activity = draftActivities.find(
      (item) => String(item.id) === String(trackedStopId),
    )
    if (!activity) {
      setTrackedStopId(null)
      trackedFollowRef.current = { id: null, reason: null }
      return
    }
    const follow = trackedFollowRef.current
    if (String(follow.id) !== String(trackedStopId)) return
    const stopDay = getActivityDayNumber(activity, dateToDayMap) ?? selectedDay
    const days = computeDaysList(draftActivities, dateToDayMap, trip)
    if (stopDay !== resolveEffectiveSelectedDay(selectedDay, days)) {
      setSelectedDay(stopDay)
      return
    }
    const card = stopCardRefs.current.get(String(trackedStopId))
    card?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    if (follow.reason === 'create') focusStopTitleField(trackedStopId, card)
    trackedFollowRef.current = { id: null, reason: null }
  }, [
    loading,
    trip,
    roteiroEditOpen,
    trackedStopId,
    draftActivities,
    selectedDay,
    dateToDayMap,
    dragReorder.phase,
    setSelectedDay,
  ])

  useLayoutEffect(() => {
    const payload = flipBeforeReorderRef.current
    if (!payload) return
    flipBeforeReorderRef.current = null
    playReorderSwapAnimation(
      stopCardRefs.current,
      payload.snapshot,
      {
        movedId: payload.movedId,
        neighborId: payload.neighborId,
        direction: payload.direction,
      },
      {
        scrollContainer: roteiroListScrollRef.current,
        moveMs: roteiroEditOpen ? 380 : 320,
        onComplete: () => {
          reorderFrozenLayoutRef.current = null
          setReorderLayoutEpoch((value) => value + 1)
        },
      },
    )
  }, [draftActivities, roteiroEditOpen])

  const blockNewRoteiroStop = useMemo(() => {
    if (!trackedStopId || !Array.isArray(draftActivities)) return false
    const activity = draftActivities.find(
      (item) => String(item.id) === String(trackedStopId),
    )
    return activity != null && isPendingNewStop(activity)
  }, [trackedStopId, draftActivities])

  const handleStartRoteiroEdit = useCallback(() => {
    onStartEdit?.()
    if (likeReplace.open) likeReplace.cancel()
    closeTdvOverlay('roteiro', { skipFollowUp: true })
    setDraftActivities(ensureActivitiesHaveStableIds([...persistedActivities]))
    setRoteiroEditOpen(true)
    setError(null)
  }, [closeTdvOverlay, likeReplace, onStartEdit, persistedActivities, setError])

  const handleSaveRoteiroDraft = useCallback(async () => {
    if (!tripId || !draftActivities) return
    setSavingRoteiro(true)
    setError(null)
    try {
      const normalized = normalizeActivitiesForPersist(
        draftActivities,
        dateToDayMap,
        dragListContext.dayNum,
      )
      const next = await tripService.updateItinerary(tripId, { activities: normalized })
      clearItineraryRouteCache(tripId)
      setItinerary(next)
      handleCancelRoteiroEdit()
    } catch (error) {
      setError(
        error.response?.body?.error?.message ||
          error.response?.data?.error?.message ||
          'Não foi possível salvar o roteiro.',
      )
    } finally {
      setSavingRoteiro(false)
    }
  }, [
    tripId,
    draftActivities,
    dateToDayMap,
    dragListContext.dayNum,
    setError,
    setItinerary,
    handleCancelRoteiroEdit,
  ])

  const handleStartModifyRoteiro = useCallback(async (likesFromTdv) => {
    if (roteiroEditOpen) handleCancelRoteiroEdit()
    closeTdvOverlay('roteiro', { skipFollowUp: true })
    setMode(modeRoteiro)
    let likes = Array.isArray(likesFromTdv) ? likesFromTdv : []
    if (tripId) {
      try {
        const summary = await placeService.getTdvSummary(tripId)
        likes = mergeTdvLikeListsById(summary.likedPlaces || [], likes)
      } catch {
        // Mantém likes locais do TDV.
      }
    }
    likeReplace.start(ensureActivitiesHaveStableIds([...persistedActivities]), likes)
    setError(null)
  }, [
    roteiroEditOpen,
    handleCancelRoteiroEdit,
    closeTdvOverlay,
    setMode,
    modeRoteiro,
    tripId,
    likeReplace,
    persistedActivities,
    setError,
  ])

  const handleConcludeModifyRoteiro = useCallback(async () => {
    if (!tripId || !likeReplace.draftActivities) return
    likeReplace.setSaving(true)
    setError(null)
    try {
      const normalized = normalizeActivitiesForPersist(
        likeReplace.draftActivities,
        dateToDayMap,
        dragListContext.dayNum,
      )
      const next = await tripService.updateItinerary(tripId, { activities: normalized })
      clearItineraryRouteCache(tripId)
      setItinerary(next)
      likeReplace.cancel()
    } catch (error) {
      setError(
        error.response?.body?.error?.message ||
          error.response?.data?.error?.message ||
          'Não foi possível salvar o roteiro.',
      )
    } finally {
      likeReplace.setSaving(false)
    }
  }, [
    tripId,
    likeReplace,
    setError,
    dateToDayMap,
    dragListContext.dayNum,
    setItinerary,
  ])

  const handleAddRoteiroStop = useCallback(() => {
    if (blockNewRoteiroStop) return
    const id = globalThis.crypto?.randomUUID?.() || `nv-${Date.now()}`
    const nextDay = Math.max(1, Math.floor(Number(dragListContext.dayNum) || 1))
    setDraftActivities((previous) => {
      const base = previous ?? ensureActivitiesHaveStableIds([...persistedActivities])
      return scheduleActivityInsertedAtEnd(base, dateToDayMap, nextDay, {
        id,
        title: 'Nova parada',
        description: '',
        day: nextDay,
        dayNumber: nextDay,
        order: 999,
        ticketRequired: false,
        source: 'user_edit',
      })
    })
    setTrackedStopId(id)
    trackedFollowRef.current = { id, reason: 'create' }
    setRoteiroEditOpen(true)
    setError(null)
  }, [
    blockNewRoteiroStop,
    dragListContext.dayNum,
    persistedActivities,
    dateToDayMap,
    setError,
  ])

  const patchActivity = useCallback((activity, patch) => {
    setDraftActivities((previous) => {
      const list = previous ?? []
      if (isScheduleTimePatch(patch)) {
        const current =
          list.find((item) => String(item.id) === String(activity.id)) ?? activity
        const dayNum =
          getActivityDayNumber(current, dateToDayMap) ?? dragListContext.dayNum
        return applyRoteiroScheduleEdit(
          list,
          dateToDayMap,
          dayNum,
          activity.id,
          patch,
        )
      }
      return list.map((item) =>
        String(item.id) === String(activity.id) ? { ...item, ...patch } : item,
      )
    })
  }, [dateToDayMap, dragListContext.dayNum])

  const removeActivity = useCallback((activityId) => {
    if (String(activityId) === String(trackedStopId)) {
      setTrackedStopId(null)
      trackedFollowRef.current = { id: null, reason: null }
    }
    setDraftActivities((previous) =>
      (previous ?? []).filter((item) => String(item.id) !== String(activityId)),
    )
  }, [trackedStopId])

  const moveActivity = useCallback((activity, index, direction) => {
    if (dragReorder.isInteractionBlocked) return
    const routeActivities = filterRouteActivities(dragListContext.dayActivities)
    if (!prefersReducedFlipMotion()) {
      reorderFrozenLayoutRef.current = captureDayFrozenLayout(
        routeActivities,
        0,
      )
      flipBeforeReorderRef.current = {
        snapshot: captureReorderSnapshot(
          stopCardRefs.current,
          roteiroListScrollRef.current,
        ),
        movedId: String(activity.id),
        neighborId: routeActivities[index + direction]
          ? String(routeActivities[index + direction].id)
          : null,
        direction,
      }
    }
    setDraftActivities((previous) =>
      previous
        ? applyRoteiroScheduleReorder(
            previous,
            dateToDayMap,
            dragListContext.dayNum,
            (list) =>
              reorderActivityInSameDay(
                list,
                dateToDayMap,
                dragListContext.dayNum,
                activity.id,
                direction,
              ),
          )
        : previous,
    )
  }, [
    dragReorder.isInteractionBlocked,
    dragListContext.dayActivities,
    dragListContext.dayNum,
    dateToDayMap,
  ])

  const changeActivityDay = useCallback((activity, dayNum) => {
    setDraftActivities((previous) =>
      (previous ?? []).map((item) =>
        String(item.id) === String(activity.id)
          ? assignActivityToDay(item, dayNum, dateToDayMap)
          : item,
      ),
    )
    if (String(activity.id) === String(trackedStopId)) {
      trackedFollowRef.current = { id: activity.id, reason: 'day-change' }
      setSelectedDay(dayNum)
    }
  }, [dateToDayMap, trackedStopId, setSelectedDay])

  const removeLikeActivity = useCallback((activityId) => {
    if (String(activityId) === String(trackedStopId)) {
      setTrackedStopId(null)
      trackedFollowRef.current = { id: null, reason: null }
    }
    likeReplace.removeActivity(activityId)
  }, [likeReplace, trackedStopId])

  return {
    roteiroEditOpen,
    draftActivities,
    savingRoteiro,
    trackedStopId,
    likeReplace,
    likeDrag,
    dragReorder,
    daySwap,
    stopCardRefs,
    dayChipRefs,
    dayChipsScrollRef,
    roteiroListScrollRef,
    roteiroCardsListRef,
    likeInsertZoneRef,
    reorderFrozenLayoutRef,
    blockNewRoteiroStop,
    handleSelectDay,
    onActivityDragHandlePointerDown,
    onDayChipPointerDown,
    handleStartRoteiroEdit,
    handleCancelRoteiroEdit,
    handleSaveRoteiroDraft,
    handleStartModifyRoteiro,
    handleConcludeModifyRoteiro,
    handleAddRoteiroStop,
    patchActivity,
    removeActivity,
    moveActivity,
    changeActivityDay,
    removeLikeActivity,
    modifyPanelSharedProps: {
      availableLikes: likeReplace.availableLikes,
      selectedLikeId: likeReplace.selectedLikeId,
      onSelectLike: likeReplace.selectLike,
      onInsert: likeReplace.insertSelectedLike,
      onConclude: handleConcludeModifyRoteiro,
      onCancel: likeReplace.cancel,
      saving: likeReplace.saving,
      likeMotion: likeReplace.likeMotion,
      registerLikeCardRef: likeReplace.registerLikeCardRef,
      draggingLikeId: likeDrag.draggingLikeId,
      pendingLikeId: likeDrag.pendingLikeId,
      onLikePointerDown: likeDrag.onLikePointerDown,
      shouldSuppressClick: likeDrag.shouldSuppressClick,
    },
  }
}
