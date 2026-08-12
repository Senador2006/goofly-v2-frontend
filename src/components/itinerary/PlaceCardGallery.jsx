import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '../common/Icon'
import { getPlaceImageUrls, getRealPlaceImageUrls } from '../../utils/placeImages'
import { PLACEHOLDER_COVER } from '../../constants/placeholders'

const SWIPE_THRESHOLD_PX = 48
const SLIDE_MS = 320
const SLIDE_EASE = 'cubic-bezier(0.32, 0.72, 0, 1)'
const DRAG_START_PX = 6
const DISMISS_THRESHOLD_PX = 96
const DISMISS_MS = 260

function isMobileLightboxViewport() {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches
}

function isDesktopViewport() {
  return typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches
}

function ImageLightbox({ urls, index, onClose, onPrev, onNext }) {
  const dragRef = useRef(null)
  const dismissTimerRef = useRef(null)
  const [dragOffsetPx, setDragOffsetPx] = useState(0)
  const [dismissY, setDismissY] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [isDismissing, setIsDismissing] = useState(false)
  const hasMultiple = urls.length > 1
  const safeIdx = Math.min(Math.max(0, index), urls.length - 1)

  useEffect(() => {
    setDragOffsetPx(0)
    setDismissY(0)
    setIsDragging(false)
    dragRef.current = null
  }, [index])

  useEffect(() => {
    return () => {
      if (dismissTimerRef.current != null) window.clearTimeout(dismissTimerRef.current)
    }
  }, [])

  const runDismiss = useCallback(() => {
    if (isDismissing) return
    setIsDismissing(true)
    setIsDragging(false)
    setDragOffsetPx(0)
    setDismissY((y) => Math.max(y, typeof window !== 'undefined' ? window.innerHeight * 0.4 : 280))
    dismissTimerRef.current = window.setTimeout(() => {
      onClose()
    }, DISMISS_MS)
  }, [isDismissing, onClose])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        if (isMobileLightboxViewport()) runDismiss()
        else onClose()
        return
      }
      if (!hasMultiple || isDismissing) return
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        e.stopPropagation()
        onPrev(e)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        e.stopPropagation()
        onNext(e)
      }
    }
    // Capture: senão o TinderView recebe ← → e interpreta como curtir/descartar.
    window.addEventListener('keydown', onKey, true)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey, true)
      document.body.style.overflow = prevOverflow
    }
  }, [onClose, onPrev, onNext, hasMultiple, isDismissing, runDismiss])

  const endLightboxDrag = (e, { cancelled = false } = {}) => {
    const start = dragRef.current
    dragRef.current = null
    setIsDragging(false)
    if (!start || cancelled || isDismissing) {
      setDragOffsetPx(0)
      if (!isDismissing) setDismissY(0)
      return
    }

    // Desktop: sem swap por arraste.
    if (isDesktopViewport()) {
      setDragOffsetPx(0)
      setDismissY(0)
      return
    }

    const dx = e.clientX - start.x
    const dy = e.clientY - start.y
    const adx = Math.abs(dx)
    const ady = Math.abs(dy)

    // Puxar para baixo fecha (só mobile).
    if (start.axis === 'y' && dy >= DISMISS_THRESHOLD_PX) {
      e.stopPropagation()
      runDismiss()
      return
    }

    setDismissY(0)
    setDragOffsetPx(0)

    if (!hasMultiple || start.axis !== 'x' || adx < SWIPE_THRESHOLD_PX || adx < ady) return
    e.stopPropagation()
    if (dx < 0) onNext(e)
    else onPrev(e)
  }

  const onPointerDown = (e) => {
    if (isDismissing) return
    // Desktop: sem gesto de arraste (só setas / clique fora).
    if (isDesktopViewport()) return
    if (e.pointerType === 'mouse' && e.button !== 0) return
    if (e.target?.closest?.('[data-lightbox-chrome]')) return
    e.stopPropagation()
    dragRef.current = {
      x: e.clientX,
      y: e.clientY,
      pointerId: e.pointerId,
      axis: null,
    }
    setIsDragging(true)
    setDragOffsetPx(0)
    setDismissY(0)
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId)
    } catch {
      /* ignore */
    }
  }

  const onPointerMove = (e) => {
    const start = dragRef.current
    if (!start || start.pointerId !== e.pointerId || isDismissing) return
    const dx = e.clientX - start.x
    const dy = e.clientY - start.y
    if (start.axis == null) {
      if (Math.abs(dx) < DRAG_START_PX && Math.abs(dy) < DRAG_START_PX) return
      start.axis = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y'
    }
    if (start.axis === 'x') {
      if (!hasMultiple) return
      setDismissY(0)
      setDragOffsetPx(dx)
      return
    }
    setDragOffsetPx(0)
    setDismissY(Math.max(0, dy))
  }

  const onPointerUp = (e) => {
    if (dragRef.current?.pointerId != null && e.pointerId !== dragRef.current.pointerId) {
      return
    }
    endLightboxDrag(e)
  }

  const onPointerCancel = (e) => {
    endLightboxDrag(e, { cancelled: true })
  }

  const trackTransform = `translateX(calc(-${safeIdx * 100}% + ${dragOffsetPx}px))`
  const trackTransition = isDragging || isDismissing
    ? 'none'
    : `transform ${SLIDE_MS}ms ${SLIDE_EASE}`

  const dismissProgress = Math.min(1, dismissY / (DISMISS_THRESHOLD_PX * 2.2))
  const sheetOpacity = isDismissing ? 0 : Math.max(0.25, 1 - dismissProgress * 0.75)
  const contentScale = isDismissing ? 0.92 : Math.max(0.9, 1 - dismissProgress * 0.08)
  const contentTransition =
    isDragging && !isDismissing
      ? 'none'
      : `transform ${DISMISS_MS}ms ${SLIDE_EASE}, opacity ${DISMISS_MS}ms ${SLIDE_EASE}`

  const desktopNavBtnClass =
    'pointer-events-auto flex size-12 shrink-0 items-center justify-center rounded-full border border-white/25 bg-black/50 text-white backdrop-blur-md transition-colors hover:bg-black/65 active:scale-95'

  // Portal em document.body: o card TDV usa z-index baixo; sem isso o fixed ficaria
  // preso ao contexto de empilhamento do card e o cabeçalho da página cortaria a foto.
  // Mobile: canvas imersivo + chrome seguro. Desktop (lg+): layout anterior intacto.
  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex flex-col bg-black lg:items-center lg:justify-center lg:bg-black/90 lg:p-6 lg:backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={
        hasMultiple
          ? 'Fotos ampliadas — use as setas para navegar'
          : 'Foto ampliada'
      }
      style={{
        opacity: sheetOpacity,
        transition: isDragging && !isDismissing ? 'none' : `opacity ${DISMISS_MS}ms ${SLIDE_EASE}`,
      }}
      onClick={() => {
        if (isMobileLightboxViewport()) runDismiss()
        else onClose()
      }}
    >
      {/* Fechar — acima de tudo no desktop (evita colidir com contador) */}
      <button
        type="button"
        data-lightbox-chrome
        className="pointer-events-auto absolute right-4 top-4 z-20 flex size-11 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white backdrop-blur-md transition-colors hover:bg-white/20 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 lg:right-6 lg:top-6 lg:border-0 lg:bg-white/15 lg:hover:bg-white/25 lg:active:scale-100"
        aria-label="Fechar foto"
        onClick={(e) => {
          e.stopPropagation()
          if (isMobileLightboxViewport()) runDismiss()
          else onClose()
        }}
      >
        <Icon name="close" className="text-2xl" />
      </button>

      {/* Top chrome mobile — indicadores */}
      <div
        data-lightbox-chrome
        className="pointer-events-none absolute inset-x-0 top-0 z-[2] flex items-start justify-between gap-3 px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] lg:hidden"
        style={{
          opacity: Math.max(0, 1 - dismissProgress * 1.4),
          transition: isDragging && !isDismissing ? 'none' : `opacity ${DISMISS_MS}ms ${SLIDE_EASE}`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <span className="size-11 shrink-0" aria-hidden />

        {hasMultiple ? (
          <div
            className="pointer-events-none flex min-w-0 flex-1 items-center justify-center"
            role="status"
            aria-live="polite"
            aria-label={`Foto ${safeIdx + 1} de ${urls.length}`}
          >
            <div className="flex max-w-full items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 shadow-[0_2px_12px_rgba(0,0,0,0.35)] backdrop-blur-md">
              <div className="flex max-w-[min(12rem,42vw)] items-center gap-1.5 overflow-hidden">
                {urls.map((_, i) => (
                  <span
                    key={`lb-dot-${i}`}
                    className={`h-1.5 shrink-0 rounded-full transition-[width,background-color,opacity] duration-300 ease-out motion-reduce:transition-none ${
                      i === safeIdx
                        ? 'w-4 bg-white'
                        : 'w-1.5 bg-white/55'
                    }`}
                  />
                ))}
              </div>
              <span className="text-[11px] font-semibold tabular-nums tracking-wide text-white/90">
                {safeIdx + 1}/{urls.length}
              </span>
            </div>
          </div>
        ) : (
          <span className="flex-1" aria-hidden />
        )}

        <span className="size-11 shrink-0" aria-hidden />
      </div>

      {/* Mobile: imagem full-bleed com gestos */}
      <div
        className={`relative flex min-h-0 w-full flex-1 touch-none items-center justify-center overflow-hidden px-0 pb-[max(2.75rem,calc(env(safe-area-inset-bottom)+2rem))] pt-16 lg:hidden ${
          hasMultiple ? 'cursor-grab active:cursor-grabbing' : ''
        }`}
        style={{
          transform: `translateY(${dismissY}px) scale(${contentScale})`,
          opacity: isDismissing ? 0 : 1,
          transition: contentTransition,
        }}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        {hasMultiple ? (
          <>
            <button
              type="button"
              data-lightbox-chrome
              className="group absolute left-0 top-1/2 z-[1] flex h-20 w-12 -translate-y-1/2 items-center justify-start pl-1 text-white"
              aria-label="Foto anterior"
              onClick={(e) => {
                e.stopPropagation()
                onPrev(e)
              }}
            >
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/30 via-black/10 to-transparent opacity-0 transition-opacity duration-150 group-active:opacity-100"
              />
              <Icon
                name="chevron_left"
                className="relative z-[1] text-[1.85rem] drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]"
              />
            </button>
            <button
              type="button"
              data-lightbox-chrome
              className="group absolute right-0 top-1/2 z-[1] flex h-20 w-12 -translate-y-1/2 items-center justify-end pr-1 text-white"
              aria-label="Próxima foto"
              onClick={(e) => {
                e.stopPropagation()
                onNext(e)
              }}
            >
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-gradient-to-l from-black/30 via-black/10 to-transparent opacity-0 transition-opacity duration-150 group-active:opacity-100"
              />
              <Icon
                name="chevron_right"
                className="relative z-[1] text-[1.85rem] drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]"
              />
            </button>
          </>
        ) : null}

        {hasMultiple ? (
          <div
            className="flex h-full w-full motion-reduce:transition-none"
            style={{
              transform: trackTransform,
              transition: trackTransition,
            }}
          >
            {urls.map((src, i) => (
              <div
                key={`lb-slide-m-${src}-${i}`}
                className="flex h-full min-w-full w-full flex-shrink-0 items-center justify-center"
              >
                <img
                  src={src}
                  alt=""
                  className="max-h-full max-w-full object-contain"
                  draggable={false}
                />
              </div>
            ))}
          </div>
        ) : (
          <img
            src={urls[safeIdx] ?? urls[0]}
            alt=""
            className="max-h-full max-w-full object-contain"
            draggable={false}
          />
        )}
      </div>

      {/* Desktop: setas fora da foto + contador embaixo — sem overlap com o X */}
      <div
        className="relative hidden max-h-[min(88vh,1200px)] w-full max-w-6xl items-center justify-center gap-4 lg:flex"
        onClick={(e) => e.stopPropagation()}
      >
        {hasMultiple ? (
          <button
            type="button"
            data-lightbox-chrome
            className={desktopNavBtnClass}
            aria-label="Foto anterior"
            onClick={(e) => {
              e.stopPropagation()
              onPrev(e)
            }}
          >
            <Icon name="chevron_left" className="text-3xl" />
          </button>
        ) : (
          <span className="size-12 shrink-0" aria-hidden />
        )}

        <div className="relative flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-hidden">
          {hasMultiple ? (
            <div
              className="flex max-h-[min(88vh,1200px)] w-full motion-reduce:transition-none"
              style={{
                transform: trackTransform,
                transition: trackTransition,
              }}
            >
              {urls.map((src, i) => (
                <div
                  key={`lb-slide-d-${src}-${i}`}
                  className="flex max-h-[min(88vh,1200px)] min-w-full w-full flex-shrink-0 items-center justify-center"
                >
                  <img
                    src={src}
                    alt=""
                    className="max-h-[min(88vh,1200px)] max-w-full object-contain shadow-2xl"
                    draggable={false}
                  />
                </div>
              ))}
            </div>
          ) : (
            <img
              src={urls[safeIdx] ?? urls[0]}
              alt=""
              className="max-h-[min(88vh,1200px)] max-w-full object-contain shadow-2xl"
              draggable={false}
            />
          )}
          {hasMultiple ? (
            <p
              className="pointer-events-none absolute bottom-3 left-1/2 z-[1] m-0 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1.5 text-xs font-bold tabular-nums text-white backdrop-blur-sm"
              aria-live="polite"
            >
              {safeIdx + 1} / {urls.length}
            </p>
          ) : null}
        </div>

        {hasMultiple ? (
          <button
            type="button"
            data-lightbox-chrome
            className={desktopNavBtnClass}
            aria-label="Próxima foto"
            onClick={(e) => {
              e.stopPropagation()
              onNext(e)
            }}
          >
            <Icon name="chevron_right" className="text-3xl" />
          </button>
        ) : (
          <span className="size-12 shrink-0" aria-hidden />
        )}
      </div>

      {/* Hint discreto no mobile — reforça swipe sem poluir */}
      {hasMultiple ? (
        <p
          className="pointer-events-none absolute inset-x-0 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-[1] m-0 px-4 text-center text-[11px] font-medium tracking-wide text-white/45 lg:hidden"
          style={{ opacity: Math.max(0, 0.45 * (1 - dismissProgress * 2)) }}
        >
          Deslize para trocar · puxe para fechar
        </p>
      ) : (
        <p
          className="pointer-events-none absolute inset-x-0 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-[1] m-0 px-4 text-center text-[11px] font-medium tracking-wide text-white/45 lg:hidden"
          style={{ opacity: Math.max(0, 0.45 * (1 - dismissProgress * 2)) }}
        >
          Puxe para baixo para fechar
        </p>
      )}
    </div>,
    document.body
  )
}

