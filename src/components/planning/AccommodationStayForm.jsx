import { useLayoutEffect, useRef, useState } from 'react'
import { Button } from '../common/Button'
import { DateInput } from '../common/DateInput'
import { Icon } from '../common/Icon'
import { GooglePlaceAutocompleteField } from './GooglePlaceAutocompleteField'
import { hasGoogleMapsApiKey } from '../../services/googleMapsPlacesLoader'
import { ACCOMMODATION_TYPES } from '../../utils/accommodationForm'

const fieldClass =
  'w-full min-w-0 px-3 py-2.5 sm:px-4 sm:py-3 rounded-[10px] border border-border-light dark:border-white/15 bg-background-light dark:bg-zinc-900/90 text-base text-[#1c1c0d] dark:text-zinc-100 placeholder:text-text-secondary dark:placeholder:text-zinc-500'

const fieldClassCompact =
  'w-full min-w-0 px-2.5 py-2 sm:px-4 sm:py-3 rounded-[10px] border border-border-light dark:border-white/15 bg-background-light dark:bg-zinc-900/90 text-[0.9375rem] sm:text-base text-[#1c1c0d] dark:text-zinc-100 placeholder:text-text-secondary dark:placeholder:text-zinc-500'

const dateFieldClass = `${fieldClass} !pr-10 sm:!pr-11`
const dateFieldClassCompact = `${fieldClassCompact} !pr-10 sm:!pr-11`

const labelClass = 'block text-sm font-semibold mb-2 text-[#1c1c0d] dark:text-zinc-100'
const labelClassCompact =
  'block text-xs font-semibold mb-1 sm:mb-2 sm:text-sm text-[#1c1c0d] dark:text-zinc-100'

const ADD_FLY_MS = 420

/**
 * Campos de uma hospedagem — usado no wizard de criação e no editor do roteiro.
 */
