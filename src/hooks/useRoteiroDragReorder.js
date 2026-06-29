import { useCallback, useEffect, useRef, useState } from 'react'
import { moveActivityToIndexInSameDay } from '../utils/itineraryDayHelpers'
import { prefersReducedFlipMotion } from '../utils/flipListAnimation'
import {
  buildGhostRect,
  computeAutoScrollDelta,
  ghostIntersectsList,
  isGhostFullyOutsideList,
  resolveInsertionIndex,
  resolveInsertLineTop,
  resolveTargetIndex,
  resolveExpandImageOffsetPx,
  scrollCardHeaderIntoView,
  scrollCompactCardBeforeExpand,
  shouldShowInsertLine,
  ROTEIRO_DRAG_SCROLL_HEADER_EDGE_PX,
  ROTEIRO_DRAG_EXPAND_MS,
  ROTEIRO_DRAG_HOLD_MS,
  ROTEIRO_DRAG_LANDING_MS,
  ROTEIRO_DRAG_MOVE_CANCEL_PX,
  ROTEIRO_DRAG_REVERT_MS,
} from '../utils/roteiroDragReorder'

function runAfterPaint(fn) {
  requestAnimationFrame(() => {
    requestAnimationFrame(fn)
  })
}

/**
 * @param {React.RefObject<HTMLElement | null>} scrollRef
 * @param {React.RefObject<HTMLElement | null>} listRef
 */
function getListZoneRect(scrollRef, listRef) {
  const scrollRect = scrollRef.current?.getBoundingClientRect()
  const listRect = listRef.current?.getBoundingClientRect()
  if (scrollRect && listRect) {
    return {
      left: Math.max(scrollRect.left, listRect.left),
      top: scrollRect.top,
      right: Math.min(scrollRect.right, listRect.right),
      bottom: scrollRect.bottom,
      width: Math.max(0, Math.min(scrollRect.right, listRect.right) - Math.max(scrollRect.left, listRect.left)),
      height: scrollRect.height,
    }
  }
  return scrollRect ?? listRect ?? null
}

/**
 * @param {{
 *   enabled: boolean
 *   dayActivities: any[]
 *   dateToDayMap: Map<string, number>
 *   dayNum: number
 *   setDraftActivities: (fn: (prev: any[] | null) => any[] | null) => void
 *   scrollRef: React.RefObject<HTMLElement | null>
 *   listRef: React.RefObject<HTMLElement | null>
 *   itemRefs: React.MutableRefObject<Map<string, HTMLElement>>
 * }} options
 */
