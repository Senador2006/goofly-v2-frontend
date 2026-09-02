import { useCallback, useEffect, useRef, useState } from 'react'
import {
  resolveDaySwapTarget,
  ROTEIRO_DAY_SWAP_HOLD_MS,
  ROTEIRO_DAY_SWAP_FOCUS_DELAY_MS,
  ROTEIRO_DAY_SWAP_MOVE_START_PX,
  ROTEIRO_DAY_SWAP_GHOST_MIN_WIDTH_PX,
  ROTEIRO_DAY_SWAP_GHOST_MIN_HEIGHT_PX,
  ROTEIRO_DAY_SWAP_GHOST_SIZE_SCALE,
} from '../utils/roteiroDaySwap'

/**
 * Hold-to-drag na fileira de dias para trocar conjuntos de atividades.
 * Só deve ser ligado com `enabled` em modo edição do roteiro.
 *
 * @param {{
 *   enabled: boolean
 *   days: number[]
 *   selectedDay?: number
 *   chipRefs: React.MutableRefObject<Map<number, HTMLElement>>
 *   scrollRef?: React.RefObject<HTMLElement | null>
 *   onSwap: (fromDay: number, toDay: number) => void
 *   onSelectDay?: (day: number) => void
 *   onFocusSwapDay?: (day: number) => void — seleciona o dia no roteiro sem cancelar o swap
 *   onSwapGestureStart?: () => void
 * }} options
 */
