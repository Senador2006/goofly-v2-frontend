import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ROTEIRO_DRAG_HOLD_MS,
  ROTEIRO_DRAG_MOVE_START_PX,
  ROTEIRO_DRAG_SCROLL_EDGE_PX,
  computeAutoScrollDelta,
} from '../utils/roteiroDragReorder'

const GHOST_HEIGHT_PX = 56
/** Folga no long-press mobile: tremor do dedo não cancela o hold. */
const LIKE_DRAG_HOLD_SLOP_PX = 16
/** Movimento vertical (para a lista) inicia o drag sem esperar o hold completo. */
const LIKE_DRAG_VERTICAL_START_PX = 12

function placeIdOf(item) {
  const id = item?.placeId ?? item?.place_id ?? item?.id
  return id != null && String(id).trim() !== '' ? String(id) : null
}

function isCoarsePointer(event) {
  if (event?.pointerType === 'touch') return true
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(pointer: coarse)').matches
}

/**
 * Gesto de arrastar curtidas TDV → soltar em parada (swap) ou zona Inserir.
 * Não muta o draft; chama onDropSwap / onDropInsert.
 *
 * @param {{
 *   enabled: boolean
 *   availableLikes: any[]
 *   dayActivityIds: string[]
 *   rowCardRefs: React.MutableRefObject<Map<string, HTMLElement>>
 *   insertZoneRef: React.RefObject<HTMLElement | null>
 *   scrollRef: React.RefObject<HTMLElement | null>
 *   onDropSwap: (like: any, activityId: string) => void
 *   onDropInsert: (like: any) => void
 *   onTapLike?: (placeId: string) => void
 *   onDragLikeChange?: (placeId: string | null) => void
 * }} options
 */
