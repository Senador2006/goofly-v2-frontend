import { useId } from 'react'
import { Icon } from '../common/Icon'
import {
  formatMealTimeLabel,
  getMealPositionLabel,
  getMealTypeIcon,
  getMealTypeLabel,
  resolveMealActivityId,
  resolveSelectedMealForSlot,
} from '../../utils/itineraryMealHelpers'
import { resolveActivityTitle } from '../../utils/itineraryPrintFormat'

/** @param {Record<string, unknown> | null | undefined} act */
function resolveMealDescription(act) {
  if (!act || typeof act !== 'object') return null
  const candidates = [act.description, act.notes, act.reasoning, act.summary]
  for (const raw of candidates) {
    if (raw == null) continue
    const text = String(raw).trim()
    if (text.length >= 8) return text
  }
  return null
}

/** @param {unknown} raw */
function normalizeHttpUrl(raw) {
  if (raw == null) return ''
  const u = String(raw).trim().replace(/[.,;:!?)\]}>]+$/, '').replace(/^<+|>+$/g, '')
  return /^https?:\/\//i.test(u) ? u : ''
}

/**
 * @param {{
 *   option: Record<string, unknown>
 *   index: number
 *   selected: boolean
 *   onSelect: () => void
 * }} props
 */
function MealOptionRow({ option, index, selected, onSelect }) {
  const title = resolveActivityTitle(option, index)
  const description = resolveMealDescription(option)
  const position = getMealPositionLabel(
    option.mealPosition ?? option.meal_position ?? option.position,
  )
  const mapsUrl = normalizeHttpUrl(
    option.googleMapsUrl ?? option.google_maps_url ?? option.mapsUrl,
  )

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelect()
        }
      }}
      className={
        'group flex gap-2.5 rounded-lg border px-2.5 py-2 transition-all duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ' +
        (selected
          ? 'border-primary bg-primary/10 dark:bg-primary/8'
          : 'border-border-light/80 dark:border-white/10 bg-white/70 dark:bg-[#1a1910]/60 hover:border-primary/40 hover:bg-primary/[0.03]')
      }
      aria-pressed={selected}
    >
      <span
        aria-hidden
        className={
          'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors ' +
          (selected
            ? 'border-primary bg-primary text-[#1c1c0d]'
            : 'border-amber-400/70 dark:border-amber-500/50 bg-transparent')
        }
      >
        {selected ? (
          <Icon name="check" className="text-[11px] font-bold leading-none" />
        ) : null}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <h4 className="text-sm font-semibold text-[#1c1c0d] dark:text-white leading-snug">
            {title}
          </h4>
          {position ? (
            <span className="text-[10px] font-medium text-text-secondary">{position}</span>
          ) : null}
        </div>
        {description ? (
          <p className="text-xs text-text-secondary mt-1 leading-relaxed">{description}</p>
        ) : (
          <p className="text-[11px] italic text-text-secondary/70 mt-1">
            Sugestão gastronômica da IA
          </p>
        )}
        {mapsUrl ? (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(event) => event.stopPropagation()}
            className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 dark:text-amber-200 hover:underline"
          >
            <Icon name="map" className="text-sm shrink-0" aria-hidden />
            Abrir no Maps
          </a>
        ) : null}
      </div>
    </div>
  )
}

/**
 * Bloco compacto de sugestões de refeição na timeline do roteiro.
 *
 * @param {{
 *   mealType: string
 *   startTime: string
 *   options: Record<string, unknown>[]
 *   isLast?: boolean
 *   readOnly?: boolean
 *   selectedId?: string | null
 *   onSelect?: (activityId: string | null) => void
 *   highlighted?: boolean
 *   showMealsOnMap?: boolean
 *   open?: boolean
 *   onOpenChange?: (open: boolean) => void
 *   onViewOnMap?: (() => void) | null
 *   headerRef?: import('react').Ref<HTMLButtonElement> | null
 * }} props
 */
