import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '../common/Icon'

const SWIPE_THRESHOLD_PX = 40
const DRAG_START_PX = 6
const SLIDE_MS = 280
const SLIDE_EASE = 'cubic-bezier(0.32, 0.72, 0, 1)'

/**
 * Conteúdo do balão Leaflet de uma parada do roteiro:
 * carrossel compacto (quando há fotos) + ordem/nome/horário.
 *
 * @param {{
 *   order?: number | null
 *   name?: string | null
 *   startTime?: string | null
 *   imageUrls?: string[] | null
 * }} props
 */
export function ItineraryMapStopPopup({ order, name, startTime, imageUrls }) {
  const urls = useMemo(
    () => (Array.isArray(imageUrls) ? imageUrls.filter(Boolean) : []),
    [imageUrls],
  )
  const [index, setIndex] = useState(0)
  const [failed, setFailed] = useState(() => new Set())
  const [dragOffsetPx, setDragOffsetPx] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const dragRef = useRef(null)

  const urlsKey = urls.join('|')
  useEffect(() => {
    setIndex(0)
    setFailed(new Set())
    setDragOffsetPx(0)
    setIsDragging(false)
    dragRef.current = null
  }, [urlsKey])

  const working = useMemo(
    () => urls.filter((url) => !failed.has(url)),
    [urls, failed],
  )
  const hasImages = working.length > 0
  const hasMultiple = working.length > 1
  const safeIndex = Math.min(Math.max(0, index), Math.max(0, working.length - 1))

  const title =
    order != null ? `${order}. ${name || ''}`.trim() : name || ''
  const altBase =
    order != null
      ? `Parada ${order}${name ? ` — ${name}` : ''}`
      : name || 'Parada do roteiro'

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

  const endDrag = (e, { cancelled = false } = {}) => {
    const start = dragRef.current
    dragRef.current = null
    setIsDragging(false)
    setDragOffsetPx(0)
    if (!start || cancelled || !hasMultiple) return

    const dx = e.clientX - start.x
    const dy = e.clientY - start.y
    const adx = Math.abs(dx)
    const ady = Math.abs(dy)
    if (adx < SWIPE_THRESHOLD_PX || adx < ady) return
    e.stopPropagation()
    e.preventDefault()
    if (dx < 0) goNext(e)
    else goPrev(e)
  }

  const onPointerDown = (e) => {
    if (!hasMultiple) return
    if (e.pointerType === 'mouse' && e.button !== 0) return
    if (e.target?.closest?.('[data-map-popup-arrow]')) return
    e.stopPropagation()
    dragRef.current = {
      x: e.clientX,
      y: e.clientY,
      pointerId: e.pointerId,
      axis: null,
    }
    setIsDragging(true)
    setDragOffsetPx(0)
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId)
    } catch {
      /* ignore */
    }
  }

  const onPointerMove = (e) => {
    const start = dragRef.current
    if (!start || start.pointerId !== e.pointerId || !hasMultiple) return
    const dx = e.clientX - start.x
    const dy = e.clientY - start.y
    if (start.axis == null) {
      if (Math.abs(dx) < DRAG_START_PX && Math.abs(dy) < DRAG_START_PX) return
      start.axis = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y'
    }
    if (start.axis !== 'x') return
    e.stopPropagation()
    setDragOffsetPx(dx)
  }

  const onPointerUp = (e) => {
    if (dragRef.current?.pointerId != null && e.pointerId !== dragRef.current.pointerId) {
      return
    }
    endDrag(e)
  }

  const onPointerCancel = (e) => {
    endDrag(e, { cancelled: true })
  }

  const slideTransform = `translateX(calc(-${safeIndex * 100}% + ${dragOffsetPx}px))`
  const slideTransition = isDragging
    ? 'none'
    : `transform ${SLIDE_MS}ms ${SLIDE_EASE}`

  return (
    <div
      className="goofly-map-stop-popup__inner"
      onWheel={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {hasImages ? (
        <div
          className="goofly-map-stop-popup__cover"
          role="region"
          aria-roledescription="carrossel"
          aria-label={
            hasMultiple
              ? `Fotos de ${altBase} — ${safeIndex + 1} de ${working.length}`
              : `Foto de ${altBase}`
          }
        >
          <div
            className={`goofly-map-stop-popup__track-wrap${hasMultiple ? ' goofly-map-stop-popup__track-wrap--swipe' : ''}`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
          >
            {hasMultiple ? (
              <div
                className="goofly-map-stop-popup__track motion-reduce:transition-none"
                style={{
                  transform: slideTransform,
                  transition: slideTransition,
                }}
              >
                {working.map((url, i) => (
                  <div
                    key={`${url}-${i}`}
                    className="goofly-map-stop-popup__slide"
                  >
                    <img
                      src={url}
                      alt={
                        i === safeIndex
                          ? `${altBase}, foto ${i + 1} de ${working.length}`
                          : ''
                      }
                      loading={i === safeIndex ? 'eager' : 'lazy'}
                      decoding="async"
                      className="goofly-map-stop-popup__img"
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
                className="goofly-map-stop-popup__img"
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
                className="goofly-map-stop-popup__arrow goofly-map-stop-popup__arrow--prev"
                aria-label="Foto anterior"
                onClick={goPrev}
              >
                <Icon name="chevron_left" className="text-base" />
              </button>
              <button
                type="button"
                data-map-popup-arrow
                className="goofly-map-stop-popup__arrow goofly-map-stop-popup__arrow--next"
                aria-label="Próxima foto"
                onClick={goNext}
              >
                <Icon name="chevron_right" className="text-base" />
              </button>
              <div
                className="goofly-map-stop-popup__dots"
                role="status"
                aria-live="polite"
                aria-label={`Foto ${safeIndex + 1} de ${working.length}`}
              >
                {working.map((_, i) => (
                  <span
                    key={`dot-${i}`}
                    className={`goofly-map-stop-popup__dot${
                      i === safeIndex ? ' goofly-map-stop-popup__dot--active' : ''
                    }`}
                  />
                ))}
              </div>
            </>
          ) : null}
        </div>
      ) : null}

      <div className="goofly-map-stop-popup__body">
        <p className="m-0 text-sm font-bold text-foreground dark:text-white line-clamp-2">
          {title}
        </p>
        {startTime ? (
          <p className="m-0 text-xs text-text-secondary mt-1">{startTime}</p>
        ) : null}
      </div>
    </div>
  )
}
