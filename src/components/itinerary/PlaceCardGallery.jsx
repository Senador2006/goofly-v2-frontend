import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '../common/Icon'
import { getPlaceImageUrls } from '../../utils/placeImages'
import { PLACEHOLDER_COVER } from '../../constants/placeholders'

const SWIPE_THRESHOLD_PX = 48
const SLIDE_MS = 420

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
  const touchStartX = useRef(null)

  const placeKey = place?.id ?? place?.placeId ?? place?.place_id ?? place?.name

  useEffect(() => {
    setIndex(0)
    setFailed(new Set())
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
                <div className="relative min-w-full w-full h-full flex-shrink-0 overflow-hidden" key={`${url}-${i}`}>
                  <img
                    src={url}
                    alt=""
                    className={`absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out motion-reduce:transition-none ${
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
          <SingleImage
            src={workingImages[0]}
            onError={() => onImgError(workingImages[0])}
          />
        )}
      </div>

      {hasMultiple && (
        <div className="absolute inset-0 z-[30] pointer-events-none">
          <button
            type="button"
            onClick={goPrev}
            className="pointer-events-auto absolute left-2 top-1/2 -translate-y-1/2 size-10 sm:size-11 rounded-full bg-black/45 text-white flex items-center justify-center backdrop-blur-sm hover:bg-black/60 active:scale-95 transition-all border border-white/20"
            aria-label="Foto anterior"
          >
            <Icon name="chevron_left" className="text-2xl" />
          </button>
          <button
            type="button"
            onClick={goNext}
            className="pointer-events-auto absolute right-2 top-1/2 -translate-y-1/2 size-10 sm:size-11 rounded-full bg-black/45 text-white flex items-center justify-center backdrop-blur-sm hover:bg-black/60 active:scale-95 transition-all border border-white/20"
            aria-label="Próxima foto"
          >
            <Icon name="chevron_right" className="text-2xl" />
          </button>

          <button
            type="button"
            className="pointer-events-auto absolute left-0 top-0 bottom-0 w-[28%] cursor-pointer border-0 bg-transparent p-0"
            aria-label="Foto anterior"
            onClick={goPrev}
          />
          <button
            type="button"
            className="pointer-events-auto absolute right-0 top-0 bottom-0 w-[28%] cursor-pointer border-0 bg-transparent p-0"
            aria-label="Próxima foto"
            onClick={goNext}
          />

          <p
            className="absolute top-3 right-3 m-0 px-2.5 py-1 rounded-full bg-black/50 text-white text-[10px] sm:text-xs font-bold backdrop-blur-sm tabular-nums transition-opacity duration-300"
            aria-live="polite"
          >
            {safeIndex + 1} / {workingImages.length}
          </p>
        </div>
      )}
    </>
  )
}

function SingleImage({ src, onError }) {
  const isPlaceholder = src === PLACEHOLDER_COVER
  return (
    <img
      src={src}
      alt=""
      className={`absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105 motion-reduce:transition-none ${
        isPlaceholder ? 'opacity-90' : ''
      }`}
      onError={isPlaceholder ? undefined : onError}
      draggable={false}
    />
  )
}
