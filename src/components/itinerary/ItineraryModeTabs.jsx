import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { Icon } from '../common/Icon'

const SLIDE_MS = 300
const SLIDE_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)'

/**
 * Abas Roteiro / TDV / Documentos com pill amarelo deslizante.
 *
 * @param {{
 *   activeTab: 'roteiro' | 'tdv' | 'documentos'
 *   onRoteiro: () => void
 *   onTdv: () => void
 *   onDocumentos: () => void
 *   tdvLocked?: boolean
 *   tdvLockTitle?: string
 *   finalizing?: boolean
 *   hasFullAccess?: boolean
 *   isPlanning?: boolean
 *   onDeletePlanning?: () => void
 * }} props
 */
export function ItineraryModeTabs({
  activeTab,
  onRoteiro,
  onTdv,
  onDocumentos,
  tdvLocked = false,
  tdvLockTitle,
  finalizing = false,
  hasFullAccess = true,
  isPlanning = false,
  onDeletePlanning,
}) {
  const listRef = useRef(null)
  const indicatorRef = useRef(null)
  const tabRefs = useRef(new Map())
  const prevRef = useRef(null)
  const [reducedMotion, setReducedMotion] = useState(false)

  useLayoutEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReducedMotion(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  const placeIndicator = useCallback(
    (animate) => {
      const indicator = indicatorRef.current
      const list = listRef.current
      const activeEl = tabRefs.current.get(activeTab)
      if (!indicator || !list || !activeEl) return

      const listBox = list.getBoundingClientRect()
      const tabBox = activeEl.getBoundingClientRect()
      const next = {
        left: tabBox.left - listBox.left,
        width: tabBox.width,
        height: tabBox.height,
        top: tabBox.top - listBox.top,
      }

      const prev = prevRef.current
      const canSlide =
        animate &&
        !reducedMotion &&
        prev != null &&
        prev.tab !== activeTab &&
        Math.abs(prev.left - next.left) >= 1

      if (canSlide) {
        // FLIP num único reflow — sem double-rAF (evita “travada” no arranque).
        indicator.style.transition = 'none'
        indicator.style.width = `${prev.width}px`
        indicator.style.height = `${prev.height}px`
        indicator.style.transform = `translate3d(${prev.left}px, ${prev.top}px, 0)`
        indicator.style.opacity = '1'
        void indicator.offsetWidth
        indicator.style.transition = `transform ${SLIDE_MS}ms ${SLIDE_EASING}, width ${SLIDE_MS}ms ${SLIDE_EASING}, height ${SLIDE_MS}ms ${SLIDE_EASING}`
        indicator.style.width = `${next.width}px`
        indicator.style.height = `${next.height}px`
        indicator.style.transform = `translate3d(${next.left}px, ${next.top}px, 0)`
      } else {
        indicator.style.transition = 'none'
        indicator.style.width = `${next.width}px`
        indicator.style.height = `${next.height}px`
        indicator.style.transform = `translate3d(${next.left}px, ${next.top}px, 0)`
        indicator.style.opacity = '1'
      }

      prevRef.current = { ...next, tab: activeTab }
    },
    [activeTab, reducedMotion],
  )

  useLayoutEffect(() => {
    placeIndicator(true)
  }, [placeIndicator])

  useLayoutEffect(() => {
    const onResize = () => placeIndicator(false)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [placeIndicator])

  const tabClass = (id) => {
    const selected = activeTab === id
    return `relative z-[1] shrink-0 px-2.5 sm:px-3.5 lg:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-colors disabled:cursor-not-allowed ${
      selected
        ? 'text-black'
        : id === 'tdv' && tdvLocked
          ? 'text-text-secondary'
          : 'text-text-secondary hover:text-[#1c1c0d] dark:hover:text-white'
    }`
  }

  return (
    <div
      ref={listRef}
      className={`relative flex w-max max-w-none flex-nowrap items-center gap-1.5 rounded-2xl border border-zinc-200/80 bg-zinc-100/90 p-1 dark:border-white/[0.08] dark:bg-white/[0.06] sm:gap-2 ${
        finalizing ? 'pointer-events-none opacity-60' : ''
      }`}
      aria-disabled={finalizing || undefined}
      role="tablist"
      aria-label="Modos do planejamento"
    >
      <span
        ref={indicatorRef}
        className="pointer-events-none absolute left-0 top-0 z-0 rounded-xl bg-primary shadow-md"
        aria-hidden
        style={{ opacity: 0 }}
      />

      <button
        type="button"
        role="tab"
        aria-selected={activeTab === 'roteiro'}
        disabled={finalizing}
        ref={(el) => {
          if (el) tabRefs.current.set('roteiro', el)
          else tabRefs.current.delete('roteiro')
        }}
        onClick={onRoteiro}
        className={tabClass('roteiro')}
      >
        Roteiro
      </button>

      <button
        type="button"
        role="tab"
        aria-selected={activeTab === 'tdv'}
        aria-disabled={tdvLocked || undefined}
        disabled={finalizing}
        title={tdvLocked ? tdvLockTitle : undefined}
        ref={(el) => {
          if (el) tabRefs.current.set('tdv', el)
          else tabRefs.current.delete('tdv')
        }}
        onClick={onTdv}
        className={`${tabClass('tdv')} flex items-center gap-1.5`}
      >
        TDV
        {tdvLocked ? <Icon name="lock" className="text-xs opacity-80" /> : null}
      </button>

      <button
        type="button"
        role="tab"
        aria-selected={activeTab === 'documentos'}
        disabled={finalizing}
        ref={(el) => {
          if (el) tabRefs.current.set('documentos', el)
          else tabRefs.current.delete('documentos')
        }}
        onClick={onDocumentos}
        className={`${tabClass('documentos')} flex items-center gap-1.5`}
      >
        <Icon name="folder_shared" className="text-sm" />
        <span className="hidden sm:inline">Documentos</span>
        <span className="sm:hidden">Docs</span>
        {!hasFullAccess ? <Icon name="lock" className="text-xs opacity-70" /> : null}
      </button>

      {isPlanning ? (
        <button
          type="button"
          disabled={finalizing}
          onClick={onDeletePlanning}
          aria-label="Apagar planejamento"
          title="Apagar planejamento"
          className="relative z-[1] flex shrink-0 items-center justify-center rounded-xl px-2.5 py-2 text-red-600 transition-colors hover:bg-red-500/10 disabled:cursor-not-allowed dark:text-red-400 lg:hidden"
        >
          <Icon name="delete" className="text-base" />
        </button>
      ) : null}
    </div>
  )
}
