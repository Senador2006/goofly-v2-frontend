import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '../common/Icon'
import { useT } from '../../i18n'

const TRANSITION_MS = 280
/** Acima do MobileNav (z-[1100]) e demais chrome do layout. */
const OVERLAY_Z = 'z-[1200]'

/**
 * Loading bloqueante enquanto finalize-tdv (n8n) roda — não dismissível.
 * Renderiza em portal no body para cobrir a navbar mobile (fora do stacking do <main>).
 */
export function FinalizeItineraryOverlay({ open }) {
  const t = useT()
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (open) {
      setMounted(true)
      const frame = requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true))
      })
      return () => cancelAnimationFrame(frame)
    }
    setVisible(false)
    const timer = setTimeout(() => setMounted(false), TRANSITION_MS)
    return () => clearTimeout(timer)
  }, [open])

  useEffect(() => {
    if (!mounted) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [mounted])

  if (!mounted || typeof document === 'undefined') return null

  return createPortal(
    <div
      className={`fixed inset-0 ${OVERLAY_Z} flex items-center justify-center p-4 sm:p-6`}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-labelledby="finalize-itinerary-title"
      aria-describedby="finalize-itinerary-desc"
    >
      <div
        className={`absolute inset-0 bg-foreground/45 dark:bg-black/70 backdrop-blur-[4px] transition-opacity duration-300 ease-out motion-reduce:transition-none ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
        aria-hidden
      />

      <div
        className={`relative flex flex-col items-center text-center max-w-sm w-full px-6 py-8 transition-all duration-300 ease-out motion-reduce:transition-none ${
          visible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-[0.96] translate-y-3'
        }`}
      >
        <div className="relative size-16 sm:size-[4.5rem] mb-6" aria-hidden>
          <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping motion-reduce:animate-none opacity-60" />
          <div className="relative flex size-full items-center justify-center rounded-full bg-primary/15 dark:bg-primary/25 border border-primary/35 shadow-primary-glow dark:shadow-primary-glow-dark">
            <Icon
              name="auto_awesome"
              className="text-3xl sm:text-4xl text-primary animate-pulse motion-reduce:animate-none"
            />
          </div>
          <div className="absolute -inset-1 rounded-full border-2 border-primary/30 border-t-primary animate-spin motion-reduce:animate-none" />
        </div>

        <h2
          id="finalize-itinerary-title"
          className="text-xl sm:text-2xl font-black tracking-tight text-white dark:text-white leading-tight drop-shadow-sm"
        >
          {t('tdv.finalize_preparing_title')}
        </h2>
        <p
          id="finalize-itinerary-desc"
          className="mt-2.5 text-sm sm:text-base text-white/80 dark:text-white/75 leading-relaxed"
        >
          {t('tdv.finalize_preparing_subtitle')}
        </p>
      </div>
    </div>,
    document.body,
  )
}
