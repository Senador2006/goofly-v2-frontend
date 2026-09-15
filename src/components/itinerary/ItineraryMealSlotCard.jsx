import { useId, useState } from 'react'
import { Icon } from '../common/Icon'
import { TimeInput } from '../common/TimeInput'
import { GooglePlaceAutocompleteField } from '../planning/GooglePlaceAutocompleteField'
import { hasGoogleMapsApiKey } from '../../services/googleMapsPlacesLoader'
import {
  formatMealTimeLabel,
  getMealPositionLabel,
  getMealTypeIcon,
  getMealTypeLabel,
  MAX_MEAL_SLOT_OPTIONS,
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
 *   selectDisabled?: boolean
 *   editing?: boolean
 *   canRemove?: boolean
 *   onRemove?: () => void
 * }} props
 */
function MealOptionRow({
  option,
  index,
  selected,
  onSelect,
  selectDisabled = false,
  editing = false,
  canRemove = false,
  onRemove,
}) {
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
      tabIndex={selectDisabled ? -1 : 0}
      onClick={selectDisabled ? undefined : onSelect}
      onKeyDown={(event) => {
        if (selectDisabled) return
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelect()
        }
      }}
      className={
        'group flex gap-2.5 rounded-lg border px-2.5 py-2 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ' +
        (selectDisabled ? 'cursor-default ' : 'cursor-pointer ') +
        (selected
          ? 'border-primary bg-primary/10 dark:bg-primary/8'
          : 'border-border-light/80 dark:border-white/10 bg-white/70 dark:bg-[#1a1910]/60 hover:border-primary/40 hover:bg-primary/[0.03]')
      }
      aria-pressed={selected}
      aria-disabled={selectDisabled}
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
      {editing && canRemove ? (
        <button
          type="button"
          title="Remover restaurante"
          aria-label={`Remover ${title}`}
          onClick={(event) => {
            event.stopPropagation()
            onRemove?.()
          }}
          className="shrink-0 self-start inline-flex items-center justify-center rounded-lg border border-red-500/30 bg-red-500/10 p-1.5 text-red-700 dark:text-red-400 hover:bg-red-500/15"
        >
          <Icon name="delete" className="text-sm" aria-hidden />
        </button>
      ) : null}
    </div>
  )
}

/**
 * Bloco compacto de sugestões de refeição na timeline do roteiro.
 */