export function AccommodationStayForm({
  acc,
  accIndex = 0,
  destinations = [],
  showDestinationSelect = false,
  disabled = false,
  fieldIdPrefix = 'acc',
  requirePlaceSuggestion = false,
  compact = false,
  highlighted = false,
  entering = false,
  cardRef = null,
  onChange,
  onRemove,
}) {
  const dest = destinations.find((d) => d.id === (acc.destinationId || acc.destination_id))
  const inputClass = compact ? fieldClassCompact : fieldClass
  const dateInputClass = compact ? dateFieldClassCompact : dateFieldClass
  const label = compact ? labelClassCompact : labelClass

  return (
    <div
      ref={cardRef}
      className={`rounded-[12px] border border-dashed bg-background-light/40 dark:bg-white/[0.04] ${
        compact
          ? 'p-2.5 space-y-2 sm:p-4 sm:space-y-4'
          : 'p-3 sm:p-4 space-y-3 sm:space-y-4'
      } ${
        highlighted
          ? 'border-primary/50 ring-2 ring-primary/25'
          : 'border-border-light dark:border-white/15'
      } ${entering ? 'acc-stay-card-entering' : ''}`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wide text-text-secondary dark:text-zinc-400">
          Hospedagem {accIndex + 1}
        </span>
        {onRemove ? (
          <button
            type="button"
            onClick={onRemove}
            className="shrink-0 text-[11px] sm:text-xs font-semibold text-red-600 dark:text-red-400 hover:underline py-0.5 sm:py-1"
          >
            Remover
          </button>
        ) : null}
      </div>

      {showDestinationSelect && destinations.length > 1 ? (
        <div>
          <label className={label} htmlFor={`${fieldIdPrefix}-dest-${acc.id}`}>
            Destino
          </label>
          <select
            id={`${fieldIdPrefix}-dest-${acc.id}`}
            value={acc.destinationId || acc.destination_id || ''}
            disabled={disabled}
            onChange={(e) => {
              const nextDest = destinations.find((d) => d.id === e.target.value)
              onChange({
                destinationId: e.target.value,
                checkIn: acc.checkIn || nextDest?.arrivalDate || '',
                checkOut: acc.checkOut || nextDest?.departureDate || '',
              })
            }}
            className={inputClass}
          >
            {destinations.map((d) => (
              <option key={d.id} value={d.id}>
                {d.city || 'Destino'}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div>
        <label className={label} htmlFor={`${fieldIdPrefix}-type-${acc.id}`}>
          Tipo
        </label>
        <select
          id={`${fieldIdPrefix}-type-${acc.id}`}
          value={acc.type || 'hotel'}
          disabled={disabled}
          onChange={(e) => onChange({ type: e.target.value })}
          className={inputClass}
        >
          {ACCOMMODATION_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={label}>Nome / Endereço</label>
        {hasGoogleMapsApiKey() ? (
          <>
            <GooglePlaceAutocompleteField
              key={`${fieldIdPrefix}-ac-${acc.id}`}
              id={`${fieldIdPrefix}-ac-${acc.id}`}
              resultKind="place"
              value={acc.name || acc.address || ''}
              placeholder="Ex.: Hotel Plaza Athénée"
              disabled={disabled}
              className={`goofly-google-place-ac-frame relative z-[42] w-full min-w-0 overflow-visible rounded-[10px] border border-border-light dark:border-white/15 bg-background-light dark:bg-zinc-900/90 ${
                compact ? 'min-h-[2.75rem] sm:min-h-[3.125rem]' : 'min-h-[3.125rem]'
              }`}
              inputClassName={inputClass}
              onDraftChange={(text) =>
                onChange({
                  name: text,
                  address: text,
                  coordinates: null,
                })
              }
              onResolved={(patch) =>
                onChange({
                  ...(patch.name != null ? { name: patch.name } : {}),
                  ...(patch.formattedAddress != null ? { address: patch.formattedAddress } : {}),
                  ...(patch.coordinates ? { coordinates: patch.coordinates } : {}),
                })
              }
            />
            <p
              className={`text-text-secondary dark:text-zinc-400 leading-snug ${
                compact
                  ? 'mt-1 text-[10px] sm:mt-2 sm:text-[11px]'
                  : 'mt-2 text-[11px]'
              }`}
            >
              {requirePlaceSuggestion
                ? 'Escolha uma sugestão do Google para fixar a hospedagem no mapa do roteiro.'
                : 'Opcional. Escolha uma sugestão do Google para fixar a hospedagem no mapa do roteiro.'}
            </p>
          </>
        ) : (
          <input
            type="text"
            value={acc.name || ''}
            disabled={disabled}
            onChange={(e) =>
              onChange({
                name: e.target.value,
                address: e.target.value,
              })
            }
            placeholder="Ex: Hotel Plaza Athénée"
            className={inputClass}
          />
        )}
      </div>

      <div
        className={`grid grid-cols-2 ${compact ? 'gap-2 sm:gap-4' : 'grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4'}`}
      >
        <div className="min-w-0">
          <label className={label}>Check-in</label>
          <DateInput
            value={acc.checkIn || ''}
            min={dest?.arrivalDate || undefined}
            max={dest?.departureDate || undefined}
            disabled={disabled}
            onChange={(next) => {
              const patch = { checkIn: next }
              if (next && acc.checkOut && acc.checkOut < next) {
                patch.checkOut = ''
              }
              onChange(patch)
            }}
            aria-label="Check-in"
            className={dateInputClass}
          />
        </div>
        <div className="min-w-0">
          <label className={label}>Check-out</label>
          <DateInput
            value={acc.checkOut || ''}
            min={acc.checkIn || dest?.arrivalDate || undefined}
            max={dest?.departureDate || undefined}
            disabled={disabled}
            onChange={(next) => onChange({ checkOut: next })}
            aria-label="Check-out"
            className={dateInputClass}
          />
        </div>
      </div>
    </div>
  )
}

function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function AccommodationDestinationGroup({
  dest,
  destAccs,
  destinations,
  disabled,
  fieldIdPrefix,
  requirePlaceSuggestion,
  compact = false,
  addDisabled = false,
  addDisabledTitle,
  focusStayId = null,
  focusCardRef = null,
  onAdd,
  onChange,
  onRemove,
}) {
  const addBtnRef = useRef(null)
  const originRectRef = useRef(null)
  const prevIdsRef = useRef(new Set((destAccs || []).map((a) => String(a.id))))
  const cardElsRef = useRef(new Map())
  const [enteringId, setEnteringId] = useState(null)
  const [flyStyle, setFlyStyle] = useState(null)

  useLayoutEffect(() => {
    const currentIds = new Set((destAccs || []).map((a) => String(a.id)))
    const prevIds = prevIdsRef.current
    let addedId = null
    for (const id of currentIds) {
      if (!prevIds.has(id)) {
        addedId = id
        break
      }
    }
    prevIdsRef.current = currentIds
    if (!addedId || !originRectRef.current) return undefined

    const reduce = prefersReducedMotion()
    const origin = originRectRef.current
    originRectRef.current = null

    if (reduce) {
      setEnteringId(addedId)
      const t = setTimeout(() => setEnteringId(null), 280)
      return () => clearTimeout(t)
    }

    const card = cardElsRef.current.get(addedId)
    if (!card) return undefined

    const to = card.getBoundingClientRect()
    const dx = origin.left + origin.width / 2 - (to.left + to.width / 2)
    const dy = origin.top + origin.height / 2 - (to.top + to.height / 2)
    const sx = Math.max(0.18, origin.width / Math.max(to.width, 1))
    const sy = Math.max(0.12, origin.height / Math.max(to.height, 1))

    setFlyStyle({
      left: to.left,
      top: to.top,
      width: to.width,
      height: to.height,
      transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`,
      opacity: 0.85,
      radius: 12,
    })

    card.style.opacity = '0'
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' })

    const goFrame = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setFlyStyle((prev) =>
          prev
            ? {
                ...prev,
                transform: 'translate(0px, 0px) scale(1, 1)',
                opacity: 1,
                radius: 16,
                animating: true,
              }
            : null,
        )
      })
    })

    const done = setTimeout(() => {
      if (card) card.style.opacity = ''
      setFlyStyle(null)
      setEnteringId(addedId)
      setTimeout(() => setEnteringId(null), 320)
    }, ADD_FLY_MS + 40)

    return () => {
      cancelAnimationFrame(goFrame)
      clearTimeout(done)
      if (card) card.style.opacity = ''
      setFlyStyle(null)
    }
  }, [destAccs])

  const handleAddClick = () => {
    const btn = addBtnRef.current
    if (btn) {
      originRectRef.current = btn.getBoundingClientRect()
    }
    onAdd(dest.id)
  }

  const setCardRef = (accId, el) => {
    if (el) cardElsRef.current.set(String(accId), el)
    else cardElsRef.current.delete(String(accId))
    const isFocused = focusStayId != null && String(accId) === String(focusStayId)
    if (isFocused && focusCardRef) {
      if (typeof focusCardRef === 'function') focusCardRef(el)
      else focusCardRef.current = el
    }
  }

  return (
    <div
      className={`relative rounded-[12px] border border-border-light dark:border-white/15 bg-transparent dark:bg-white/[0.02] ${
        compact
          ? 'p-2.5 space-y-2 sm:p-4 sm:space-y-4'
          : 'p-3 sm:p-4 space-y-3 sm:space-y-4'
      }`}
    >
      <div
        className={`flex ${
          compact
            ? 'flex-row items-center justify-between gap-2'
            : 'flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3'
        }`}
      >
        <span className="min-w-0 text-sm font-bold text-[#1c1c0d] dark:text-zinc-200">
          {dest.city || 'Destino'}
          {compact ? '' : ' — hospedagens'}
        </span>
        <Button
          ref={addBtnRef}
          type="button"
          variant="secondary"
          className={
            compact
              ? 'shrink-0 !py-1.5 !px-2.5 text-[11px] sm:w-auto sm:!py-2 sm:!px-3 sm:text-xs'
              : 'w-full !py-2.5 !px-3 text-xs sm:w-auto sm:!py-2'
          }
          disabled={disabled || addDisabled}
          title={addDisabled ? addDisabledTitle : undefined}
          onClick={handleAddClick}
        >
          <Icon name="add" />
          {compact ? 'Adicionar' : 'Adicionar hospedagem'}
        </Button>
      </div>
      {destAccs.length === 0 ? (
        <p className="text-xs text-text-secondary dark:text-zinc-400 m-0">
          Nenhuma hospedagem neste destino. Use o botão acima se quiser informar uma.
        </p>
      ) : null}
      {destAccs.map((acc, accIndex) => {
        const isFocused = focusStayId != null && String(acc.id) === String(focusStayId)
        return (
          <AccommodationStayForm
            key={acc.id}
            acc={acc}
            accIndex={accIndex}
            destinations={destinations}
            disabled={disabled}
            fieldIdPrefix={fieldIdPrefix}
            requirePlaceSuggestion={requirePlaceSuggestion}
            compact={compact}
            highlighted={isFocused}
            entering={enteringId != null && String(acc.id) === String(enteringId)}
            cardRef={(el) => setCardRef(acc.id, el)}
            onChange={(updates) => onChange(acc.id, updates)}
            onRemove={() => onRemove(acc.id)}
          />
        )
      })}

      {flyStyle ? (
        <div
          aria-hidden
          className={`acc-stay-fly-ghost pointer-events-none fixed z-[1300] border border-primary/50 bg-primary/25 dark:bg-primary/20 shadow-lg ${
            flyStyle.animating ? 'acc-stay-fly-ghost--go' : ''
          }`}
          style={{
            left: flyStyle.left,
            top: flyStyle.top,
            width: flyStyle.width,
            height: flyStyle.height,
            transform: flyStyle.transform,
            opacity: flyStyle.opacity,
            borderRadius: flyStyle.radius,
          }}
        />
      ) : null}
    </div>
  )
}