export function useRoteiroDaySwap({
  enabled,
  days,
  selectedDay,
  chipRefs,
  scrollRef,
  onSwap,
  onSelectDay,
  onFocusSwapDay,
  onSwapGestureStart,
}) {
  const [phase, setPhase] = useState('idle')
  const [draggingDay, setDraggingDay] = useState(null)
  const [pendingDay, setPendingDay] = useState(null)
  const [targetDay, setTargetDay] = useState(null)
  const [ghostStyle, setGhostStyle] = useState(null)
  const [focusReady, setFocusReady] = useState(false)

  const phaseRef = useRef('idle')
  const draggingDayRef = useRef(null)
  const targetDayRef = useRef(null)
  const pendingDayRef = useRef(null)
  const holdTimerRef = useRef(null)
  const focusDelayTimerRef = useRef(null)
  const pointerStartRef = useRef({ x: 0, y: 0 })
  const lastPointerRef = useRef({ x: 0, y: 0 })
  const originRectRef = useRef(null)
  /** Tamanho do chip capturado no pointerdown, antes de qualquer re-render. */
  const pendingOriginRef = useRef(null)
  const dropLockRef = useRef(false)
  const pointerIdRef = useRef(null)
  const pointerCaptureElRef = useRef(null)
  const captureTargetRef = useRef(null)
  const selectedDayRef = useRef(selectedDay)
  const onSwapRef = useRef(onSwap)
  const onSelectDayRef = useRef(onSelectDay)
  const onFocusSwapDayRef = useRef(onFocusSwapDay)
  const onSwapGestureStartRef = useRef(onSwapGestureStart)

  selectedDayRef.current = selectedDay
  onSwapRef.current = onSwap
  onSelectDayRef.current = onSelectDay
  onFocusSwapDayRef.current = onFocusSwapDay
  onSwapGestureStartRef.current = onSwapGestureStart

  const canSwap = enabled && Array.isArray(days) && days.length > 1

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

  const clearFocusDelayTimer = useCallback(() => {
    if (focusDelayTimerRef.current != null) {
      clearTimeout(focusDelayTimerRef.current)
      focusDelayTimerRef.current = null
    }
  }, [])

  const finishIdle = useCallback(() => {
    if (pointerCaptureElRef.current != null && pointerIdRef.current != null) {
      try {
        pointerCaptureElRef.current.releasePointerCapture?.(pointerIdRef.current)
      } catch {
        /* ignore */
      }
    }
    pointerIdRef.current = null
    pointerCaptureElRef.current = null
    captureTargetRef.current = null
    syncPhase('idle')
    draggingDayRef.current = null
    targetDayRef.current = null
    pendingDayRef.current = null
    originRectRef.current = null
    pendingOriginRef.current = null
    dropLockRef.current = false
    setDraggingDay(null)
    setPendingDay(null)
    setTargetDay(null)
    setGhostStyle(null)
    setFocusReady(false)
    document.body.classList.remove('roteiro-day-swap-active')
  }, [syncPhase])

  const cancelSwap = useCallback(() => {
    clearHoldTimer()
    clearFocusDelayTimer()
    finishIdle()
  }, [clearHoldTimer, clearFocusDelayTimer, finishIdle])

  const collectChipRects = useCallback(() => {
    return (days || [])
      .map((day) => {
        const el = chipRefs.current.get(day)
        if (!el) return null
        const r = el.getBoundingClientRect()
        return {
          day,
          left: r.left,
          right: r.right,
          top: r.top,
          bottom: r.bottom,
        }
      })
      .filter(Boolean)
  }, [days, chipRefs])

  const resolveGhostSize = useCallback(
    (captured) => {
      let width = captured?.width ?? 0
      let height = captured?.height ?? 0

      // Chip ativo da fileira = referência; escala um pouco pra baixo.
      const activeDay = selectedDayRef.current
      if (activeDay != null) {
        const activeEl = chipRefs.current.get(activeDay)
        if (activeEl) {
          const ar = activeEl.getBoundingClientRect()
          width = Math.max(width, ar.width * ROTEIRO_DAY_SWAP_GHOST_SIZE_SCALE)
          height = Math.max(height, ar.height * ROTEIRO_DAY_SWAP_GHOST_SIZE_SCALE)
        }
      }

      return {
        width: Math.max(width, ROTEIRO_DAY_SWAP_GHOST_MIN_WIDTH_PX),
        height: Math.max(height, ROTEIRO_DAY_SWAP_GHOST_MIN_HEIGHT_PX),
      }
    },
    [chipRefs],
  )

  const updateSwapMetrics = useCallback(
    (clientX, clientY) => {
      const fromDay = draggingDayRef.current
      if (fromDay == null) return

      const rects = collectChipRects()
      const nextTarget = resolveDaySwapTarget(clientX, rects, fromDay, clientY)
      targetDayRef.current = nextTarget
      setTargetDay(nextTarget)

      const width = originRectRef.current?.width ?? 0
      const height = originRectRef.current?.height ?? 0
      // Ghost sempre centrado no ponteiro / touch.
      const ghostLeft = clientX - width / 2
      const ghostTop = clientY - height / 2

      setGhostStyle({
        left: ghostLeft,
        top: ghostTop,
        width,
        height: height || undefined,
        visible: true,
        hasTarget: nextTarget != null,
      })

      const scrollEl = scrollRef?.current
      if (scrollEl) {
        const sr = scrollEl.getBoundingClientRect()
        const edge = 40
        if (clientX < sr.left + edge) {
          scrollEl.scrollLeft -= 10
        } else if (clientX > sr.right - edge) {
          scrollEl.scrollLeft += 10
        }
      }
    },
    [collectChipRects, scrollRef],
  )

  const startDragging = useCallback(
    (day, clientX, clientY, captureTarget = null) => {
      const captured = pendingOriginRef.current
      const el = chipRefs.current.get(day)
      const fallback = el?.getBoundingClientRect()
      const base = captured ?? fallback
      if (!base) return

      const { width, height } = resolveGhostSize(base)
      originRectRef.current = {
        left: base.left,
        top: base.top,
        width,
        height,
      }

      draggingDayRef.current = day
      setDraggingDay(day)
      setPendingDay(null)
      pendingDayRef.current = null
      setFocusReady(false)
      syncPhase('dragging')
      document.body.classList.add('roteiro-day-swap-active')
      onSwapGestureStartRef.current?.()

      const target = captureTarget ?? captureTargetRef.current
      if (target?.el && target.pointerId != null) {
        try {
          target.el.setPointerCapture?.(target.pointerId)
          pointerIdRef.current = target.pointerId
          pointerCaptureElRef.current = target.el
        } catch {
          /* ignore */
        }
      }

      // Ghost centrado na mão primeiro; foco do roteiro vem logo em seguida.
      updateSwapMetrics(clientX, clientY)

      clearFocusDelayTimer()
      focusDelayTimerRef.current = setTimeout(() => {
        focusDelayTimerRef.current = null
        if (draggingDayRef.current !== day || phaseRef.current !== 'dragging') return
        setFocusReady(true)
        onFocusSwapDayRef.current?.(day)
      }, ROTEIRO_DAY_SWAP_FOCUS_DELAY_MS)
    },
    [chipRefs, syncPhase, updateSwapMetrics, resolveGhostSize, clearFocusDelayTimer],
  )

  const applyDrop = useCallback(() => {
    if (dropLockRef.current) return
    dropLockRef.current = true

    const from = draggingDayRef.current
    const to = targetDayRef.current
    if (from == null) {
      cancelSwap()
      return
    }
    if (to == null || to === from) {
      cancelSwap()
      return
    }
    onSwapRef.current?.(from, to)
    finishIdle()
  }, [cancelSwap, finishIdle])

  const onChipPointerDown = useCallback(
    (day, event) => {
      if (!canSwap) return
      if (event.button != null && event.button !== 0) return

      if (phaseRef.current !== 'idle') {
        clearHoldTimer()
        clearFocusDelayTimer()
        finishIdle()
      }

      // Captura o chip ANTES de setState.
      const el = chipRefs.current.get(day)
      if (el) {
        const r = el.getBoundingClientRect()
        pendingOriginRef.current = {
          left: r.left,
          top: r.top,
          width: r.width,
          height: r.height,
        }
      } else {
        pendingOriginRef.current = null
      }

      dropLockRef.current = false
      setFocusReady(false)
      pendingDayRef.current = day
      setPendingDay(day)
      pointerStartRef.current = { x: event.clientX, y: event.clientY }
      lastPointerRef.current = { x: event.clientX, y: event.clientY }
      captureTargetRef.current = { el: event.currentTarget, pointerId: event.pointerId }
      syncPhase('pending')

      clearHoldTimer()
      holdTimerRef.current = setTimeout(() => {
        if (phaseRef.current !== 'pending' || pendingDayRef.current !== day) return
        const { x, y } = lastPointerRef.current
        startDragging(day, x, y, captureTargetRef.current)
      }, ROTEIRO_DAY_SWAP_HOLD_MS)
    },
    [canSwap, syncPhase, clearHoldTimer, clearFocusDelayTimer, startDragging, finishIdle, chipRefs],
  )

  useEffect(() => {
    if (!enabled) {
      cancelSwap()
      return undefined
    }

    const onPointerMove = (event) => {
      lastPointerRef.current = { x: event.clientX, y: event.clientY }

      if (phaseRef.current === 'pending') {
        const dx = event.clientX - pointerStartRef.current.x
        const dy = event.clientY - pointerStartRef.current.y

        // Deslize horizontal antes do hold = scroll da fileira, não troca de dia.
        if (Math.abs(dx) > 4 && Math.abs(dx) > Math.abs(dy) * 1.2) {
          clearHoldTimer()
          pendingDayRef.current = null
          setPendingDay(null)
          captureTargetRef.current = null
          syncPhase('idle')
          return
        }

        if (Math.hypot(dx, dy) > ROTEIRO_DAY_SWAP_MOVE_START_PX) {
          const day = pendingDayRef.current
          clearHoldTimer()
          if (day != null) startDragging(day, event.clientX, event.clientY, captureTargetRef.current)
        }
        return
      }

      if (phaseRef.current !== 'dragging') return
      updateSwapMetrics(event.clientX, event.clientY)
    }

    const onPointerUp = () => {
      if (phaseRef.current === 'pending') {
        const day = pendingDayRef.current
        clearHoldTimer()
        pendingDayRef.current = null
        setPendingDay(null)
        syncPhase('idle')
        if (day != null) onSelectDayRef.current?.(day)
        return
      }

      if (phaseRef.current !== 'dragging') return
      const { x, y } = lastPointerRef.current
      updateSwapMetrics(x, y)
      applyDrop()
    }

    const onPointerCancel = () => {
      if (phaseRef.current === 'pending' || phaseRef.current === 'dragging') {
        cancelSwap()
      }
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerCancel)

    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerCancel)
    }
  }, [enabled, cancelSwap, clearHoldTimer, syncPhase, updateSwapMetrics, applyDrop, startDragging])

  useEffect(
    () => () => {
      clearHoldTimer()
      clearFocusDelayTimer()
      document.body.classList.remove('roteiro-day-swap-active')
    },
    [clearHoldTimer, clearFocusDelayTimer],
  )

  const isSwapMode = phase === 'dragging' || phase === 'pending'
  const isDragging = phase === 'dragging'

  return {
    phase,
    isSwapMode,
    isDragging,
    canSwap,
    draggingDay,
    pendingDay,
    targetDay,
    ghostStyle,
    focusReady,
    cancelSwap,
    onChipPointerDown,
  }
}
