import { formatTripLabel } from '../../utils/tripLabel'
import { Icon } from '../common/Icon'

/**
 * Seletor de viagem — chips horizontais (padrão Memories).
 * @param {{ trips: Array, selectedId: string|number|null, onChange: (id: string) => void, disabledIds?: Set<string> }} props
 */
export function TripSelector({ trips, selectedId, onChange, disabledIds = new Set() }) {
  if (!trips?.length) return null

  return (
    <div
      className="flex gap-2 mb-4 overflow-x-auto no-scrollbar"
      role="listbox"
      aria-label="Selecione a viagem para desbloquear"
    >
      {trips.map((trip) => {
        const id = String(trip.id)
        const isSelected = selectedId != null && String(selectedId) === id
        const isDisabled = disabledIds.has(id)

        return (
          <button
            key={id}
            type="button"
            role="option"
            aria-selected={isSelected}
            disabled={isDisabled}
            onClick={() => onChange(id)}
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
              isDisabled
                ? 'bg-surface-light/60 dark:bg-surface-dark/60 text-text-secondary cursor-not-allowed opacity-60'
                : isSelected
                  ? 'bg-primary text-foreground'
                  : 'bg-surface-light dark:bg-surface-dark hover:bg-primary/20'
            }`}
          >
            {isDisabled ? <Icon name="check_circle" className="text-base shrink-0" /> : null}
            {formatTripLabel(trip)}
            {isDisabled ? <span className="text-xs opacity-80">(desbloqueada)</span> : null}
          </button>
        )
      })}
    </div>
  )
}
