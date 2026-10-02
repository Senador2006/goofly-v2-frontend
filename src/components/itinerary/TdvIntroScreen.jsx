import { Button } from '../common/Button'
import { LoadingSpinner } from '../common/LoadingSpinner'
import { useT } from '../../i18n'

const PILL_BASE = 'rounded-full px-3.5 py-1.5 text-sm font-bold'

/**
 * Porta de entrada do TDV: título, três pílulas na cor dos botões e uma linha.
 */
export function TdvIntroScreen({ loading, ready, isPostUnlock, onStart }) {
  const t = useT()
  const checkLabel = isPostUnlock ? t('tdv.modify_intro_pill') : t('tdv.intro_pill_generate')

  return (
    <div
      className="flex h-full min-h-0 flex-1 flex-col items-center justify-center overflow-hidden bg-[#f0f0ee] px-6 py-8 dark:bg-[#0e0e0e]"
      role="status"
      aria-live="polite"
    >
      <div className="flex w-full max-w-md flex-col items-center gap-5 text-center">
        {loading ? <LoadingSpinner className="p-4" /> : null}
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground dark:text-white sm:text-3xl">
          {isPostUnlock ? t('tdv.modify_intro_title') : t('tdv.intro_title')}
        </h1>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <span
            className={`${PILL_BASE} border border-red-200 bg-red-50 text-red-600 dark:border-red-400/30 dark:bg-red-500/10 dark:text-red-400`}
          >
            {t('tdv.intro_pill_no')}
          </span>
          <span className={`${PILL_BASE} bg-primary text-foreground ring-2 ring-primary/20 dark:ring-primary/25`}>
            {t('tdv.intro_pill_want')}
          </span>
          <span
            className={`${PILL_BASE} border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-400`}
          >
            {checkLabel}
          </span>
        </div>
        <p className="max-w-xs text-sm leading-relaxed text-text-secondary">
          {isPostUnlock ? t('tdv.modify_intro_line') : t('tdv.intro_line')}
        </p>
        <Button
          type="button"
          className="rounded-full"
          disabled={loading || !ready}
          onClick={onStart}
        >
          {isPostUnlock ? t('tdv.modify_intro_continue') : t('tdv.intro_start')}
        </Button>
      </div>
    </div>
  )
}
