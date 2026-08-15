import { useCallback, useEffect, useRef, useState } from 'react'
import { Icon } from '../common/Icon'
import { ItineraryDayMap } from './ItineraryDayMap'
import {
  MOBILE_MAP_HANDLE_COMPACT_HEIGHT_PX,
  MOBILE_MAP_SNAP_RATIO,
  computeHandleInset,
  computeMapCurtainClip,
  computeMapTranslate,
  mobileMapDrawerTransitionStyle,
  resolveHandleWidthPx,
  resolveMobileMapSnap,
} from '../../utils/mobileMapDrawer.js'
import {
  readMobileMapHandleHintDismissed,
  writeMobileMapHandleHintDismissed,
} from '../../utils/mobileMapHandleHintPreference.js'

/**
 * Mapa full-screen (mobile): desliza da direita como cortina/carrossel e cobre o roteiro.
 */
export function ItineraryMobileMapDrawer({
  open,
  onOpenChange,
  tripId,
  day,
  activities,
  accommodations = [],
  disabled,
  routeRestricted = false,
  highlightedIndex = null,
  preferLocalRoute = false,
  hideDuringRoteiroDrag = false,
  showAccommodationRoutes = true,
  onShowAccommodationRoutesChange,
}) {
  const dragRef = useRef({ active: false, startX: 0, startOpen: false })
  const prevOpenRef = useRef(open)
  const [dragOffset, setDragOffset] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [handleHintDismissed, setHandleHintDismissed] = useState(() =>
    readMobileMapHandleHintDismissed()
  )
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

  useEffect(() => {
    if (prevOpenRef.current && !open && !handleHintDismissed) {
      setHandleHintDismissed(true)
      writeMobileMapHandleHintDismissed(true)
    }
    prevOpenRef.current = open
  }, [open, handleHintDismissed])

  const panelWidth = panelRef.current?.offsetWidth ?? (typeof window !== 'undefined' ? window.innerWidth : 360)
  const mapTranslate = computeMapTranslate({ open, isDragging, dragOffset })
  const mapCurtainClip = computeMapCurtainClip({ open, isDragging, dragOffset, panelWidth })
  const handleInset = computeHandleInset({ open, isDragging, dragOffset })
  const handleWidthPx = resolveHandleWidthPx({ open, isDragging })
  const handleCompact = open && !isDragging
  const showHandleHint = !handleHintDismissed && !open && !isDragging
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
          'roteiro-mobile-map-panel roteiro-map-surface absolute inset-y-0 right-0 z-20 w-full overflow-hidden bg-gray-200 dark:bg-gray-900/50 shadow-[-8px_0_32px_-10px_rgba(0,0,0,0.35)] lg:hidden' +
          (dragSuppressed ? ' roteiro-mobile-map-drag-suppressed' : '')
        }
        style={{
          transform: mapTranslate,
          clipPath: mapCurtainClip,
          transition: transitionStyle,
          opacity: dragSuppressed ? 0 : open || dragOffset < -8 ? 1 : 0,
          pointerEvents: dragSuppressed ? 'none' : open || dragOffset < -20 ? 'auto' : 'none',
        }}
        aria-hidden={!open}
      >
        <div
          className="roteiro-mobile-map-curtain-edge pointer-events-none absolute inset-y-0 left-0 z-[1] w-3"
          aria-hidden
        />
        <ItineraryDayMap
          tripId={tripId}
          day={day}
          activities={activities}
          accommodations={accommodations}
          disabled={disabled}
          routeRestricted={routeRestricted}
          highlightedIndex={highlightedIndex}
          preferLocalRoute={preferLocalRoute}
          className="absolute inset-0 h-full w-full"
          ariaLabel={`Mapa do roteiro — dia ${day}`}
          mapLayoutWatch={open ? `open-${day}` : 'closed'}
          showAccommodationRoutes={showAccommodationRoutes}
          onShowAccommodationRoutesChange={onShowAccommodationRoutesChange}
        />
      </div>

      <button
        type="button"
        aria-expanded={open}
        aria-label={open ? 'Fechar mapa' : 'Abrir mapa do dia'}
        className={
          'roteiro-mobile-map-handle absolute z-30 flex flex-col items-center justify-center touch-none select-none lg:hidden ' +
          (dragSuppressed ? 'roteiro-mobile-map-drag-suppressed ' : '') +
          (handleCompact
            ? 'roteiro-mobile-map-handle--compact rounded-r-xl border border-l-0 border-[#d4a82a] bg-primary text-[#1c1c0d] ' +
              'shadow-primary-glow dark:shadow-primary-glow-dark ring-1 ring-[#1c1c0d]/10 active:brightness-95'
            : 'roteiro-mobile-map-handle--peek top-0 bottom-0 gap-1 border-l border-r border-[#d4a82a] ' +
              'bg-primary text-[#1c1c0d] active:brightness-95 ' +
              (showHandleHint
                ? 'shadow-[-6px_0_20px_-4px_rgba(254,198,65,0.55)] roteiro-mobile-map-handle--hint'
                : 'shadow-[-2px_0_10px_-6px_rgba(0,0,0,0.16)]'))
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
            <Icon name="map" className="text-[1.2rem] text-[#1c1c0d] shrink-0" aria-hidden />
            <span
              className="text-[9px] font-black uppercase tracking-[0.14em] text-[#1c1c0d]/85 leading-none"
              style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
            >
              Mapa
            </span>
            <span className="roteiro-mobile-map-grabber flex flex-col items-center gap-[3px] mt-0.5" aria-hidden>
              <span className="block h-3 w-[2px] rounded-full bg-[#1c1c0d]/40" />
              <span className="block h-3 w-[2px] rounded-full bg-[#1c1c0d]/40" />
            </span>
          </>
        ) : null}
        <Icon
          name={open ? 'chevron_right' : 'chevron_left'}
          className={`shrink-0 ${handleCompact ? 'text-lg text-[#1c1c0d]' : 'text-sm text-[#1c1c0d]/75 mt-0.5'}`}
          aria-hidden
        />
      </button>
    </>
  )
}