export function useRoteiroDragReorder({
  enabled,
  dayActivities,
  dateToDayMap,
  dayNum,
  setDraftActivities,
  scrollRef,
  listRef,
  itemRefs,
}) {
  const [phase, setPhase] = useState('idle')
  const [draggingId, setDraggingId] = useState(null)
  const [pendingDragId, setPendingDragId] = useState(null)
  const [droppedId, setDroppedId] = useState(null)
  const [insertionIndex, setInsertionIndex] = useState(null)
  const [ghostStyle, setGhostStyle] = useState(null)
  const [showInsertLine, setShowInsertLine] = useState(false)
  const [ghostOutsideList, setGhostOutsideList] = useState(false)
  const [expandRevealed, setExpandRevealed] = useState(false)

  const phaseRef = useRef('idle')
  const draggingIdRef = useRef(null)
  const droppedIdRef = useRef(null)
  const insertionIndexRef = useRef(null)
  const fromIndexRef = useRef(-1)
  const holdTimerRef = useRef(null)
  const pendingIdRef = useRef(null)
  const pointerStartRef = useRef({ x: 0, y: 0 })
  const lastPointerRef = useRef({ x: 0, y: 0 })
  const pointerOffsetRef = useRef({ x: 0, y: 0 })
  const originRectRef = useRef(null)
  const phaseTimerRef = useRef(null)
  const autoScrollRafRef = useRef(0)
  const ghostRectRef = useRef(null)

  const canDrag = enabled && dayActivities.length > 1
  const reducedMotion = prefersReducedFlipMotion()

  const syncPhase = useCallback((next) => {
    phaseRef.current = next
    setPhase(next)
  }, [])

  const clearPhaseTimer = useCallback(() => {
    if (phaseTimerRef.current != null) {
      clearTimeout(phaseTimerRef.current)
      phaseTimerRef.current = null
    }
  }, [])

  const clearHoldTimer = useCallback(() => {
    if (holdTimerRef.current != null) {
      clearTimeout(holdTimerRef.current)
      holdTimerRef.current = null
    }
  }, [])

  const stopAutoScroll = useCallback(() => {
    if (autoScrollRafRef.current) {
      cancelAnimationFrame(autoScrollRafRef.current)
      autoScrollRafRef.current = 0
    }
  }, [])

  const collectSlotRects = useCallback(() => {
    return dayActivities
      .map((act) => {
        const el = itemRefs.current.get(String(act.id))
        if (!el) return null
        const r = el.getBoundingClientRect()
        return { top: r.top, bottom: r.bottom, height: r.height, left: r.left, width: r.width }
      })
      .filter(Boolean)
  }, [dayActivities, itemRefs])

  const measureCardViewportRect = useCallback(
    (activityId) => {
      const el = itemRefs.current.get(String(activityId))
      if (!el) return null
      const r = el.getBoundingClientRect()
      return { left: r.left, top: r.top, width: r.width, height: r.height }
    },
    [itemRefs],
  )

  const updateDragMetrics = useCallback(
    (clientX, clientY) => {
      const slots = collectSlotRects()
      const nextIndex = resolveInsertionIndex(clientY, slots)
      insertionIndexRef.current = nextIndex
      setInsertionIndex(nextIndex)

      const ghostLeft = clientX - pointerOffsetRef.current.x
      const ghostTop = clientY - pointerOffsetRef.current.y
      const ghostWidth = ghostWidthFromRef()
      const ghostRect = buildGhostRect(ghostLeft, ghostTop, ghostWidth)
      ghostRectRef.current = ghostRect

      const listZoneRect = getListZoneRect(scrollRef, listRef)
      const insideList = ghostIntersectsList(ghostRect, listZoneRect)
      setGhostOutsideList(!insideList)

      const fromIndex = fromIndexRef.current
      const showLine = insideList && shouldShowInsertLine(fromIndex, nextIndex)
      setShowInsertLine(showLine)

      const listEl = listRef.current
      const listRect = listEl?.getBoundingClientRect()
      const lineTop =
        showLine && listRect && slots.length > 0
          ? resolveInsertLineTop(nextIndex, slots, listRect)
          : null

      setGhostStyle({
        left: ghostLeft,
        top: ghostTop,
        width: ghostWidth,
        lineTop,
        animate: false,
        visible: true,
        outOfList: !insideList,
      })
    },
    [collectSlotRects, listRef, scrollRef],
  )

  function ghostWidthFromRef() {
    if (originRectRef.current?.width) return originRectRef.current.width
    return 0
  }

  const finishIdle = useCallback(() => {
    const lastDroppedId = droppedIdRef.current
    syncPhase('idle')
    draggingIdRef.current = null
    droppedIdRef.current = null
    fromIndexRef.current = -1
    originRectRef.current = null
    ghostRectRef.current = null
    insertionIndexRef.current = null
    setDraggingId(null)
    setDroppedId(null)
    setInsertionIndex(null)
    setGhostStyle(null)
    setShowInsertLine(false)
    setGhostOutsideList(false)
    setExpandRevealed(false)
    document.body.classList.remove('roteiro-drag-active')

    if (lastDroppedId) {
      requestAnimationFrame(() => {
        const scrollEl = scrollRef.current
        const cardEl = itemRefs.current.get(String(lastDroppedId))
        scrollCardHeaderIntoView(scrollEl, cardEl)
      })
    }
  }, [syncPhase, scrollRef, itemRefs])

  const cancelDrag = useCallback(() => {
    clearHoldTimer()
    clearPhaseTimer()
    stopAutoScroll()
    pendingIdRef.current = null
    setPendingDragId(null)
    finishIdle()
  }, [clearHoldTimer, clearPhaseTimer, stopAutoScroll, finishIdle])

  const restoreScrollToDroppedCard = useCallback(
    (onDone) => {
      const id = droppedIdRef.current
      if (!id) {
        onDone?.()
        return
      }
      requestAnimationFrame(() => {
        const scrollEl = scrollRef.current
        const cardEl = itemRefs.current.get(String(id))
        const activity = dayActivities.find((a) => String(a.id) === String(id))
        const viewportSm =
          typeof window !== 'undefined' &&
          typeof window.matchMedia === 'function' &&
          window.matchMedia('(min-width: 640px)').matches
        const imageOffsetPx = resolveExpandImageOffsetPx(activity, viewportSm)
        scrollCompactCardBeforeExpand(
          scrollEl,
          cardEl,
          ROTEIRO_DRAG_SCROLL_HEADER_EDGE_PX,
          imageOffsetPx,
        )
        onDone?.()
      })
    },
    [scrollRef, itemRefs, dayActivities],
  )

  const beginExpanding = useCallback(() => {
    syncPhase('expanding')
    setExpandRevealed(false)
    setGhostStyle(null)
    setShowInsertLine(false)
    setGhostOutsideList(false)

    restoreScrollToDroppedCard(() => {
      setExpandRevealed(true)
      clearPhaseTimer()
      phaseTimerRef.current = setTimeout(() => {
        finishIdle()
      }, reducedMotion ? 0 : ROTEIRO_DRAG_EXPAND_MS)
    })
  }, [syncPhase, restoreScrollToDroppedCard, clearPhaseTimer, finishIdle, reducedMotion])

  const animateGhostToRect = useCallback(
    (rect, durationMs, onComplete) => {
      if (!rect) {
        onComplete()
        return
      }
      setGhostStyle({
        left: rect.left,
        top: rect.top,
        width: rect.width,
        lineTop: null,
        animate: true,
        visible: true,
        outOfList: false,
      })
      clearPhaseTimer()
      phaseTimerRef.current = setTimeout(onComplete, reducedMotion ? 0 : durationMs)
    },
    [clearPhaseTimer, reducedMotion],
  )

  const beginLanding = useCallback(
    (activityId, didReorder) => {
      syncPhase('landing')
      setShowInsertLine(false)
      setGhostOutsideList(false)

      const run = () => {
        const rect = measureCardViewportRect(activityId)
        animateGhostToRect(rect, ROTEIRO_DRAG_LANDING_MS, beginExpanding)
      }

      if (didReorder) {
        runAfterPaint(run)
      } else {
        run()
      }
    },
    [syncPhase, measureCardViewportRect, animateGhostToRect, beginExpanding],
  )

  const beginRevert = useCallback(() => {
    syncPhase('reverting')
    setShowInsertLine(false)
    setGhostOutsideList(false)
    animateGhostToRect(originRectRef.current, ROTEIRO_DRAG_REVERT_MS, beginExpanding)
  }, [syncPhase, animateGhostToRect, beginExpanding])

  const applyDrop = useCallback(() => {
    const id = draggingIdRef.current
    const insertAt = insertionIndexRef.current
    if (id == null || insertAt == null) {
      cancelDrag()
      return
    }

    const fromIndex = fromIndexRef.current
    if (fromIndex < 0) {
      cancelDrag()
      return
    }

    const ghostRect =
      ghostRectRef.current ??
      (ghostStyle
        ? buildGhostRect(ghostStyle.left, ghostStyle.top, ghostStyle.width)
        : null)
    const listZoneRect = getListZoneRect(scrollRef, listRef)

    if (!ghostRect || isGhostFullyOutsideList(ghostRect, listZoneRect)) {
      droppedIdRef.current = id
      setDroppedId(String(id))
      beginRevert()
      return
    }

    const targetIndex = resolveTargetIndex(fromIndex, insertAt)
    const didReorder = fromIndex !== targetIndex

    droppedIdRef.current = id
    setDroppedId(String(id))

    if (didReorder) {
      setDraftActivities((prev) =>
        prev ? moveActivityToIndexInSameDay(prev, dateToDayMap, dayNum, id, targetIndex) : prev,
      )
    }

    beginLanding(id, didReorder)
  }, [
    ghostStyle,
    scrollRef,
    listRef,
    setDraftActivities,
    dateToDayMap,
    dayNum,
    cancelDrag,
    beginRevert,
    beginLanding,
  ])

  const startDragging = useCallback(
    (activityId, clientX, clientY) => {
      const el = itemRefs.current.get(String(activityId))
      if (!el) return

      const rect = el.getBoundingClientRect()
      pointerOffsetRef.current = {
        x: clientX - rect.left,
        y: clientY - rect.top,
      }
      originRectRef.current = {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      }

      const fromIndex = dayActivities.findIndex((a) => String(a.id) === String(activityId))
      fromIndexRef.current = fromIndex

      draggingIdRef.current = String(activityId)
      setDraggingId(String(activityId))
      setPendingDragId(null)
      syncPhase('dragging')
      document.body.classList.add('roteiro-drag-active')

      const initialIndex = fromIndex >= 0 ? fromIndex : 0
      insertionIndexRef.current = initialIndex
      setInsertionIndex(initialIndex)
      setShowInsertLine(false)
      setGhostOutsideList(false)

      updateDragMetrics(clientX, clientY)
    },
    [itemRefs, syncPhase, dayActivities, updateDragMetrics],
  )

  const onDragHandlePointerDown = useCallback(
    (activityId, event) => {
      if (!canDrag || phaseRef.current !== 'idle') return
      if (event.button != null && event.button !== 0) return

      event.preventDefault()
      pendingIdRef.current = String(activityId)
      setPendingDragId(String(activityId))
      pointerStartRef.current = { x: event.clientX, y: event.clientY }
      lastPointerRef.current = { x: event.clientX, y: event.clientY }
      syncPhase('pending')

      try {
        event.currentTarget.setPointerCapture(event.pointerId)
      } catch {
        /* ignore */
      }

      clearHoldTimer()
      holdTimerRef.current = setTimeout(() => {
        if (phaseRef.current !== 'pending' || pendingIdRef.current !== String(activityId)) return
        const { x, y } = lastPointerRef.current
        startDragging(activityId, x, y)
      }, ROTEIRO_DRAG_HOLD_MS)
    },
    [canDrag, syncPhase, clearHoldTimer, startDragging],
  )

  useEffect(() => {
    if (!enabled) {
      cancelDrag()
      return undefined
    }

    const onPointerMove = (event) => {
      lastPointerRef.current = { x: event.clientX, y: event.clientY }

      if (phaseRef.current === 'pending') {
        const dx = event.clientX - pointerStartRef.current.x
        const dy = event.clientY - pointerStartRef.current.y
        if (Math.hypot(dx, dy) > ROTEIRO_DRAG_MOVE_CANCEL_PX) {
          clearHoldTimer()
          pendingIdRef.current = null
          setPendingDragId(null)
          syncPhase('idle')
        }
        return
      }

      if (phaseRef.current !== 'dragging') return

      updateDragMetrics(event.clientX, event.clientY)

      stopAutoScroll()
      const tick = () => {
        if (phaseRef.current !== 'dragging') return
        const scrollEl = scrollRef.current
        if (scrollEl) {
          const delta = computeAutoScrollDelta(scrollEl, event.clientY)
          if (delta !== 0) {
            scrollEl.scrollTop += delta
            updateDragMetrics(event.clientX, event.clientY)
          }
        }
        autoScrollRafRef.current = requestAnimationFrame(tick)
      }
      autoScrollRafRef.current = requestAnimationFrame(tick)
    }

    const onPointerUp = (event) => {
      if (phaseRef.current === 'pending') {
        clearHoldTimer()
        pendingIdRef.current = null
        setPendingDragId(null)
        syncPhase('idle')
        return
      }

      if (phaseRef.current !== 'dragging') return

      stopAutoScroll()
      updateDragMetrics(event.clientX, event.clientY)
      applyDrop()
    }

    const onPointerCancel = () => {
      if (phaseRef.current === 'pending' || phaseRef.current === 'dragging') {
        cancelDrag()
      }
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerCancel)

    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerCancel)
      stopAutoScroll()
    }
  }, [
    enabled,
    cancelDrag,
    clearHoldTimer,
    syncPhase,
    updateDragMetrics,
    applyDrop,
    scrollRef,
    stopAutoScroll,
  ])

  useEffect(
    () => () => {
      clearHoldTimer()
      clearPhaseTimer()
      stopAutoScroll()
      document.body.classList.remove('roteiro-drag-active')
    },
    [clearHoldTimer, clearPhaseTimer, stopAutoScroll],
  )

  const isCompactList =
    phase === 'dragging' ||
    phase === 'landing' ||
    phase === 'reverting' ||
    (phase === 'expanding' && !expandRevealed)

  const isCardCompact = useCallback(
    (activityId) => {
      if (phase === 'dragging' || phase === 'landing' || phase === 'reverting') return true
      if (phase === 'expanding') {
        if (!expandRevealed) return true
        const dropped = droppedIdRef.current ?? droppedId
        return String(activityId) !== String(dropped)
      }
      return false
    },
    [phase, expandRevealed, droppedId],
  )
  const isDragMode = isCompactList || phase === 'expanding'
  const isOverlayActive =
    phase === 'dragging' || phase === 'landing' || phase === 'reverting' || phase === 'expanding'
  const isInteractionBlocked = isDragMode

  const ghostActivity =
    draggingId != null
      ? dayActivities.find((a) => String(a.id) === String(draggingId)) ?? null
      : null

  return {
    phase,
    isDragMode,
    isCompactList,
    isCardCompact,
    isInteractionBlocked,
    isOverlayActive,
    canDrag,
    draggingId,
    droppedId,
    pendingDragId,
    insertionIndex,
    showInsertLine,
    ghostOutsideList,
    expandRevealed,
    ghostStyle,
    ghostActivity,
    cancelDrag,
    onDragHandlePointerDown,
  }
}
