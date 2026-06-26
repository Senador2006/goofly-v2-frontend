import { Icon } from '../common/Icon'

/**
 * @param {{
 *   checked: boolean,
 *   onChange: (next: boolean) => void,
 *   disabled?: boolean,
 * }} props
 */
export function MapAccommodationRoutesToggle({ checked, onChange, disabled = false }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label="Exibir rotas da hospedagem"
      title="Exibir rotas da hospedagem"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={
        'pointer-events-auto inline-flex items-center gap-1.5 sm:gap-2 rounded-full border px-2.5 py-1.5 sm:px-3 sm:py-1.5 text-[10px] sm:text-[11px] font-semibold shadow-sm backdrop-blur transition-colors ' +
        (checked
          ? 'bg-white/95 dark:bg-card-dark/95 border-green-500/45 text-foreground dark:text-white'
          : 'bg-white/88 dark:bg-card-dark/88 border-border-light dark:border-border-dark text-text-secondary') +
        (disabled ? ' opacity-50 cursor-not-allowed' : ' hover:bg-white dark:hover:bg-card-dark')
      }
    >
      <Icon
        name="home"
        className={'text-sm shrink-0 ' + (checked ? 'text-green-600 dark:text-green-400' : 'text-text-secondary')}
        aria-hidden
      />
      <span className="sm:hidden">Rotas</span>
      <span className="hidden sm:inline">Rotas hospedagem</span>
      <span
        aria-hidden
        className={
          'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ' +
          (checked ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600')
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
