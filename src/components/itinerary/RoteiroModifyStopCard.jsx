import { Icon } from '../common/Icon'

/**
 * Card compacto compartilhado entre a caixa de curtidas e as paradas do roteiro
 * no modo «Modificar Roteiro» — mesmo formato para a troca visual 1:1.
 */
export function RoteiroModifyStopCard({
  title,
  chipLabel,
  chipIcon = 'schedule',
  metaLabel = null,
  hint = null,
  selected = false,
  interactive = false,
  trailing = null,
  className = '',
  cardRef = null,
  onClick,
  onKeyDown,
  role,
  tabIndex,
  'aria-label': ariaLabel,
  'aria-pressed': ariaPressed,
  'aria-grabbed': ariaGrabbed,
  disabled = false,
}) {
  const highlight = selected || Boolean(hint)

  return (
    <div
      ref={cardRef}
      className={`roteiro-modify-stop-card flex items-center gap-2 rounded-md border px-2.5 py-2 transition-colors ${
        highlight
          ? 'border-primary bg-primary/10 shadow-sm ring-1 ring-primary/40'
          : 'border-border-light bg-background-light dark:border-white/[0.08] dark:bg-white/[0.04]'
      } ${interactive ? 'cursor-pointer' : ''} ${disabled ? 'pointer-events-none opacity-60' : ''} ${className}`.trim()}
      onClick={disabled ? undefined : onClick}
      onKeyDown={disabled ? undefined : onKeyDown}
      role={role}
      tabIndex={tabIndex}
      aria-label={ariaLabel}
      aria-pressed={ariaPressed}
      aria-grabbed={ariaGrabbed}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-[#5c4810] bg-primary/15 dark:text-primary">
            <Icon name={chipIcon} className="text-[11px]" aria-hidden />
            {chipLabel}
          </span>
          {metaLabel ? (
            <span className="text-[10px] font-semibold text-text-secondary">{metaLabel}</span>
          ) : null}
        </div>
        <p className="mt-0.5 truncate text-[13px] font-bold leading-snug text-[#1c1c0d] dark:text-white">
          {title}
        </p>
        {hint ? (
          <p className="mt-0.5 text-[10px] font-semibold text-primary">{hint}</p>
        ) : null}
      </div>
      {trailing}
    </div>
  )
}