export function ItineraryMealSlotCard({
  mealType,
  startTime,
  endTime = '',
  options = [],
  isLast = false,
  readOnly = false,
  editing = false,
  selectedId: selectedIdProp = null,
  onSelect,
  highlighted = false,
  showMealsOnMap = true,
  open = false,
  onOpenChange,
  onViewOnMap = null,
  headerRef = null,
  cardRef = null,
  onTimePatch,
  onMoveUp,
  onMoveDown,
  disableMoveUp = false,
  disableMoveDown = false,
  canDragReorder = false,
  onDragHandlePointerDown,
  onRemoveOption,
  onAddOption,
  compactMode = false,
  isDragSource = false,
  isDragHidden = false,
  isDragPending = false,
}) {
  const panelId = useId()
  const [addDraft, setAddDraft] = useState('')

  const mealLabel = getMealTypeLabel(mealType)
  const mealIcon = getMealTypeIcon(mealType)
  const timeLabel = formatMealTimeLabel(startTime)
  const optionCount = options.length
  const canAddMore = editing && optionCount < MAX_MEAL_SLOT_OPTIONS
  const canRemoveOption = editing && optionCount > 1

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

  const handleOptionSelect = (id) => {
    if (readOnly && !editing) return
    const next = effectiveSelectedId === id ? null : id
    onSelect?.(next)
  }

  const st = String(startTime || '').slice(0, 5)
  const et = String(endTime || '').slice(0, 5)

  /** Clique no cabeçalho abre/fecha (como ActivityCard). Em edição o header arrasta. */
  const headerTogglesOpen = !editing
  const nestedInteractiveSelector =
    'button, a, input, select, textarea, label, [role="button"]'

  const isNestedInteractive = (target, current) => {
    if (!(target instanceof Element)) return false
    const hit = target.closest(nestedInteractiveSelector)
    // Não contar o próprio header (também role=button) como “aninhado”
    return Boolean(hit && hit !== current)
  }

  const handleHeaderClick = (event) => {
    if (!headerTogglesOpen) return
    if (isNestedInteractive(event.target, event.currentTarget)) return
    onOpenChange?.(!open)
  }

  const handleHeaderKeyDown = (event) => {
    if (!headerTogglesOpen) return
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    onOpenChange?.(!open)
  }

  if (editing && compactMode) {
    return (
      <div
        ref={cardRef}
        className={`relative pl-10${isLast ? '' : ' pb-4'}${isDragHidden ? ' opacity-0' : ''}`}
      >
        {!isLast ? (
          <div
            className="absolute left-0 top-7 bottom-0 w-px border-l-2 border-dashed border-amber-400/55 dark:border-amber-500/35"
            aria-hidden
          />
        ) : null}
        <div className="rounded-lg border-2 border-dashed border-amber-400/50 bg-amber-50/90 dark:bg-amber-950/30 h-[4.5rem] flex items-center gap-2 px-3">
          {isDragSource ? (
            <span className="text-[11px] font-semibold text-amber-900/70 dark:text-amber-100/70">
              Solte para reposicionar
            </span>
          ) : (
            <>
              <Icon name={mealIcon} className="text-amber-700 dark:text-amber-300 shrink-0" aria-hidden />
              <span className="text-sm font-semibold text-[#1c1c0d] dark:text-white truncate">
                {mealLabel} · {timeLabel} · {summaryTitle}
              </span>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      ref={cardRef}
      className={`relative pl-10${isLast ? '' : ' pb-4'}${isDragHidden ? ' opacity-0' : ''}${editing ? ' z-[15] overflow-visible' : ''}`}
    >
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
          'rounded-lg border-2 border-dashed transition-shadow duration-200 ' +
          (editing ? 'overflow-visible relative z-[20] ' : 'overflow-hidden ') +
          (highlighted
            ? 'border-amber-500/75 dark:border-amber-400/55 bg-amber-50/95 dark:bg-amber-950/35 shadow-[0_0_0_4px_rgba(245,158,11,0.25),0_8px_24px_-12px_rgba(245,158,11,0.45)] ring-2 ring-amber-400/40 lg:border-amber-500/70 lg:bg-amber-50/90 dark:lg:bg-amber-950/30 lg:shadow-sm lg:ring-0'
            : 'border-amber-400/40 dark:border-amber-500/25 bg-amber-50/80 dark:bg-amber-950/20 shadow-sm') +
          (isDragPending ? ' ring-2 ring-primary/40' : '')
        }
      >
        {/* Cabeçalho: clique abre/fecha; em edição vira área de arraste */}
        <div
          ref={headerRef}
          id={`${panelId}-trigger`}
          role={headerTogglesOpen ? 'button' : undefined}
          tabIndex={headerTogglesOpen ? 0 : undefined}
          aria-expanded={headerTogglesOpen ? open : undefined}
          aria-controls={headerTogglesOpen ? panelId : undefined}
          className={
            'roteiro-meal-slot-header w-full text-left px-2.5 py-1.5 min-h-[2.125rem] rounded-lg lg:py-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ' +
            (editing && canDragReorder
              ? 'cursor-grab active:cursor-grabbing touch-none select-none'
              : headerTogglesOpen
                ? 'cursor-pointer'
                : '')
          }
          onClick={handleHeaderClick}
          onKeyDown={handleHeaderKeyDown}
          onPointerDown={
            editing && canDragReorder
              ? (event) => {
                  if (event.button != null && event.button !== 0) return
                  if (isNestedInteractive(event.target, event.currentTarget)) return
                  onDragHandlePointerDown?.(event)
                }
              : undefined
          }
        >
          <div className="flex flex-col gap-1.5 lg:hidden">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-amber-900 dark:text-amber-100">
                {editing ? (
                  <Icon name="drag_indicator" className="text-sm shrink-0 opacity-70" aria-hidden />
                ) : (
                  <Icon name={mealIcon} className="text-sm shrink-0" aria-hidden />
                )}
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
              ) : typeof onViewOnMap === 'function' && !editing ? (
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

          <div className="hidden lg:flex items-center gap-2 min-h-[1.375rem]">
            {editing ? (
              <Icon
                name="drag_indicator"
                className="shrink-0 text-base text-amber-800/70 dark:text-amber-200/70"
                aria-hidden
              />
            ) : null}
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
        </div>

        {editing ? (
          <div className="border-t border-amber-300/30 dark:border-amber-500/15 px-3 py-2.5 space-y-2.5">
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1 text-[10px] font-bold uppercase text-text-secondary">
                Início
                <TimeInput
                  className="rounded-lg border border-border-light dark:border-border-dark bg-white dark:bg-[#1a1910] px-2.5 py-2 text-sm font-semibold text-[#1c1c0d] dark:text-white"
                  value={st}
                  onChange={(next) =>
                    onTimePatch?.({ startTime: next, start_time: next, time: next })
                  }
                  placeholder="12:30"
                  fallback="12:30"
                />
              </label>
              <label className="flex flex-col gap-1 text-[10px] font-bold uppercase text-text-secondary">
                Fim (opcional)
                <TimeInput
                  className="rounded-lg border border-border-light dark:border-border-dark bg-white dark:bg-[#1a1910] px-2.5 py-2 text-sm font-semibold text-[#1c1c0d] dark:text-white"
                  value={et}
                  onChange={(next) => onTimePatch?.({ endTime: next, end_time: next })}
                  placeholder="—"
                  allowEmpty
                />
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={disableMoveUp}
                onClick={onMoveUp}
                className="inline-flex items-center justify-center rounded-xl border border-border-light dark:border-border-dark bg-background-light dark:bg-white/[0.06] px-2.5 py-2 text-sm font-bold text-[#1c1c0d] dark:text-white disabled:opacity-35 disabled:pointer-events-none min-h-[2.25rem]"
                title="Mover para cima"
              >
                <Icon name="arrow_upward" className="text-lg" aria-hidden />
              </button>
              <button
                type="button"
                disabled={disableMoveDown}
                onClick={onMoveDown}
                className="inline-flex items-center justify-center rounded-xl border border-border-light dark:border-border-dark bg-background-light dark:bg-white/[0.06] px-2.5 py-2 text-sm font-bold text-[#1c1c0d] dark:text-white disabled:opacity-35 disabled:pointer-events-none min-h-[2.25rem]"
                title="Mover para baixo"
              >
                <Icon name="arrow_downward" className="text-lg" aria-hidden />
              </button>
            </div>
          </div>
        ) : null}

        <div
          id={panelId}
          role="region"
          aria-labelledby={`${panelId}-trigger`}
          hidden={!open && !editing}
          className={
            open || editing ? 'border-t border-amber-300/30 dark:border-amber-500/15' : ''
          }
        >
          {open || editing ? (
            <div className="px-3 pb-3 pt-2">
              <p className="text-[11px] text-text-secondary leading-relaxed mb-2">
                {editing
                  ? `Até ${MAX_MEAL_SLOT_OPTIONS} restaurantes neste bloco. Remova opções individuais; o bloco permanece no dia.`
                  : readOnly
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
                      selectDisabled={readOnly && !editing}
                      editing={editing}
                      canRemove={canRemoveOption}
                      onRemove={() => onRemoveOption?.(id)}
                    />
                  )
                })}
              </div>
              {canAddMore ? (
                <div className="mt-3 space-y-1.5 relative z-[40] overflow-visible pb-1">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-text-secondary">
                    Adicionar restaurante ({optionCount}/{MAX_MEAL_SLOT_OPTIONS})
                  </p>
                  {hasGoogleMapsApiKey() ? (
                    <GooglePlaceAutocompleteField
                      id={`${panelId}-add-place`}
                      resultKind="place"
                      value={addDraft}
                      disabled={false}
                      placeholder="Busque um restaurante…"
                      className="goofly-google-place-ac-frame goofly-google-place-ac-frame--compact relative z-[42] w-full overflow-visible rounded-xl border border-amber-400/40 dark:border-amber-500/30 bg-white dark:bg-[#1a1910]"
                      inputClassName="w-full rounded-xl border border-border-light dark:border-border-dark bg-white dark:bg-[#1a1910] px-3 py-2.5 text-sm font-semibold text-[#1c1c0d] dark:text-white"
                      onDraftChange={setAddDraft}
                      onResolved={(patch) => {
                        const name = patch.name || patch.city
                        if (!name) return
                        /** @type {Record<string, unknown>} */
                        const fields = {
                          name,
                          title: name,
                          placeName: name,
                        }
                        if (patch.coordinates) fields.coordinates = patch.coordinates
                        if (patch.formattedAddress) {
                          fields.description = patch.formattedAddress
                        }
                        onAddOption?.(fields)
                        setAddDraft('')
                      }}
                    />
                  ) : (
                    <p className="text-[11px] text-text-secondary italic">
                      Configure a chave do Google Maps para buscar restaurantes.
                    </p>
                  )}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </article>
    </div>
  )
}
