import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '../common/Icon'

const INSIGHTS_POPOVER_Z = 1200
const INSIGHTS_POPOVER_WIDTH_PX = 352

/**
 * @param {{ summary?: string, aiInsights?: string, stats?: Record<string, number> | null, optimizationFailed?: boolean }} meta
 */
export function resolveOptimizerInsights(meta) {
  if (!meta || typeof meta !== 'object') return null
  const summary = String(meta.summary || '').trim()
  const aiInsights = String(meta.aiInsights || meta.ai_insights || '').trim()
  const stats = meta.stats ?? null
  const optimizationFailed = meta.optimizationFailed === true
  const optimizationRunning = meta.status === 'running'
  if (!summary && !aiInsights && !stats && !optimizationFailed && !optimizationRunning) return null
  return { summary, aiInsights, stats, optimizationFailed, optimizationRunning }
}

/** @param {Record<string, number> | null | undefined} stats */
function formatOptimizerStats(stats) {
  if (!stats || typeof stats !== 'object') return null
  const parts = []
  if (Number.isFinite(Number(stats.totalActivities)) && Number(stats.totalActivities) > 0) {
    parts.push(`${stats.totalActivities} paradas`)
  }
  if (Number.isFinite(Number(stats.totalMealPlaces)) && Number(stats.totalMealPlaces) > 0) {
    parts.push(`${stats.totalMealPlaces} sugestões gastronômicas`)
  }
  if (Number.isFinite(Number(stats.tdvLikeCount)) && Number(stats.tdvLikeCount) > 0) {
    parts.push(`${stats.tdvLikeCount} do TDV`)
  }
  if (Number.isFinite(Number(stats.aiSuggestedCount)) && Number(stats.aiSuggestedCount) > 0) {
    parts.push(`${stats.aiSuggestedCount} sugeridas pela IA`)
  }
  return parts.length > 0 ? parts.join(' · ') : null
}

/**
 * Conteúdo compartilhado do resumo/insights do otimizador.
 *
 * @param {{
 *   resolved: ReturnType<typeof resolveOptimizerInsights>
 *   optimizationScore?: number | null
 *   onReoptimize?: (() => void) | null
 *   reoptimizing?: boolean
 *   detailsOpen?: boolean
 *   onDetailsOpenChange?: ((open: boolean) => void) | null
 * }} props
 */
