import { Icon } from '../common/Icon'
import { useT } from '../../i18n'

/**
 * Zona de drop «Inserir aqui» no fim do dia no modo Modificar Roteiro.
 */
export function RoteiroModifyInsertZone({
  zoneRef = null,
  active = false,
  highlighted = false,
  className = '',
}) {
  const t = useT()
  const label = highlighted ? t('tdv.modify_drop_insert') : t('tdv.modify_insert_zone')

  return (
    // pt no wrapper: o space-y-0 do pai zera margin-top dos filhos.
    <div className={`pt-6 ${className}`.trim()}>
      <div
        ref={zoneRef}
        data-roteiro-modify-drop="insert"
        className={`flex min-h-[3.5rem] items-center justify-center gap-2 rounded-xl border-2 border-dashed px-3 py-3 text-center transition-colors ${
          highlighted
            ? 'border-emerald-500 bg-emerald-500/15 text-emerald-800 dark:border-emerald-400 dark:bg-emerald-500/20 dark:text-emerald-200'
            : active
              ? 'border-emerald-500/45 bg-emerald-500/5 text-emerald-800/90 dark:border-emerald-400/40 dark:bg-emerald-500/10 dark:text-emerald-200/90'
              : 'border-border-light bg-background-light/60 text-text-secondary dark:border-white/[0.1] dark:bg-white/[0.03]'
        }`}
        aria-dropeffect={active ? 'copy' : 'none'}
        aria-label={label}
      >
        <Icon
          name="add_location_alt"
          className={`text-base ${highlighted ? 'text-emerald-600 dark:text-emerald-300' : ''}`}
          aria-hidden
        />
        <span className="text-xs font-bold">{label}</span>
      </div>
    </div>
  )
}
