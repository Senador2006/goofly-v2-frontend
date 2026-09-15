import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '../common/Icon'

const DISMISS_DISTANCE_PX = 72
const DISMISS_VELOCITY = 0.55
const SWIPE_THRESHOLD_PX = 40
const DRAG_START_PX = 6
const SLIDE_MS = 280
const SLIDE_EASE = 'cubic-bezier(0.32, 0.72, 0, 1)'

/**
 * Peek card compacto no mapa mobile para paradas (e stacks).
 * Espelha o sheet de refeição + seletor de stack do desktop + carrossel de fotos.
 *
 * @param {{
 *   order?: number | null
 *   name?: string | null
 *   startTime?: string | null
 *   imageUrls?: string[] | null
 *   stackMembers?: Array<{
 *     pinId: string
 *     order?: number | null
 *     name?: string | null
 *   }> | null
 *   selectedPinId?: string | null
 *   onSelectStackMember?: ((pinId: string) => void) | null
 *   onDismiss?: (() => void) | null
 * }} props
 */
export function ItineraryStopMapSheet({
  order = null,
  name = null,
  startTime = null,
  imageUrls = null,
  stackMembers = null,
  selectedPinId = null,
  onSelectStackMember = null,
  onDismiss = null,
}) {
  const members = Array.isArray(stackMembers) ? stackMembers : []
  const isStack = members.length > 1
  const placeName = (name && String(name).trim()) || 'Parada do roteiro'
  const dialogLabel =
    order != null ? `Parada ${order}: ${placeName}` : placeName
  const altBase =
    order != null ? `Parada ${order} — ${placeName}` : placeName
  const orderLabel = order != null ? String(order) : '·'
  const timeLabel = startTime ? String(startTime).slice(0, 5) : ''

  const urls = useMemo(
    () => (Array.isArray(imageUrls) ? imageUrls.filter(Boolean) : []),
    [imageUrls],
  )

  const dragRef = useRef({
    active: false,
    startY: 0,
    lastY: 0,
    lastT: 0,
    velocity: 0,
  })
  const carouselDragRef = useRef(null)
  const [dragY, setDragY] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [exiting, setExiting] = useState(false)
  const [index, setIndex] = useState(0)
  const [failed, setFailed] = useState(() => new Set())
  const [carouselOffsetPx, setCarouselOffsetPx] = useState(0)
  const [carouselDragging, setCarouselDragging] = useState(false)

  const urlsKey = urls.join('|')
  const resetKey = `${selectedPinId || ''}|${placeName}|${order ?? ''}|${urlsKey}|${members.length}`

  useEffect(() => {
    setDragY(0)
    setDragging(false)
    setExiting(false)
    setIndex(0)
    setFailed(new Set())
    setCarouselOffsetPx(0)
    setCarouselDragging(false)
    carouselDragRef.current = null
  }, [resetKey])

  const working = useMemo(
    () => urls.filter((url) => !failed.has(url)),
    [urls, failed],
  )
  const hasImages = working.length > 0
  const hasMultiple = working.length > 1
  const safeIndex = Math.min(Math.max(0, index), Math.max(0, working.length - 1))

  const finishDismiss = useCallback(() => {
    if (typeof onDismiss !== 'function') return
    setExiting(true)
    setDragY(160)
    window.setTimeout(() => onDismiss(), 160)
  }, [onDismiss])

  const goPrev = useCallback(
    (e) => {
      e?.stopPropagation?.()
      e?.preventDefault?.()
      setIndex((i) => (i <= 0 ? working.length - 1 : i - 1))
    },
    [working.length],
  )

  const goNext = useCallback(
    (e) => {
      e?.stopPropagation?.()
      e?.preventDefault?.()
      setIndex((i) => (i >= working.length - 1 ? 0 : i + 1))
    },
    [working.length],
  )

  const onImgError = useCallback((url) => {
    setFailed((prev) => {
      const next = new Set(prev)
      next.add(url)
      return next
    })
    setIndex(0)
  }, [])

  const onSheetPointerDown = useCallback((e) => {
    if (e.button != null && e.button !== 0) return
    if (e.target?.closest?.('button, a, [data-stop-sheet-carousel]')) return
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

  const onSheetPointerMove = useCallback((e) => {
    if (!dragRef.current.active) return
    const dy = Math.max(0, e.clientY - dragRef.current.startY)
    const now = performance.now()
    const dt = Math.max(1, now - dragRef.current.lastT)
    dragRef.current.velocity = (e.clientY - dragRef.current.lastY) / dt
    dragRef.current.lastY = e.clientY
    dragRef.current.lastT = now
    setDragY(dy)
  }, [])

  const onSheetPointerUp = useCallback(
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

  const endCarouselDrag = (e, { cancelled = false } = {}) => {
    const start = carouselDragRef.current
    carouselDragRef.current = null
    setCarouselDragging(false)
    setCarouselOffsetPx(0)
    if (!start || cancelled || !hasMultiple) return

    const dx = e.clientX - start.x
    const dy = e.clientY - start.y
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX || Math.abs(dx) < Math.abs(dy)) return
    e.stopPropagation()
    e.preventDefault()
    if (dx < 0) goNext(e)
    else goPrev(e)
  }

  const onCarouselPointerDown = (e) => {
    if (!hasMultiple) return
    if (e.pointerType === 'mouse' && e.button !== 0) return
    if (e.target?.closest?.('[data-map-popup-arrow]')) return
    e.stopPropagation()
    carouselDragRef.current = {
      x: e.clientX,
      y: e.clientY,
      pointerId: e.pointerId,
      axis: null,
    }
    setCarouselDragging(true)
    setCarouselOffsetPx(0)
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId)
    } catch {
      /* ignore */
    }
  }

  const onCarouselPointerMove = (e) => {
    const start = carouselDragRef.current
    if (!start || start.pointerId !== e.pointerId || !hasMultiple) return
    const dx = e.clientX - start.x
    const dy = e.clientY - start.y
    if (start.axis == null) {
      if (Math.abs(dx) < DRAG_START_PX && Math.abs(dy) < DRAG_START_PX) return
      start.axis = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y'
    }
    if (start.axis !== 'x') return
    e.stopPropagation()
    setCarouselOffsetPx(dx)
  }

  const onCarouselPointerUp = (e) => {
    if (
      carouselDragRef.current?.pointerId != null &&
      e.pointerId !== carouselDragRef.current.pointerId
    ) {
      return
    }
    endCarouselDrag(e)
  }

  const onCarouselPointerCancel = (e) => {
    endCarouselDrag(e, { cancelled: true })
  }

  const sheetStyle = {
    transform: `translateY(${dragY}px)`,
    transition: dragging || exiting ? 'none' : 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)',
    opacity: exiting ? Math.max(0.15, 1 - dragY / 160) : Math.max(0.4, 1 - dragY / 220),
  }

  const slideTransform = `translateX(calc(-${safeIndex * 100}% + ${carouselOffsetPx}px))`
  const slideTransition = carouselDragging
    ? 'none'
    : `transform ${SLIDE_MS}ms ${SLIDE_EASE}`

  return (
    <div
      className="goofly-stop-map-sheet pointer-events-auto absolute inset-x-0 bottom-8 z-[600] px-2.5"
      role="dialog"
      aria-label={isStack ? `${members.length} paradas neste ponto` : dialogLabel}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="goofly-stop-map-sheet__card mx-auto max-w-lg select-none overflow-hidden rounded-2xl border border-zinc-200/90 dark:border-white/[0.1] bg-white dark:bg-[#141414] shadow-[0_10px_28px_-8px_rgba(0,0,0,0.5),0_0_0_1px_rgba(254,198,65,0.18)] dark:shadow-[0_12px_32px_-8px_rgba(0,0,0,0.72),0_0_0_1px_rgba(254,198,65,0.28)]"
        style={sheetStyle}
        onPointerDown={onSheetPointerDown}
        onPointerMove={onSheetPointerMove}
        onPointerUp={onSheetPointerUp}
        onPointerCancel={onSheetPointerUp}
        data-stack={isStack ? 'true' : undefined}
      >
        {/* Header — número no primary do pin (#FEC641); chrome neutro */}
        <div
          className={`flex items-center gap-2.5 px-3 pt-2.5 touch-none ${
            hasImages || isStack ? 'pb-2' : 'pb-2.5'
          }`}
        >
          <span
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#FEC641] text-[#1c1c0d] text-sm font-extrabold shadow-sm"
            aria-hidden
          >
            {orderLabel}
          </span>

          <div className="min-w-0 flex-1">
            <p className="m-0 truncate text-[13px] font-bold leading-tight text-foreground dark:text-white">
              {placeName}
            </p>
            {timeLabel || hasMultiple ? (
              <p className="m-0 mt-0.5 truncate text-[11px] font-medium leading-tight text-text-secondary">
                {[timeLabel || null, hasMultiple ? `${safeIndex + 1}/${working.length} fotos` : null]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            ) : null}
          </div>

          {typeof onDismiss === 'function' ? (
            <button
              type="button"
              aria-label="Fechar"
              onClick={finishDismiss}
              className="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-text-secondary hover:bg-black/5 dark:hover:bg-white/10"
            >
              <Icon name="close" className="text-lg" aria-hidden />
            </button>
          ) : null}
        </div>

        {isStack ? (
          <div className="goofly-stop-map-sheet__switcher touch-none px-3 pb-2">
            <p className="m-0 mb-1.5 text-[10px] font-bold uppercase tracking-wide text-text-secondary">
              {members.length} paradas neste ponto
            </p>
            <div
              className="flex gap-1.5 overflow-x-auto no-scrollbar"
              role="listbox"
              aria-label="Escolher parada"
            >
              {members.map((m) => {
                const isSelected = selectedPinId === m.pinId
                const label = m.order != null ? String(m.order) : '·'
                return (
                  <button
                    key={m.pinId}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    title={m.name || (m.order != null ? `Parada ${m.order}` : 'Parada')}
                    className={
                      'inline-flex h-7 min-w-7 shrink-0 items-center justify-center rounded-full px-2.5 text-[11px] font-extrabold transition-colors ' +
                      (isSelected
                        ? 'bg-[#FEC641] text-[#1c1c0d] shadow-sm'
                        : 'bg-zinc-100 text-zinc-700 dark:bg-white/[0.08] dark:text-white/80')
                    }
                    onClick={(e) => {
                      e.stopPropagation()
                      if (typeof onSelectStackMember === 'function') {
                        onSelectStackMember(m.pinId)
                      }
                    }}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
        ) : null}

        {hasImages ? (
          <div
            data-stop-sheet-carousel
            className={
              'goofly-stop-map-sheet__cover relative mx-3 mb-3 overflow-hidden rounded-xl bg-black/5 dark:bg-white/5' +
              (isStack ? ' goofly-stop-map-sheet__cover--stack' : '')
            }
            role="region"
            aria-roledescription="carrossel"
            aria-label={
              hasMultiple
                ? `Fotos de ${altBase} — ${safeIndex + 1} de ${working.length}`
                : `Foto de ${altBase}`
            }
          >
            <div
              className={`goofly-stop-map-sheet__track-wrap${hasMultiple ? ' goofly-stop-map-sheet__track-wrap--swipe' : ''}`}
              onPointerDown={onCarouselPointerDown}
              onPointerMove={onCarouselPointerMove}
              onPointerUp={onCarouselPointerUp}
              onPointerCancel={onCarouselPointerCancel}
            >
              {hasMultiple ? (
                <div
                  className="goofly-stop-map-sheet__track motion-reduce:transition-none"
                  style={{
                    transform: slideTransform,
                    transition: slideTransition,
                  }}
                >
                  {working.map((url, i) => (
                    <div key={`${url}-${i}`} className="goofly-stop-map-sheet__slide">
                      <img
                        src={url}
                        alt={
                          i === safeIndex
                            ? `${altBase}, foto ${i + 1} de ${working.length}`
                            : ''
                        }
                        loading={i === safeIndex ? 'eager' : 'lazy'}
                        decoding="async"
                        className="goofly-stop-map-sheet__img"
                        draggable={false}
                        onError={() => onImgError(url)}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <img
                  src={working[0]}
                  alt={altBase}
                  loading="lazy"
                  decoding="async"
                  className="goofly-stop-map-sheet__img"
                  draggable={false}
                  onError={() => onImgError(working[0])}
                />
              )}
            </div>

            {hasMultiple ? (
              <>
                <button
                  type="button"
                  data-map-popup-arrow
                  className="goofly-stop-map-sheet__arrow goofly-stop-map-sheet__arrow--prev"
                  aria-label="Foto anterior"
                  onClick={goPrev}
                >
                  <Icon name="chevron_left" className="text-base" />
                </button>
                <button
                  type="button"
                  data-map-popup-arrow
                  className="goofly-stop-map-sheet__arrow goofly-stop-map-sheet__arrow--next"
                  aria-label="Próxima foto"
                  onClick={goNext}
                >
                  <Icon name="chevron_right" className="text-base" />
                </button>
                <div
                  className="goofly-stop-map-sheet__dots"
                  role="status"
                  aria-live="polite"
                  aria-label={`Foto ${safeIndex + 1} de ${working.length}`}
                >
                  {working.map((_, i) => (
                    <span
                      key={`dot-${i}`}
                      className={`goofly-stop-map-sheet__dot${
                        i === safeIndex ? ' goofly-stop-map-sheet__dot--active' : ''
                      }`}
                    />
                  ))}
                </div>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