export function ItineraryOptimizerInsightsPanel({
  resolved,
  optimizationScore = null,
  onReoptimize = null,
  reoptimizing = false,
  detailsOpen = false,
  onDetailsOpenChange = null,
}) {
  if (!resolved) return null

  const { summary, aiInsights, stats, optimizationFailed, optimizationRunning } = resolved
  const statsLine = formatOptimizerStats(stats)
  const hasDetails = Boolean(aiInsights)
  const scoreLabel =
    !optimizationFailed &&
    !optimizationRunning &&
    optimizationScore != null &&
    Number.isFinite(Number(optimizationScore)) &&
    Number(optimizationScore) > 0
      ? `${Math.round(Number(optimizationScore))}% otimizado`
      : null

  const toggleDetails = () => {
    if (typeof onDetailsOpenChange === 'function') {
      onDetailsOpenChange(!detailsOpen)
    }
  }

  return (
    <div className="flex items-start gap-2.5">
      <Icon
        name={optimizationFailed ? 'warning' : optimizationRunning ? 'hourglass_top' : 'auto_awesome'}
        className={`text-lg shrink-0 mt-0.5 ${
          optimizationFailed
            ? 'text-amber-700 dark:text-amber-300'
            : optimizationRunning
              ? 'text-primary'
              : 'text-primary'
        }`}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <p
            className={
              'text-[10px] font-bold uppercase tracking-wide ' +
              (optimizationFailed ? 'text-amber-900 dark:text-amber-200' : 'text-primary/90')
            }
          >
            {optimizationFailed
              ? 'Roteiro provisório'
              : optimizationRunning
                ? 'Otimizando roteiro…'
                : 'Roteiro otimizado'}
          </p>
          {scoreLabel ? (
            <span className="text-[10px] font-bold uppercase tracking-wide text-[#45340a] dark:text-primary bg-primary/20 px-2 py-0.5 rounded-full">
              {scoreLabel}
            </span>
          ) : null}
        </div>
        {summary ? (
          <p className="text-sm text-[#1c1c0d] dark:text-white leading-relaxed">{summary}</p>
        ) : null}
        {statsLine ? (
          <p className="text-xs text-text-secondary mt-1.5 leading-relaxed">{statsLine}</p>
        ) : null}
        {optimizationFailed && onReoptimize ? (
          <button
            type="button"
            disabled={reoptimizing}
            onClick={onReoptimize}
            className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 hover:bg-amber-500/30 disabled:opacity-60 px-3 py-1.5 text-xs font-bold text-amber-950 dark:text-amber-100 transition-colors"
          >
            <Icon name="refresh" className="text-sm" aria-hidden />
            {reoptimizing ? 'Reotimizando…' : 'Reotimizar roteiro'}
          </button>
        ) : null}
        {hasDetails ? (
          <>
            <button
              type="button"
              className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
              aria-expanded={detailsOpen}
              onClick={toggleDetails}
            >
              {detailsOpen
                ? 'Ocultar detalhes'
                : optimizationFailed
                  ? 'Por que isso aconteceu?'
                  : 'Ver insights da IA'}
              <Icon name={detailsOpen ? 'expand_less' : 'expand_more'} className="text-base" aria-hidden />
            </button>
            {detailsOpen ? (
              <p className="mt-2 text-xs sm:text-sm text-text-secondary leading-relaxed whitespace-pre-line">
                {aiInsights}
              </p>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  )
}

/** Banner com resumo e insights da IA do otimizador. */
export function ItineraryOptimizerInsights({
  optimizerMeta,
  optimizationScore = null,
  onReoptimize = null,
  reoptimizing = false,
  className = '',
}) {
  const resolved = resolveOptimizerInsights(optimizerMeta)
  const [open, setOpen] = useState(false)

  if (!resolved) return null

  const { optimizationFailed } = resolved

  return (
    <div
      className={
        `mb-4 rounded-2xl border px-4 py-3.5 sm:px-5 sm:py-4 ${className} ` +
        (optimizationFailed
          ? 'border-amber-500/40 bg-gradient-to-br from-amber-500/12 to-transparent dark:from-amber-500/15'
          : 'border-primary/30 bg-gradient-to-br from-primary/[0.07] to-transparent dark:from-primary/15')
      }
      role="region"
      aria-label={optimizationFailed ? 'Roteiro provisório' : 'Resumo do roteiro otimizado'}
    >
      <ItineraryOptimizerInsightsPanel
        resolved={resolved}
        optimizationScore={optimizationScore}
        onReoptimize={onReoptimize}
        reoptimizing={reoptimizing}
        detailsOpen={open}
        onDetailsOpenChange={setOpen}
      />
    </div>
  )
}

/** Balão de insights acionado por ícone de info no cabeçalho da viagem. */
export function ItineraryOptimizerInsightsPopover({
  optimizerMeta,
  optimizationScore = null,
  onReoptimize = null,
  reoptimizing = false,
  className = '',
  tabIndex = undefined,
}) {
  const resolved = resolveOptimizerInsights(optimizerMeta)
  const [open, setOpen] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [popoverStyle, setPopoverStyle] = useState(/** @type {Record<string, string | number>} */ ({}))
  const buttonRef = useRef(/** @type {HTMLButtonElement | null} */ (null))
  const panelRef = useRef(/** @type {HTMLDivElement | null} */ (null))
  const panelId = useId()

  const updatePopoverPosition = () => {
    const button = buttonRef.current
    if (!button) return

    const rect = button.getBoundingClientRect()
    const gap = 10
    const width = Math.min(INSIGHTS_POPOVER_WIDTH_PX, window.innerWidth - 16)
    const left = Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8))
    const spaceBelow = window.innerHeight - rect.bottom - gap - 8
    const spaceAbove = rect.top - gap - 8
    const placeAbove = spaceBelow < 180 && spaceAbove > spaceBelow

    setPopoverStyle({
      position: 'fixed',
      left,
      width,
      zIndex: INSIGHTS_POPOVER_Z,
      ...(placeAbove
        ? { bottom: window.innerHeight - rect.top + gap, top: 'auto' }
        : { top: rect.bottom + gap, bottom: 'auto' }),
    })
  }

  useLayoutEffect(() => {
    if (!open) return undefined
    updatePopoverPosition()
    const onReposition = () => updatePopoverPosition()
    window.addEventListener('resize', onReposition)
    window.addEventListener('scroll', onReposition, true)
    return () => {
      window.removeEventListener('resize', onReposition)
      window.removeEventListener('scroll', onReposition, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return undefined

    const onPointerDown = (event) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (buttonRef.current?.contains(target) || panelRef.current?.contains(target)) return
      setOpen(false)
    }

    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  useEffect(() => {
    if (!open) setDetailsOpen(false)
  }, [open])

  if (!resolved) return null

  const { optimizationFailed } = resolved

  const panel = open ? (
    <div
      ref={panelRef}
      id={panelId}
      role="dialog"
      aria-label={optimizationFailed ? 'Roteiro provisório' : 'Resumo do roteiro otimizado'}
      style={popoverStyle}
      className={
        'rounded-2xl border px-4 py-3.5 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.35)] sm:px-5 sm:py-4 ' +
        (optimizationFailed
          ? 'border-amber-500/40 bg-white dark:bg-[#23220f]'
          : 'border-primary/30 bg-white dark:bg-[#23220f]')
      }
    >
      <ItineraryOptimizerInsightsPanel
        resolved={resolved}
        optimizationScore={optimizationScore}
        onReoptimize={onReoptimize}
        reoptimizing={reoptimizing}
        detailsOpen={detailsOpen}
        onDetailsOpenChange={setDetailsOpen}
      />
    </div>
  ) : null

  return (
    <>
      <div className={`relative z-[3] inline-flex shrink-0 ${className}`}>
        <button
          ref={buttonRef}
          type="button"
          tabIndex={tabIndex}
          className={
            'inline-flex size-8 min-w-8 min-h-8 lg:min-w-10 lg:min-h-10 items-center justify-center rounded-xl border font-bold transition-colors ' +
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-card-dark ' +
            (open
              ? 'border-primary bg-primary/20 text-primary shadow-[0_0_0_3px_rgba(254,198,65,0.35)]'
              : 'border-primary/45 bg-primary/10 text-primary shadow-sm hover:bg-primary/20 active:bg-primary/30 ' +
                'dark:border-primary/40 dark:bg-primary/15')
          }
          title={optimizationFailed ? 'Sobre o roteiro provisório' : 'Resumo do roteiro otimizado'}
          aria-label={optimizationFailed ? 'Sobre o roteiro provisório' : 'Resumo do roteiro otimizado'}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((value) => !value)}
        >
          <Icon name="info" className="text-lg lg:text-xl" aria-hidden />
        </button>
      </div>
      {typeof document !== 'undefined' && panel ? createPortal(panel, document.body) : null}
    </>
  )
}
