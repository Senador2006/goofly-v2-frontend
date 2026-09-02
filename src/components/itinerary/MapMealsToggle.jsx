import { Icon } from '../common/Icon'

/**
 * @param {{
 *   checked: boolean,
 *   onChange: (next: boolean) => void,
 *   disabled?: boolean,
 * }} props
 */
export function MapMealsToggle({ checked, onChange, disabled = false }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label="Exibir refeições no mapa"
      title="Exibir refeições no mapa"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={
        'pointer-events-auto inline-flex items-center gap-1.5 sm:gap-2 rounded-full border px-2.5 py-1.5 sm:px-3 sm:py-1.5 text-[10px] sm:text-[11px] font-semibold shadow-sm backdrop-blur transition-colors ' +
        (checked
          ? 'bg-white/95 dark:bg-card-dark/95 border-amber-500/45 text-foreground dark:text-white'
          : 'bg-white/88 dark:bg-card-dark/88 border-border-light dark:border-border-dark text-text-secondary') +
        (disabled ? ' opacity-50 cursor-not-allowed' : ' hover:bg-white dark:hover:bg-card-dark')
      }
    >
      <Icon
        name="restaurant"
        className={'text-sm shrink-0 ' + (checked ? 'text-amber-600 dark:text-amber-400' : 'text-text-secondary')}
        aria-hidden
      />
      <span className="sm:hidden">Refeições</span>
      <span className="hidden sm:inline">Refeições</span>
      <span
        aria-hidden
        className={
          'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ' +
          (checked ? 'bg-amber-500' : 'bg-gray-300 dark:bg-gray-600')
        }
      >
        <span
          className={
            'inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ' +
            (checked ? 'translate-x-[18px]' : 'translate-x-[3px]')
          }
        />
      </span>
    </button>
  )
}