export function useRoteiroLikeDrag({
  enabled,
  availableLikes,
  dayActivityIds,
  rowCardRefs,
  insertZoneRef,
  scrollRef,
  onDropSwap,
  onDropInsert,
  onTapLike,
  onDragLikeChange,
}) {
  const [phase, setPhase] = useState('idle')
  const [draggingLikeId, setDraggingLikeId] = useState(null)
  const [pendingLikeId, setPendingLikeId] = useState(null)
  const [overTarget, setOverTarget] = useState(null)
  const [ghostStyle, setGhostStyle] = useState(null)

  const phaseRef = useRef('idle')
  const draggingLikeIdRef = useRef(null)
  const draggingLikeRef = useRef(null)
  const overTargetRef = useRef(null)
  const pointerIdRef = useRef(null)
  const pointerStartRef = useRef({ x: 0, y: 0 })
  const pointerOffsetRef = useRef({ x: 0, y: 0 })
  const originRectRef = useRef(null)
  const holdTimerRef = useRef(null)
  const pendingLikeIdRef = useRef(null)
  const originElRef = useRef(null)
  const suppressClickRef = useRef(false)
  const autoScrollRafRef = useRef(0)
  const lastPointerRef = useRef({ x: 0, y: 0 })
  const listenersAttachedRef = useRef(false)

  const dayActivityIdsRef = useRef(dayActivityIds)
  dayActivityIdsRef.current = dayActivityIds
  const onDropSwapRef = useRef(onDropSwap)
  onDropSwapRef.current = onDropSwap
  const onDropInsertRef = useRef(onDropInsert)
  onDropInsertRef.current = onDropInsert
  const onTapLikeRef = useRef(onTapLike)
  onTapLikeRef.current = onTapLike
  const onDragLikeChangeRef = useRef(onDragLikeChange)
  onDragLikeChangeRef.current = onDragLikeChange
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled

  const syncPhase = useCallback((next) => {
    phaseRef.current = next
    setPhase(next)
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

  const resolveOverTarget = useCallback(
    (clientX, clientY) => {
      const insertEl = insertZoneRef?.current
      if (insertEl) {
        const r = insertEl.getBoundingClientRect()
        if (
          clientX >= r.left &&
          clientX <= r.right &&
          clientY >= r.top &&
          clientY <= r.bottom
        ) {
          return { type: 'insert' }
        }
      }

      const ids = Array.isArray(dayActivityIdsRef.current) ? dayActivityIdsRef.current : []
      for (const aid of ids) {
        const el = rowCardRefs?.current?.get(String(aid))
        if (!el) continue
        const r = el.getBoundingClientRect()
        if (
          clientX >= r.left &&
          clientX <= r.right &&
          clientY >= r.top &&
          clientY <= r.bottom
        ) {
          return { type: 'swap', activityId: String(aid) }
        }
      }
      return null
    },
    [insertZoneRef, rowCardRefs],
  )

  const updateGhost = useCallback((clientX, clientY) => {
    const origin = originRectRef.current
    const width = origin?.width || 176
    const left = clientX - pointerOffsetRef.current.x
    const top = clientY - pointerOffsetRef.current.y
    setGhostStyle({
      left,
      top,
      width,
      height: origin?.height || GHOST_HEIGHT_PX,
      visible: true,
    })
  }, [])

  const tickAutoScroll = useCallback(() => {
    autoScrollRafRef.current = 0
    if (phaseRef.current !== 'dragging') return
    const scrollEl = scrollRef?.current
    if (!scrollEl) return
    const { x, y } = lastPointerRef.current
    const delta = computeAutoScrollDelta(scrollEl, y, ROTEIRO_DRAG_SCROLL_EDGE_PX)
    if (delta !== 0) {
      scrollEl.scrollTop += delta
      const nextOver = resolveOverTarget(x, y)
      overTargetRef.current = nextOver
      setOverTarget(nextOver)
      updateGhost(x, y)
    }
    autoScrollRafRef.current = requestAnimationFrame(tickAutoScroll)
  }, [resolveOverTarget, scrollRef, updateGhost])

  const startAutoScroll = useCallback(() => {
    if (autoScrollRafRef.current) return
    autoScrollRafRef.current = requestAnimationFrame(tickAutoScroll)
  }, [tickAutoScroll])

  const finishIdle = useCallback(() => {
    clearHoldTimer()
    stopAutoScroll()
    const capturedEl = originElRef.current
    const pid = pointerIdRef.current
    if (capturedEl && pid != null) {
      try {
        if (capturedEl.hasPointerCapture?.(pid)) {
          capturedEl.releasePointerCapture(pid)
        }
      } catch {
        /* ignore */
      }
    }
    syncPhase('idle')
    draggingLikeIdRef.current = null
    draggingLikeRef.current = null
    pendingLikeIdRef.current = null
    originElRef.current = null
    pointerIdRef.current = null
    originRectRef.current = null
    overTargetRef.current = null
    setDraggingLikeId(null)
    setPendingLikeId(null)
    setOverTarget(null)
    setGhostStyle(null)
    document.body.classList.remove('roteiro-like-drag-active')
    onDragLikeChangeRef.current?.(null)
  }, [clearHoldTimer, stopAutoScroll, syncPhase])

  const beginDragging = useCallback(
    (like, clientX, clientY, originEl) => {
      const pid = placeIdOf(like)
      if (!pid) return
      clearHoldTimer()
      suppressClickRef.current = true
      draggingLikeIdRef.current = pid
      draggingLikeRef.current = like
      syncPhase('dragging')
      setDraggingLikeId(pid)
      onDragLikeChangeRef.current?.(pid)
      document.body.classList.add('roteiro-like-drag-active')

      const rect = originEl?.getBoundingClientRect?.() || null
      originRectRef.current = rect
        ? { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
        : { left: clientX - 88, top: clientY - 28, width: 176, height: GHOST_HEIGHT_PX }

      pointerOffsetRef.current = {
        x: rect ? clientX - rect.left : originRectRef.current.width / 2,
        y: rect ? clientY - rect.top : originRectRef.current.height / 2,
      }

      lastPointerRef.current = { x: clientX, y: clientY }
      updateGhost(clientX, clientY)
      const nextOver = resolveOverTarget(clientX, clientY)
      overTargetRef.current = nextOver
      setOverTarget(nextOver)
      startAutoScroll()

      // Capture só depois do drag começar — no pending o click precisa funcionar.
      try {
        originEl?.setPointerCapture?.(pointerIdRef.current)
      } catch {
        /* ignore */
      }
    },
    [clearHoldTimer, syncPhase, updateGhost, resolveOverTarget, startAutoScroll],
  )

  const detachListenersRef = useRef(() => {})

  const onPointerMove = useCallback(
    (event) => {
      if (pointerIdRef.current != null && event.pointerId !== pointerIdRef.current) return
      const x = event.clientX
      const y = event.clientY
      lastPointerRef.current = { x, y }

      if (phaseRef.current === 'pending') {
        const dx = x - pointerStartRef.current.x
        const dy = y - pointerStartRef.current.y
        const dist = Math.hypot(dx, dy)
        if (isCoarsePointer(event)) {
          // Mobile: tremor pequeno durante o hold é ok.
          // Scroll horizontal da dock → cancela.
          // Puxar para cima (lista) → inicia drag sem esperar o timer.
          if (dist > LIKE_DRAG_HOLD_SLOP_PX) {
            if (Math.abs(dx) >= Math.abs(dy)) {
              finishIdle()
              detachListenersRef.current()
              return
            }
            if (dy < -LIKE_DRAG_VERTICAL_START_PX) {
              if (event.cancelable) event.preventDefault()
              beginDragging(draggingLikeRef.current, x, y, originElRef.current)
            }
          } else if (dist > 2 && event.cancelable) {
            // Claim o gesto cedo para o browser não roubar com scroll/cancel.
            event.preventDefault()
          }
          return
        }
        if (dist > ROTEIRO_DRAG_MOVE_START_PX) {
          beginDragging(draggingLikeRef.current, x, y, originElRef.current)
        }
        return
      }

      if (phaseRef.current !== 'dragging') return
      if (event.cancelable) event.preventDefault()
      updateGhost(x, y)
      const nextOver = resolveOverTarget(x, y)
      overTargetRef.current = nextOver
      setOverTarget(nextOver)
    },
    [beginDragging, finishIdle, resolveOverTarget, updateGhost],
  )

  const onPointerUp = useCallback(
    (event) => {
      if (pointerIdRef.current != null && event.pointerId !== pointerIdRef.current) return
      detachListenersRef.current()

      if (phaseRef.current === 'pending') {
        const pid = pendingLikeIdRef.current
        finishIdle()
        // Clique/tap curto: seleciona aqui. O click nativo pode não disparar
        // depois dos listeners de pointer no document — e se disparar, suppress evita toggle duplo.
        suppressClickRef.current = true
        if (pid) onTapLikeRef.current?.(pid)
        return
      }

      if (phaseRef.current !== 'dragging') {
        finishIdle()
        return
      }

      const like = draggingLikeRef.current
      const target = overTargetRef.current

      if (like && target?.type === 'swap' && target.activityId) {
        onDropSwapRef.current?.(like, target.activityId)
      } else if (like && target?.type === 'insert') {
        onDropInsertRef.current?.(like)
      }

      finishIdle()
    },
    [finishIdle],
  )

  const onPointerCancel = useCallback(() => {
    detachListenersRef.current()
    finishIdle()
  }, [finishIdle])

  const onKeyDown = useCallback(
    (event) => {
      if (event.key === 'Escape' && phaseRef.current !== 'idle') {
        event.preventDefault()
        detachListenersRef.current()
        finishIdle()
      }
    },
    [finishIdle],
  )

  const attachListeners = useCallback(() => {
    if (listenersAttachedRef.current) return
    listenersAttachedRef.current = true
    document.addEventListener('pointermove', onPointerMove, { capture: true, passive: false })
    document.addEventListener('pointerup', onPointerUp, { capture: true })
    document.addEventListener('pointercancel', onPointerCancel, { capture: true })
    document.addEventListener('keydown', onKeyDown, { capture: true })
  }, [onPointerMove, onPointerUp, onPointerCancel, onKeyDown])

  const detachListeners = useCallback(() => {
    if (!listenersAttachedRef.current) return
    listenersAttachedRef.current = false
    document.removeEventListener('pointermove', onPointerMove, { capture: true })
    document.removeEventListener('pointerup', onPointerUp, { capture: true })
    document.removeEventListener('pointercancel', onPointerCancel, { capture: true })
    document.removeEventListener('keydown', onKeyDown, { capture: true })
  }, [onPointerMove, onPointerUp, onPointerCancel, onKeyDown])

  detachListenersRef.current = detachListeners

  const onLikePointerDown = useCallback(
    (event, like) => {
      if (!enabledRef.current || !like) return
      if (event.button != null && event.button !== 0) return
      const pid = placeIdOf(like)
      if (!pid) return
      if (like._exiting) return

      const originEl =
        event.currentTarget instanceof HTMLElement
          ? event.currentTarget
          : event.target instanceof HTMLElement
            ? event.target.closest?.('[data-roteiro-like-card]')
            : null

      pointerIdRef.current = event.pointerId
      pointerStartRef.current = { x: event.clientX, y: event.clientY }
      lastPointerRef.current = { x: event.clientX, y: event.clientY }
      draggingLikeRef.current = like
      pendingLikeIdRef.current = pid
      originElRef.current = originEl
      suppressClickRef.current = false
      setPendingLikeId(pid)

      syncPhase('pending')
      attachListeners()

      // Não capturar o pointer no pending (mouse): engolia o click.
      // No touch, touch-action:none no card (via pendingLikeId) evita scroll/cancel.
      if (isCoarsePointer(event)) {
        clearHoldTimer()
        holdTimerRef.current = setTimeout(() => {
          holdTimerRef.current = null
          if (phaseRef.current !== 'pending') return
          if (pendingLikeIdRef.current !== pid) return
          beginDragging(like, lastPointerRef.current.x, lastPointerRef.current.y, originElRef.current)
        }, ROTEIRO_DRAG_HOLD_MS)
      }
    },
    [syncPhase, attachListeners, clearHoldTimer, beginDragging],
  )

  const shouldSuppressClick = useCallback(() => {
    if (!suppressClickRef.current) return false
    suppressClickRef.current = false
    return true
  }, [])

  useEffect(() => {
    if (!enabled && phaseRef.current !== 'idle') {
      detachListeners()
      finishIdle()
    }
  }, [enabled, detachListeners, finishIdle])

  useEffect(() => {
    return () => {
      detachListeners()
      clearHoldTimer()
      stopAutoScroll()
      document.body.classList.remove('roteiro-like-drag-active')
    }
  }, [detachListeners, clearHoldTimer, stopAutoScroll])

  const draggingLike =
    draggingLikeId && Array.isArray(availableLikes)
      ? availableLikes.find((l) => String(placeIdOf(l)) === String(draggingLikeId)) ||
        draggingLikeRef.current
      : null

  return {
    phase,
    draggingLikeId,
    pendingLikeId,
    draggingLike,
    overTarget,
    ghostStyle,
    onLikePointerDown,
    shouldSuppressClick,
  }
}
