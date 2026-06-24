import { useCallback, useEffect, useRef, useState } from 'react'
import { Icon } from '../common/Icon'
import { ItineraryDayMap } from './ItineraryDayMap'
import {
  MOBILE_MAP_HANDLE_COMPACT_HEIGHT_PX,
  MOBILE_MAP_SNAP_RATIO,
  computeHandleInset,
  computeMapTranslate,
  mobileMapDrawerTransitionStyle,
  resolveHandleWidthPx,
  resolveMobileMapSnap,
} from '../../utils/mobileMapDrawer.js'

/**
 * Mapa full-screen (mobile): desliza da direita para a esquerda e cobre o roteiro.
 */
export function ItineraryMobileMapDrawer({
  open,
  onOpenChange,
  tripId,
  day,
  activities,
  disabled,
  highlightedIndex = null,
  preferLocalRoute = false,
  hideDuringRoteiroDrag = false,
}) {
  const dragRef = useRef({ active: false, startX: 0, startOpen: false })
  const [dragOffset, setDragOffset] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const panelRef = useRef(null)

  const settleOpen = useCallback(
    (shouldOpen) => {
      setDragOffset(0)
      setIsDragging(false)
      onOpenChange(shouldOpen)
    },
    [onOpenChange]
  )

  const onPointerDown = useCallback(
    (e) => {
      if (disabled) return
      e.currentTarget.setPointerCapture(e.pointerId)
      dragRef.current = { active: true, startX: e.clientX, startOpen: open }
      setIsDragging(true)
      setDragOffset(0)
    },
    [disabled, open]
  )

  const onPointerMove = useCallback((e) => {
    if (!dragRef.current.active) return
    const dx = e.clientX - dragRef.current.startX
    const maxDrag = typeof window !== 'undefined' ? window.innerWidth * 0.75 : 280
    setDragOffset(Math.max(-maxDrag, Math.min(maxDrag, dx)))
  }, [])

  const onPointerUp = useCallback(
    (e) => {
      if (!dragRef.current.active) return
      dragRef.current.active = false
      e.currentTarget.releasePointerCapture(e.pointerId)

      const dx = e.clientX - dragRef.current.startX
      const w = panelRef.current?.offsetWidth ?? (typeof window !== 'undefined' ? window.innerWidth : 360)
      const thresholdPx = w * MOBILE_MAP_SNAP_RATIO
      const nextOpen = resolveMobileMapSnap({
        wasOpen: dragRef.current.startOpen,
        dragDx: dx,
        thresholdPx,
      })
      settleOpen(nextOpen)
    },
    [settleOpen]
  )

  useEffect(() => {
    if (!open) setDragOffset(0)
  }, [open])

  const mapTranslate = computeMapTranslate({ open, isDragging, dragOffset })
  const handleInset = computeHandleInset({ open, isDragging, dragOffset })
  const handleWidthPx = resolveHandleWidthPx({ open, isDragging })
  const handleCompact = open && !isDragging
  const transitionStyle = isDragging ? 'none' : mobileMapDrawerTransitionStyle()
  const dragSuppressed = hideDuringRoteiroDrag

  const handleStyle = {
    width: handleWidthPx,
    transition: transitionStyle,
    ...(handleInset.left != null ? { left: handleInset.left, right: 'auto' } : { right: handleInset.right, left: 'auto' }),
    ...(handleCompact
      ? {
          top: '50%',
          bottom: 'auto',
          height: MOBILE_MAP_HANDLE_COMPACT_HEIGHT_PX,
          marginTop: -MOBILE_MAP_HANDLE_COMPACT_HEIGHT_PX / 2,
        }
      : { top: 0, bottom: 0 }),
  }

  return (
    <>
      <div
        ref={panelRef}
        className={
          'roteiro-map-surface absolute inset-y-0 right-0 z-20 w-full overflow-hidden bg-gray-200 dark:bg-gray-900/50 shadow-[-4px_0_24px_-8px_rgba(0,0,0,0.25)] lg:hidden' +
          (dragSuppressed ? ' roteiro-mobile-map-drag-suppressed' : '')
        }
        style={{
          transform: mapTranslate,
          transition: transitionStyle,
          opacity: dragSuppressed ? 0 : open || dragOffset < -8 ? 1 : 0,
          pointerEvents: dragSuppressed ? 'none' : open || dragOffset < -20 ? 'auto' : 'none',
        }}
        aria-hidden={!open}
      >
        <ItineraryDayMap
          tripId={tripId}
          day={day}
          activities={activities}
          disabled={disabled}
          highlightedIndex={highlightedIndex}
          preferLocalRoute={preferLocalRoute}
          className="absolute inset-0 h-full w-full"
          ariaLabel={`Mapa do roteiro — dia ${day}`}
          mapLayoutWatch={open ? `open-${day}` : 'closed'}
        />
      </div>

      <button
        type="button"
        aria-expanded={open}
        aria-label={open ? 'Fechar mapa' : 'Abrir mapa do dia'}
        className={
          'absolute z-30 flex flex-col items-center justify-center touch-none select-none lg:hidden ' +
          (dragSuppressed ? 'roteiro-mobile-map-drag-suppressed ' : '') +
          (handleCompact
            ? 'rounded-r-xl border border-l-0 border-border-light/90 bg-white text-[#1c1c0d] ' +
              'shadow-[2px_0_16px_rgba(0,0,0,0.18)] ring-1 ring-black/10 active:bg-gray-50'
            : 'top-0 bottom-0 gap-0.5 border-l border-r border-border-light dark:border-border-dark ' +
              'bg-white/95 dark:bg-card-dark/95 backdrop-blur-md text-[#1c1c0d] dark:text-white ' +
              'shadow-[-4px_0_16px_-6px_rgba(0,0,0,0.12)] active:bg-primary/15')
        }
        style={handleStyle}
        disabled={dragSuppressed}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {!handleCompact ? (
          <>
            <Icon name="map" className="text-[1.15rem] text-primary shrink-0" aria-hidden />
            <span
              className="text-[9px] font-bold uppercase tracking-wide text-text-secondary leading-none"
              style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
            >
              Mapa
            </span>
          </>
        ) : null}
        <Icon
          name={open ? 'chevron_right' : 'chevron_left'}
          className={`shrink-0 ${handleCompact ? 'text-lg text-primary' : 'text-sm text-text-secondary mt-1'}`}
          aria-hidden
        />
      </button>
    </>
  )
}
