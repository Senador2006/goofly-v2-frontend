import { useCallback, useEffect, useRef, useState } from 'react'
import { Icon } from '../common/Icon'
import {
  formatMealTimeLabel,
  getMealTypeIcon,
  getMealTypeLabel,
} from '../../utils/itineraryMealHelpers'

const DISMISS_DISTANCE_PX = 56
const DISMISS_VELOCITY = 0.55

/**
 * Peek card fino no mapa mobile — uma linha, aproveitando a largura.
 * Arrastar para baixo fecha (padrão Google/Apple Maps).
 *
 * @param {{
 *   mealType?: string | null
 *   name?: string | null
 *   startTime?: string | null
 *   optionCount?: number
 *   onViewOptions?: (() => void) | null
 *   onDismiss?: (() => void) | null
 * }} props
 */
export function ItineraryMealMapSheet({
  mealType,
  name,
  startTime,
  optionCount = 1,
  onViewOptions = null,
  onDismiss = null,
}) {
  const mealLabel = getMealTypeLabel(mealType)
  const mealIcon = getMealTypeIcon(mealType)
  const timeLabel = formatMealTimeLabel(startTime)
  const extraOptions = Math.max(0, Number(optionCount) - 1)
  const title = name || 'Sugestão gastronômica'

  const dragRef = useRef({
    active: false,
    startY: 0,
    lastY: 0,
    lastT: 0,
    velocity: 0,
  })
  const [dragY, setDragY] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    setDragY(0)
    setDragging(false)
    setExiting(false)
  }, [title, mealType, startTime])

  const finishDismiss = useCallback(() => {
    if (typeof onDismiss !== 'function') return
    setExiting(true)
    setDragY(120)
    window.setTimeout(() => onDismiss(), 140)
  }, [onDismiss])

  const onPointerDown = useCallback((e) => {
    if (e.button != null && e.button !== 0) return
    if (e.target?.closest?.('button, a')) return
    e.currentTarget.setPointerCapture?.(e.pointerId)
    const now = performance.now()
    dragRef.current = {
      active: true,
      startY: e.clientY,
      lastY: e.clientY,
      lastT: now,
      velocity: 0,
    }
    setDragging(true)
  }, [])

  const onPointerMove = useCallback((e) => {
    if (!dragRef.current.active) return
    const dy = Math.max(0, e.clientY - dragRef.current.startY)
    const now = performance.now()
    const dt = Math.max(1, now - dragRef.current.lastT)
    dragRef.current.velocity = (e.clientY - dragRef.current.lastY) / dt
    dragRef.current.lastY = e.clientY
    dragRef.current.lastT = now
    setDragY(dy)
  }, [])

  const onPointerUp = useCallback(
    (e) => {
      if (!dragRef.current.active) return
      dragRef.current.active = false
      try {
        e.currentTarget.releasePointerCapture?.(e.pointerId)
      } catch {
        /* ignore */
      }
      setDragging(false)

      const dy = Math.max(0, e.clientY - dragRef.current.startY)
      const shouldDismiss =
        typeof onDismiss === 'function' &&
        (dy >= DISMISS_DISTANCE_PX || dragRef.current.velocity > DISMISS_VELOCITY)

      if (shouldDismiss) {
        finishDismiss()
        return
      }
      setDragY(0)
    },
    [finishDismiss, onDismiss],
  )

  const sheetStyle = {
    transform: `translateY(${dragY}px)`,
    transition: dragging || exiting ? 'none' : 'transform 200ms cubic-bezier(0.22, 1, 0.36, 1)',
    opacity: exiting ? Math.max(0.15, 1 - dragY / 120) : Math.max(0.45, 1 - dragY / 180),
  }

  return (
    <div
      className="goofly-meal-map-sheet pointer-events-auto absolute inset-x-0 bottom-8 z-[600] px-2.5"
      role="dialog"
      aria-label={`${mealLabel}: ${title}`}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="goofly-meal-map-sheet__card mx-auto max-w-lg touch-none select-none rounded-2xl border border-amber-500/55 bg-white dark:bg-[#1c1a12] shadow-[0_10px_28px_-8px_rgba(0,0,0,0.55),0_0_0_1px_rgba(245,158,11,0.12)] dark:shadow-[0_12px_32px_-8px_rgba(0,0,0,0.75),0_0_0_1px_rgba(245,158,11,0.22)]"
        style={sheetStyle}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className="flex items-center gap-2.5 px-3 py-2.5">
          <span
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-500 text-[#1c1c0d] shadow-sm"
            aria-hidden
          >
            <Icon name={mealIcon} className="text-base" />
          </span>

          <div className="min-w-0 flex-1">
            <p className="m-0 truncate text-[13px] font-bold leading-tight text-foreground dark:text-white">
              {title}
            </p>
            <p className="m-0 mt-0.5 truncate text-[11px] font-medium leading-tight text-amber-800/80 dark:text-amber-200/85">
              {mealLabel} · {timeLabel}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {extraOptions > 0 && typeof onViewOptions === 'function' ? (
              <button
                type="button"
                aria-label={`Ver outras ${extraOptions} opções`}
                title={`+${extraOptions} opções`}
                onClick={onViewOptions}
                className="inline-flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-[11px] font-bold text-amber-950 dark:text-amber-50 bg-amber-500/25 dark:bg-amber-400/20"
              >
                +{extraOptions}
              </button>
            ) : null}
            {typeof onDismiss === 'function' ? (
              <button
                type="button"
                aria-label="Fechar"
                onClick={finishDismiss}
                className="inline-flex size-7 items-center justify-center rounded-full text-text-secondary hover:bg-black/5 dark:hover:bg-white/10"
              >
                <Icon name="close" className="text-lg" aria-hidden />
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