export function ItineraryMealSlotCard({
  mealType,
  startTime,
  options = [],
  isLast = false,
  readOnly = false,
  selectedId: selectedIdProp = null,
  onSelect,
  highlighted = false,
  showMealsOnMap = true,
  open = false,
  onOpenChange,
  onViewOnMap = null,
  headerRef = null,
}) {
  const panelId = useId()

  const mealLabel = getMealTypeLabel(mealType)
  const mealIcon = getMealTypeIcon(mealType)
  const timeLabel = formatMealTimeLabel(startTime)
  const optionCount = options.length

  const selectedOption = resolveSelectedMealForSlot(options, selectedIdProp)
  const effectiveSelectedId = selectedOption ? resolveMealActivityId(selectedOption, 0) : null
  const summaryTitle = selectedOption
    ? resolveActivityTitle(selectedOption, 0)
    : `${optionCount} sugestões`
  const summaryPosition = selectedOption
    ? getMealPositionLabel(
        selectedOption.mealPosition ??
          selectedOption.meal_position ??
          selectedOption.position,
      )
    : null

  const handleHeaderClick = () => {
    onOpenChange?.(!open)
  }

  const handleOptionSelect = (id) => {
    const next = effectiveSelectedId === id ? null : id
    onSelect?.(next)
  }

  return (
    <div className={`relative pl-10${isLast ? '' : ' pb-4'}`}>
      {!isLast ? (
        <div
          className="absolute left-0 top-7 bottom-0 w-px border-l-2 border-dashed border-amber-400/55 dark:border-amber-500/35"
          aria-hidden
        />
      ) : null}

      <span
        aria-hidden
        className={
          'absolute left-[-12px] top-1 z-10 flex size-6 items-center justify-center rounded-full border-2 border-amber-500/75 bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 shadow-sm transition-transform duration-200 ' +
          (highlighted ? 'scale-110 lg:scale-100' : '')
        }
      >
        <Icon name={mealIcon} className="text-[15px]" />
      </span>

      <article
        className={
          'rounded-lg border-2 border-dashed overflow-hidden transition-shadow duration-200 ' +
          (highlighted
            ? 'border-amber-500/75 dark:border-amber-400/55 bg-amber-50/95 dark:bg-amber-950/35 shadow-[0_0_0_4px_rgba(245,158,11,0.25),0_8px_24px_-12px_rgba(245,158,11,0.45)] ring-2 ring-amber-400/40 lg:border-amber-500/70 lg:bg-amber-50/90 dark:lg:bg-amber-950/30 lg:shadow-sm lg:ring-0'
            : 'border-amber-400/40 dark:border-amber-500/25 bg-amber-50/80 dark:bg-amber-950/20 shadow-sm')
        }
      >
        <button
          ref={headerRef}
          type="button"
          id={`${panelId}-trigger`}
          className="roteiro-meal-slot-header w-full text-left px-2.5 py-1.5 min-h-[2.125rem] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg lg:py-1.5"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={handleHeaderClick}
        >
          {/* Mobile: duas linhas legíveis + ação explícita para o mapa */}
          <div className="flex flex-col gap-1.5 lg:hidden">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-amber-900 dark:text-amber-100">
                <Icon name={mealIcon} className="text-sm shrink-0" aria-hidden />
                {mealLabel} · {timeLabel}
              </span>
              <div className="flex shrink-0 items-center gap-1.5">
                {highlighted && showMealsOnMap ? (
                  <span className="inline-flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-800 dark:text-amber-200 bg-amber-400/25 dark:bg-amber-400/15 px-1.5 py-0.5 rounded-full">
                    <span className="size-1 rounded-full bg-amber-600 dark:bg-amber-300" aria-hidden />
                    Mapa
                  </span>
                ) : null}
                {optionCount > 1 ? (
                  <span className="text-[10px] font-semibold text-text-secondary tabular-nums">
                    {optionCount}
                  </span>
                ) : null}
                <Icon
                  name={open ? 'expand_less' : 'expand_more'}
                  className="text-base text-text-secondary"
                  aria-hidden
                />
              </div>
            </div>
            <p className="text-sm font-semibold text-[#1c1c0d] dark:text-white leading-snug">
              {summaryTitle}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {summaryPosition ? (
                <span className="text-[10px] text-text-secondary">{summaryPosition}</span>
              ) : null}
              {!showMealsOnMap ? (
                <span className="text-[10px] text-text-secondary/80 italic">Oculto no mapa</span>
              ) : typeof onViewOnMap === 'function' ? (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    onViewOnMap()
                  }}
                  className="inline-flex items-center gap-1 rounded-full border border-amber-500/45 bg-amber-500/12 px-2 py-0.5 text-[10px] font-bold text-amber-900 dark:text-amber-100"
                >
                  <Icon name="map" className="text-xs shrink-0" aria-hidden />
                  Ver no mapa
                </button>
              ) : null}
            </div>
          </div>

          {/* Desktop: faixa estreita em linha única (inalterada) */}
          <div className="hidden lg:flex items-center gap-2 min-h-[1.375rem]">
            <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-amber-900 dark:text-amber-100 whitespace-nowrap">
              {mealLabel}
              <span className="font-semibold normal-case tracking-normal text-amber-800/90 dark:text-amber-100/90">
                {timeLabel}
              </span>
            </span>
            <span className="shrink-0 text-amber-400/80 dark:text-amber-500/60" aria-hidden>
              ·
            </span>
            <span className="min-w-0 flex-1 text-xs font-semibold text-[#1c1c0d] dark:text-white leading-snug">
              {summaryTitle}
            </span>
            {summaryPosition ? (
              <>
                <span className="shrink-0 text-amber-400/80 dark:text-amber-500/60" aria-hidden>
                  ·
                </span>
                <span className="shrink-0 text-[10px] text-text-secondary whitespace-nowrap">
                  {summaryPosition}
                </span>
              </>
            ) : null}
            {highlighted && showMealsOnMap ? (
              <span className="shrink-0 inline-flex lg:hidden items-center gap-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-800 dark:text-amber-200 bg-amber-400/25 dark:bg-amber-400/15 px-1 py-px rounded-full">
                <span className="size-1 rounded-full bg-amber-600 dark:bg-amber-300" aria-hidden />
                Mapa
              </span>
            ) : null}
            {!showMealsOnMap ? (
              <span className="shrink-0 text-[9px] text-text-secondary/70 italic">Oculto</span>
            ) : null}
            {optionCount > 1 ? (
              <span className="shrink-0 text-[10px] font-semibold text-text-secondary tabular-nums">
                {optionCount}
              </span>
            ) : null}
            <Icon
              name={open ? 'expand_less' : 'expand_more'}
              className="shrink-0 text-base text-text-secondary"
              aria-hidden
            />
          </div>
        </button>

        <div
          id={panelId}
          role="region"
          aria-labelledby={`${panelId}-trigger`}
          hidden={!open}
          className={open ? 'border-t border-amber-300/30 dark:border-amber-500/15' : ''}
        >
          {open ? (
            <div className="px-3 pb-3 pt-2">
              <p className="text-[11px] text-text-secondary leading-relaxed mb-2">
                {readOnly
                  ? 'Sugestões geradas pela IA — reotimize o roteiro para atualizar.'
                  : 'Escolha onde comer. Cada opção foi posicionada perto das suas paradas.'}
              </p>
              <div className="flex flex-col gap-2">
                {options.map((opt, idx) => {
                  const id = String(opt.id ?? opt.placeId ?? opt.place_id ?? idx)
                  return (
                    <MealOptionRow
                      key={id}
                      option={opt}
                      index={idx}
                      selected={effectiveSelectedId === id}
                      onSelect={() => handleOptionSelect(id)}
                    />
                  )
                })}
              </div>
              {typeof onViewOnMap === 'function' && showMealsOnMap ? (
                <button
                  type="button"
                  onClick={() => onViewOnMap()}
                  className="mt-2.5 w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-900 dark:text-amber-100 lg:hidden"
                >
                  <Icon name="map" className="text-sm shrink-0" aria-hidden />
                  Ver esta refeição no mapa
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </article>
    </div>
  )
}
