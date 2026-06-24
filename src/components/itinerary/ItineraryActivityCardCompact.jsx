import { Icon } from '../common/Icon'

/**
 * Cartão compacto (paralelepípedo) usado durante o drag no modo edição.
 */
export function ItineraryActivityCardCompact({
  index,
  scheduleLabel,
  title,
  durationLabel = '2h',
  className = '',
}) {
  return (
    <div
      className={
        `roteiro-card-compact flex h-[4.5rem] flex-col justify-center gap-1 px-4 py-2 ${className}`.trim()
      }
    >
      <div className="flex items-center justify-between gap-2 min-w-0">
        <span className="inline-flex min-w-0 items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-primary bg-primary/15 px-2 py-0.5 rounded-full shrink-0">
          <Icon name="schedule" className="text-sm shrink-0" aria-hidden />
          <span className="truncate">{scheduleLabel}</span>
        </span>
        <span className="text-[11px] font-semibold text-text-secondary shrink-0">{durationLabel}</span>
      </div>
      <p className="text-sm font-bold text-[#1c1c0d] dark:text-white leading-snug truncate pr-1">
        {title}
      </p>
    </div>
  )
}
