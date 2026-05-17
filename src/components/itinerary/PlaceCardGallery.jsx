import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '../common/Icon'
import { getPlaceImageUrls } from '../../utils/placeImages'
import { PLACEHOLDER_COVER } from '../../constants/placeholders'

const SWIPE_THRESHOLD_PX = 48
const SLIDE_MS = 420

function ImageLightbox({ url, onClose }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [onClose])

  // Portal em document.body: o card TDV usa z-index baixo; sem isso o fixed ficaria
  // preso ao contexto de empilhamento do card e o cabeçalho da página cortaria a foto.
  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Foto ampliada"
      onClick={onClose}
    >
      <button
        type="button"
        className="absolute right-4 top-4 z-[1] flex size-11 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-md transition-colors hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        aria-label="Fechar foto"
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
      >
        <Icon name="close" className="text-2xl" />
      </button>
      <img
        src={url}
        alt=""
        className="max-h-[min(92vh,1200px)] max-w-full object-contain shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        draggable={false}
      />
    </div>,
    document.body
  )
}

/**
 * Galeria do card TDV (abordagem C): setas + toque nas laterais + arraste na imagem.
 * Teclado ← → do TinderView permanece para curtir/descartar o lugar.
 *
 * Camadas (irmãs do gradiente/texto no TinderView): imagem z-0, controles z-20.
 */
export function PlaceCardGallery({ place, className = '' }) {
  const images = useMemo(() => getPlaceImageUrls(place), [place])
  const [index, setIndex] = useState(0)
  const [failed, setFailed] = useState(() => new Set())
  const [lightboxUrl, setLightboxUrl] = useState(null)
  const touchStartX = useRef(null)
  const middlePointerStartRef = useRef(null)

  const placeKey = place?.id ?? place?.placeId ?? place?.place_id ?? place?.name

  useEffect(() => {
    setIndex(0)
    setFailed(new Set())
    setLightboxUrl(null)
  }, [placeKey])

  const workingImages = useMemo(() => {
    const ok = images.filter((url) => !failed.has(url))
    return ok.length > 0 ? ok : [PLACEHOLDER_COVER]
  }, [images, failed])

  const safeIndex = Math.min(index, workingImages.length - 1)
  const hasMultiple = workingImages.length > 1

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

  const onImgError = useCallback((url) => {
    setFailed((prev) => {
      const next = new Set(prev)
      next.add(url)
      return next
    })
    setIndex(0)
  }, [])

  const closeLightbox = useCallback(() => setLightboxUrl(null), [])

  const openLightboxFromMiddle = useCallback(
    (e) => {
      e?.stopPropagation?.()
      setLightboxUrl(workingImages[safeIndex])
    },
    [workingImages, safeIndex]
  )

  const onMiddlePointerDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    middlePointerStartRef.current = { x: e.clientX, y: e.clientY }
  }

  const onMiddlePointerUp = (e) => {
    const start = middlePointerStartRef.current
    middlePointerStartRef.current = null
    if (!start) return

    const dx = e.clientX - start.x
    const dy = e.clientY - start.y
    const adx = Math.abs(dx)
    const ady = Math.abs(dy)

    if (hasMultiple && adx >= SWIPE_THRESHOLD_PX && adx >= ady) {
      e.stopPropagation()
      e.preventDefault()
      if (dx < 0) goNext(e)
      else goPrev(e)
      return
    }

    if (adx < SWIPE_THRESHOLD_PX && ady < SWIPE_THRESHOLD_PX) {
      e.stopPropagation()
      openLightboxFromMiddle(e)
    }
  }

  const onMiddleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      openLightboxFromMiddle(e)
    }
  }

  const onTouchStart = (e) => {
    if (!hasMultiple || e.touches.length !== 1) return
    touchStartX.current = e.touches[0].clientX
  }

  const onTouchEnd = (e) => {
    if (touchStartX.current == null || !hasMultiple) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    touchStartX.current = null
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX) return
    e.stopPropagation()
    if (dx < 0) goNext(e)
    else goPrev(e)
  }

  return (
    <>
      <div
        className={`absolute inset-0 z-0 overflow-hidden ${className}`}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onTouchCancel={() => {
          touchStartX.current = null
        }}
      >
        {hasMultiple ? (
          <div
            className="flex h-full ease-in-out motion-reduce:transition-none"
            style={{
              transform: `translateX(-${safeIndex * 100}%)`,
              transition: `transform ${SLIDE_MS}ms ease-in-out`,
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
                    className={`absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out motion-reduce:transition-none ${
                      isActive ? 'group-hover:scale-105' : ''
                    } ${isPlaceholder ? 'opacity-90' : ''}`}
                    onError={isPlaceholder ? undefined : () => onImgError(url)}
                    draggable={false}
                  />
                </div>
              )
            })}
          </div>
        ) : (
          <SingleImage src={workingImages[0]} onError={() => onImgError(workingImages[0])} />
        )}
      </div>

      <div className="pointer-events-none absolute inset-0 z-[30]">
        {hasMultiple ? (
          <>
            <button
              type="button"
              onClick={goPrev}
              className="pointer-events-auto absolute left-2 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/45 text-white backdrop-blur-sm transition-all hover:bg-black/60 active:scale-95 sm:size-11"
              aria-label="Foto anterior"
            >
              <Icon name="chevron_left" className="text-2xl" />
            </button>
            <button
              type="button"
              onClick={goNext}
              className="pointer-events-auto absolute right-2 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/45 text-white backdrop-blur-sm transition-all hover:bg-black/60 active:scale-95 sm:size-11"
              aria-label="Próxima foto"
            >
              <Icon name="chevron_right" className="text-2xl" />
            </button>

            <button
              type="button"
              className="pointer-events-auto absolute bottom-0 left-0 top-0 w-[28%] cursor-pointer border-0 bg-transparent p-0"
              aria-label="Foto anterior"
              onClick={goPrev}
            />
            <button
              type="button"
              className="pointer-events-auto absolute bottom-0 right-0 top-0 w-[28%] cursor-pointer border-0 bg-transparent p-0"
              aria-label="Próxima foto"
              onClick={goNext}
            />
          </>
        ) : null}

        <button
          type="button"
          className="pointer-events-auto absolute bottom-0 left-[28%] right-[28%] top-0 cursor-zoom-in border-0 bg-transparent p-0 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/60"
          aria-label="Ver foto em tamanho maior"
          onPointerDown={onMiddlePointerDown}
          onPointerUp={onMiddlePointerUp}
          onPointerCancel={() => {
            middlePointerStartRef.current = null
          }}
          onKeyDown={onMiddleKeyDown}
        />

        {hasMultiple ? (
          <p
            className="pointer-events-none absolute right-3 top-3 m-0 rounded-full bg-black/50 px-2.5 py-1 text-[10px] font-bold tabular-nums text-white backdrop-blur-sm transition-opacity duration-300 sm:text-xs"
            aria-live="polite"
          >
            {safeIndex + 1} / {workingImages.length}
          </p>
        ) : null}
      </div>

      {lightboxUrl ? <ImageLightbox url={lightboxUrl} onClose={closeLightbox} /> : null}
    </>
  )
}

function SingleImage({ src, onError }) {
  const isPlaceholder = src === PLACEHOLDER_COVER
  return (
    <img
      src={src}
      alt=""
      className={`absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out motion-reduce:transition-none group-hover:scale-105 ${
        isPlaceholder ? 'opacity-90' : ''
      }`}
      onError={isPlaceholder ? undefined : onError}
      draggable={false}
    />
  )
}
