/**
 * Marcador numerado da timeline do roteiro.
 * Estilo contornado (nó da lista) — distinto dos pins sólidos do mapa (RF04.3).
 *
 * @param {{ order?: number, variant?: 'default' | 'muted' | 'highlighted', className?: string }} props
 */
export function ItineraryStopMarker({ order, variant = 'default', className = '' }) {
  const variantStyles = {
    default:
      'border-2 border-primary bg-background-light dark:bg-[#23220f] text-primary shadow-sm',
    muted:
      'border-2 border-primary/35 bg-background-light/80 dark:bg-[#23220f]/80 text-primary/40',
    highlighted:
      'border-2 border-primary bg-primary/15 text-primary ring-2 ring-primary/40 shadow-sm',
  }

  const fontSize = order != null && order >= 10 ? 'text-[9px]' : 'text-[10px]'

  return (
    <span
      aria-hidden="true"
      className={`absolute z-10 flex size-6 items-center justify-center rounded-full font-bold tabular-nums leading-none ${variantStyles[variant] ?? variantStyles.default} ${fontSize} ${className}`}
    >
      {order != null ? order : null}
    </span>
  )
}