/**
 * Galeria do card TDV (abordagem C): setas + toque nas laterais + arraste na imagem.
 * Mobile (full): indicadores em cápsula fosca + setas em vinheta nas bordas;
 *   teclado ← → no TinderView = curtir/descartar.
 * Desktop (full): botões circulares + teclado ← → troca fotos (sem swap por arraste).
 * Compact: setas circulares menores.
 *
 * `variant="compact"`: uso no roteiro (abaixo da descrição), com layout relativo e controles menores.
 *
 * Camadas (irmãs do gradiente/texto no TinderView): imagem z-0, controles z-20.
 */
export function PlaceCardGallery({ place, className = '', variant = 'full' }) {
  const isCompact = variant === 'compact'
  const images = useMemo(
    () => (isCompact ? getRealPlaceImageUrls(place) : getPlaceImageUrls(place)),
    [place, isCompact]
  )
  const [index, setIndex] = useState(0)
  const [failed, setFailed] = useState(() => new Set())
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [dragOffsetPx, setDragOffsetPx] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const dragPointerRef = useRef(null)
  const interactLayerRef = useRef(null)

  const placeKey = place?.id ?? place?.placeId ?? place?.place_id ?? place?.name

  useEffect(() => {
    setIndex(0)
    setFailed(new Set())
    setLightboxOpen(false)
    setDragOffsetPx(0)
    setIsDragging(false)
    dragPointerRef.current = null
  }, [placeKey])

  const workingImages = useMemo(() => {
    const ok = images.filter((url) => !failed.has(url))
    if (ok.length > 0) return ok
    return isCompact ? [] : [PLACEHOLDER_COVER]
  }, [images, failed, isCompact])

  const safeIndex = Math.min(Math.max(0, index), Math.max(0, workingImages.length - 1))
  const hasMultiple = workingImages.length > 1
  const hasImages = workingImages.length > 0

  const goPrev = useCallback(
    (e) => {
      e?.stopPropagation?.()
      e?.preventDefault?.()
      setIndex((i) => (i <= 0 ? workingImages.length - 1 : i - 1))
    },
    [workingImages.length]
  )

  const goNext = useCallback(
    (e) => {
      e?.stopPropagation?.()
      e?.preventDefault?.()
      setIndex((i) => (i >= workingImages.length - 1 ? 0 : i + 1))
    },
    [workingImages.length]
  )

  // Desktop: ← → trocam fotos no card (mobile reserva as teclas para like/dislike).
  useEffect(() => {
    if (!hasMultiple || isCompact || lightboxOpen) return undefined
    const onKey = (e) => {
      if (!isDesktopViewport()) return
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        e.stopPropagation()
        goPrev(e)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        e.stopPropagation()
        goNext(e)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [hasMultiple, isCompact, lightboxOpen, goPrev, goNext])

  const onImgError = useCallback((url) => {
    setFailed((prev) => {
      const next = new Set(prev)
      next.add(url)
      return next
    })
    setIndex(0)
  }, [])

  const closeLightbox = useCallback(() => setLightboxOpen(false), [])

  const openLightboxFromMiddle = useCallback((e) => {
    e?.stopPropagation?.()
    setLightboxOpen(true)
  }, [])

  if (isCompact && !hasImages) return null

  const onMiddleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      openLightboxFromMiddle(e)
    }
  }

  const endDrag = (e, { cancelled = false } = {}) => {
    const start = dragPointerRef.current
    dragPointerRef.current = null
    setIsDragging(false)
    setDragOffsetPx(0)
    if (!start || cancelled) return

    const dx = e.clientX - start.x
    const dy = e.clientY - start.y
    const adx = Math.abs(dx)
    const ady = Math.abs(dy)

    if (hasMultiple && adx >= SWIPE_THRESHOLD_PX && adx >= ady) {
      // Desktop: sem swap por arraste — só setas / clique nas laterais.
      if (!isDesktopViewport()) {
        e.stopPropagation()
        e.preventDefault()
        if (dx < 0) goNext(e)
        else goPrev(e)
        return
      }
    }

    // Toque curto: compact = ampliar; full = laterais trocam / centro amplia
    if (adx < SWIPE_THRESHOLD_PX && ady < SWIPE_THRESHOLD_PX) {
      e.stopPropagation()
      if (isCompact) {
        openLightboxFromMiddle(e)
        return
      }
      const layer = interactLayerRef.current
      if (!layer || !hasMultiple) {
        openLightboxFromMiddle(e)
        return
      }
      const rect = layer.getBoundingClientRect()
      const ratio = rect.width > 0 ? (start.x - rect.left) / rect.width : 0.5
      if (ratio < 0.28) goPrev(e)
      else if (ratio > 0.72) goNext(e)
      else openLightboxFromMiddle(e)
    }
  }

  const onInteractPointerDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    if (e.target?.closest?.('[data-gallery-arrow]')) return
    e.stopPropagation()
    dragPointerRef.current = {
      x: e.clientX,
      y: e.clientY,
      pointerId: e.pointerId,
      axis: null,
    }
    // Desktop: sem follow do dedo (só detecta clique).
    setIsDragging(!isDesktopViewport())
    setDragOffsetPx(0)
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId)
    } catch {
      /* ignore */
    }
  }

  const onInteractPointerMove = (e) => {
    const start = dragPointerRef.current
    if (!start || start.pointerId !== e.pointerId) return
    if (!hasMultiple || isDesktopViewport()) return
    const dx = e.clientX - start.x
    const dy = e.clientY - start.y
    if (start.axis == null) {
      if (Math.abs(dx) < DRAG_START_PX && Math.abs(dy) < DRAG_START_PX) return
      start.axis = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y'
    }
    if (start.axis !== 'x') return
    setDragOffsetPx(dx)
  }

  const onInteractPointerUp = (e) => {
    if (dragPointerRef.current?.pointerId != null && e.pointerId !== dragPointerRef.current.pointerId) {
      return
    }
    endDrag(e)
  }

  const onInteractPointerCancel = (e) => {
    endDrag(e, { cancelled: true })
  }

  const mediaShellClass = isCompact
    ? 'absolute inset-0 z-0 overflow-hidden'
    : `absolute inset-0 z-0 overflow-hidden ${className}`
  // Compact / desktop: botão circular clássico. Mobile (full): setas em borda com
  // vinheta — contraste estável em qualquer foto sem cobrir o centro do card.
  const arrowBtnClass = isCompact
    ? 'pointer-events-auto absolute left-2 top-1/2 z-[40] flex size-8 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/45 text-white backdrop-blur-sm transition-all hover:bg-black/60 active:scale-95'
    : 'pointer-events-auto absolute left-2 top-1/2 z-[40] hidden size-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-black/40 text-white shadow-sm backdrop-blur-md transition-all hover:border-white/40 hover:bg-black/55 active:scale-95 lg:flex'
  const arrowBtnNextClass = isCompact
    ? 'pointer-events-auto absolute right-2 top-1/2 z-[40] flex size-8 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/45 text-white backdrop-blur-sm transition-all hover:bg-black/60 active:scale-95'
    : 'pointer-events-auto absolute right-2 top-1/2 z-[40] hidden size-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-black/40 text-white shadow-sm backdrop-blur-md transition-all hover:border-white/40 hover:bg-black/55 active:scale-95 lg:flex'
  const mobileEdgeArrowPrevClass =
    'group pointer-events-auto absolute left-0 top-1/2 z-[40] flex h-[4.5rem] w-11 -translate-y-1/2 items-center justify-start pl-1 text-white lg:hidden'
  const mobileEdgeArrowNextClass =
    'group pointer-events-auto absolute right-0 top-1/2 z-[40] flex h-[4.5rem] w-11 -translate-y-1/2 items-center justify-end pr-1 text-white lg:hidden'
  const counterClass = isCompact
    ? 'pointer-events-none absolute right-3 top-3 z-[40] m-0 rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-bold tabular-nums text-white backdrop-blur-sm'
    : 'pointer-events-none absolute right-3 top-3 m-0 hidden rounded-full border border-white/15 bg-black/55 px-2.5 py-1 text-xs font-bold tabular-nums text-white shadow-sm backdrop-blur-md transition-opacity duration-300 lg:block'

  const stopCardToggle = (e) => {
    e?.stopPropagation?.()
  }

  const slideTransform = `translateX(calc(-${safeIndex * 100}% + ${dragOffsetPx}px))`
  const slideTransition = isDragging
    ? 'none'
    : `transform ${SLIDE_MS}ms ${SLIDE_EASE}`

  const galleryBody = (
    <>
      <div className={mediaShellClass}>
        {hasMultiple ? (
          <div
            className="flex h-full will-change-transform motion-reduce:transition-none"
            style={{
              transform: slideTransform,
              transition: slideTransition,
            }}
          >
            {workingImages.map((url, i) => {
              const isPlaceholder = url === PLACEHOLDER_COVER
              const isActive = i === safeIndex
              return (
                <div className="relative min-h-full min-w-full w-full flex-shrink-0 overflow-hidden" key={`${url}-${i}`}>
                  <img
                    src={url}
                    alt=""
                    className={`absolute inset-0 h-full w-full object-cover object-center transition-transform duration-700 ease-out motion-reduce:transition-none ${
                      isActive && !isCompact ? 'group-hover:scale-105' : ''
                    } ${isPlaceholder ? 'opacity-90' : ''}`}
                    onError={isPlaceholder ? undefined : () => onImgError(url)}
                    draggable={false}
                  />
                </div>
              )
            })}
          </div>
        ) : (
          <SingleImage
            src={workingImages[0]}
            onError={() => onImgError(workingImages[0])}
            enableHoverScale={!isCompact}
          />
        )}
      </div>

      <div className="pointer-events-none absolute inset-0 z-[30] overflow-hidden rounded-[inherit]">
        {isCompact ? (
          <div
            ref={interactLayerRef}
            className={`pointer-events-auto absolute inset-0 z-[35] touch-pan-y border-0 bg-transparent p-0 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/60 ${
              hasMultiple ? 'cursor-grab active:cursor-grabbing' : 'cursor-zoom-in'
            }`}
            role="button"
            tabIndex={0}
            aria-label={
              hasMultiple
                ? 'Arraste para mudar de foto ou toque para ampliar'
                : 'Ver foto em tamanho maior'
            }
            onPointerDown={onInteractPointerDown}
            onPointerMove={onInteractPointerMove}
            onPointerUp={onInteractPointerUp}
            onPointerCancel={onInteractPointerCancel}
            onKeyDown={onMiddleKeyDown}
          />
        ) : (
          <>
            {/* Mobile: superfície única com swipe */}
            <div
              ref={interactLayerRef}
              className={`pointer-events-auto absolute inset-0 z-[35] touch-pan-y border-0 bg-transparent p-0 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/60 lg:hidden ${
                hasMultiple ? 'cursor-grab active:cursor-grabbing' : 'cursor-zoom-in'
              }`}
              role="button"
              tabIndex={0}
              aria-label={
                hasMultiple
                  ? 'Arraste para mudar de foto ou toque para ampliar'
                  : 'Ver foto em tamanho maior'
              }
              onPointerDown={onInteractPointerDown}
              onPointerMove={onInteractPointerMove}
              onPointerUp={onInteractPointerUp}
              onPointerCancel={onInteractPointerCancel}
              onKeyDown={onMiddleKeyDown}
            />

            {/* Desktop: lupa só no centro (abre lightbox); laterais estreitas só trocam foto */}
            {hasMultiple ? (
              <>
                <button
                  type="button"
                  className="pointer-events-auto absolute bottom-0 left-0 top-0 z-[35] hidden w-[14%] cursor-pointer border-0 bg-transparent p-0 lg:block"
                  aria-label="Foto anterior"
                  onClick={goPrev}
                />
                <button
                  type="button"
                  className="pointer-events-auto absolute bottom-0 left-[14%] right-[14%] top-0 z-[35] hidden cursor-zoom-in border-0 bg-transparent p-0 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/60 lg:block"
                  aria-label="Ver foto em tamanho maior"
                  onClick={openLightboxFromMiddle}
                  onKeyDown={onMiddleKeyDown}
                />
                <button
                  type="button"
                  className="pointer-events-auto absolute bottom-0 right-0 top-0 z-[35] hidden w-[14%] cursor-pointer border-0 bg-transparent p-0 lg:block"
                  aria-label="Próxima foto"
                  onClick={goNext}
                />
              </>
            ) : (
              <button
                type="button"
                className="pointer-events-auto absolute inset-0 z-[35] hidden cursor-zoom-in border-0 bg-transparent p-0 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/60 lg:block"
                aria-label="Ver foto em tamanho maior"
                onClick={openLightboxFromMiddle}
                onKeyDown={onMiddleKeyDown}
              />
            )}
          </>
        )}

        {hasMultiple ? (
          <>
            {!isCompact ? (
              <>
                {/* Mobile: vinheta nas bordas + chevron com sombra — affordance de
                    troca sem botões circulares que competem com like/dislike. */}
                <button
                  type="button"
                  data-gallery-arrow
                  onClick={goPrev}
                  className={mobileEdgeArrowPrevClass}
                  aria-label="Foto anterior"
                >
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/30 via-black/10 to-transparent opacity-0 transition-opacity duration-150 group-active:opacity-100"
                  />
                  <Icon
                    name="chevron_left"
                    className="relative z-[1] text-[1.75rem] drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]"
                  />
                </button>
                <button
                  type="button"
                  data-gallery-arrow
                  onClick={goNext}
                  className={mobileEdgeArrowNextClass}
                  aria-label="Próxima foto"
                >
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 bg-gradient-to-l from-black/30 via-black/10 to-transparent opacity-0 transition-opacity duration-150 group-active:opacity-100"
                  />
                  <Icon
                    name="chevron_right"
                    className="relative z-[1] text-[1.75rem] drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]"
                  />
                </button>
                {/* Indicadores centralizados; botão de curtidas (TinderView) fica menor à direita */}
                <div
                  className="pointer-events-none absolute left-1/2 top-3 z-[40] flex max-w-[min(52%,12rem)] -translate-x-1/2 items-center justify-center lg:hidden"
                  role="status"
                  aria-live="polite"
                  aria-label={`Foto ${safeIndex + 1} de ${workingImages.length}`}
                >
                  <div className="flex max-w-full items-center gap-1.5 overflow-hidden rounded-full border border-white/25 bg-black/55 px-2.5 py-1.5 shadow-[0_2px_12px_rgba(0,0,0,0.45)] backdrop-blur-md">
                    {workingImages.map((_, i) => (
                      <span
                        key={`dot-${i}`}
                        className={`h-1.5 shrink-0 rounded-full transition-[width,background-color,opacity] duration-300 ease-out motion-reduce:transition-none ${
                          i === safeIndex
                            ? 'w-4 bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.35)]'
                            : 'w-1.5 bg-white/65'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </>
            ) : null}
            <button
              type="button"
              data-gallery-arrow
              onClick={goPrev}
              className={arrowBtnClass}
              aria-label="Foto anterior"
            >
              <Icon name="chevron_left" className={isCompact ? 'text-xl' : 'text-2xl'} />
            </button>
            <button
              type="button"
              data-gallery-arrow
              onClick={goNext}
              className={arrowBtnNextClass}
              aria-label="Próxima foto"
            >
              <Icon name="chevron_right" className={isCompact ? 'text-xl' : 'text-2xl'} />
            </button>
            <p className={counterClass} aria-live="polite">
              {safeIndex + 1} / {workingImages.length}
            </p>
          </>
        ) : null}
      </div>

      {lightboxOpen ? (
        <ImageLightbox
          urls={workingImages}
          index={safeIndex}
          onClose={closeLightbox}
          onPrev={goPrev}
          onNext={goNext}
        />
      ) : null}
    </>
  )

  if (isCompact) {
    return (
      <div
        className={`relative h-full w-full overflow-hidden rounded-[inherit] ${className}`}
        onClick={stopCardToggle}
      >
        {galleryBody}
      </div>
    )
  }

  return galleryBody
}

function SingleImage({ src, onError, enableHoverScale = true }) {
  const isPlaceholder = src === PLACEHOLDER_COVER
  return (
    <img
      src={src}
      alt=""
      className={`absolute inset-0 h-full w-full object-cover object-center transition-transform duration-700 ease-out motion-reduce:transition-none ${
        enableHoverScale ? 'group-hover:scale-105' : ''
      } ${isPlaceholder ? 'opacity-90' : ''}`}
      onError={isPlaceholder ? undefined : onError}
      draggable={false}
    />
  )
}
