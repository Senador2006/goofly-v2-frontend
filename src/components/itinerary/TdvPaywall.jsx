import { useNavigate } from 'react-router-dom'
import { Button } from '../common/Button'
import { EmptyState } from '../common/EmptyState'
import { useT } from '../../i18n'

/**
 * EmptyState do free-cap no TDV: Gerar roteiro / Desbloquear (+ aviso de lock).
 */
export function TdvPaywall({
  tripId,
  finalizingTdv = false,
  warnTdvLockOnGenerate = false,
  freeCapLockWarnOpen = false,
  setFreeCapLockWarnOpen,
  onGenerate,
}) {
  const t = useT()
  const navigate = useNavigate()

  return (
    <div className="flex h-full w-full flex-col items-center justify-center px-3">
      <EmptyState
        icon="lock"
        title={t('tdv.free_cap_title')}
        description={t('tdv.free_cap_body')}
        action={
          <div className="flex w-full max-w-sm flex-col gap-2">
            {freeCapLockWarnOpen && warnTdvLockOnGenerate ? (
              <div
                className="rounded-2xl border border-border-light bg-white p-3 text-left shadow-xl dark:border-white/[0.1] dark:bg-surface-dark sm:p-4"
                role="dialog"
                aria-modal="true"
                aria-label={t('tdv.lock_warn_title')}
              >
                <p className="mb-2 text-[11px] leading-snug text-text-secondary sm:text-xs lg:mb-3 lg:text-[13px] lg:leading-relaxed">
                  {t('tdv.lock_warn_body')}
                </p>
                <Button
                  onClick={() => {
                    setFreeCapLockWarnOpen?.(false)
                    onGenerate?.()
                  }}
                  disabled={finalizingTdv}
                  className="w-full rounded-full py-2.5 sm:py-3 lg:py-3.5 lg:text-[15px]"
                >
                  {finalizingTdv
                    ? t('tdv.finalize_generating')
                    : t('tdv.lock_warn_confirm')}
                </Button>
                <button
                  type="button"
                  onClick={() => setFreeCapLockWarnOpen?.(false)}
                  className="mt-2 w-full text-center text-[11px] font-semibold text-text-secondary transition-colors hover:text-[#1c1c0d] dark:hover:text-white"
                >
                  {t('tdv.lock_warn_cancel')}
                </button>
              </div>
            ) : (
              <>
                <Button
                  onClick={() => {
                    if (warnTdvLockOnGenerate) {
                      setFreeCapLockWarnOpen?.(true)
                      return
                    }
                    onGenerate?.()
                  }}
                  disabled={finalizingTdv}
                  className="w-full rounded-full"
                >
                  {t('tdv.free_cap_generate')}
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    navigate(
                      `/pagamento?tripId=${encodeURIComponent(tripId)}&from=tdv`,
                    )
                  }
                  disabled={finalizingTdv}
                  className="w-full rounded-full"
                >
                  {t('tdv.free_cap_unlock')}
                </Button>
              </>
            )}
          </div>
        }
      />
    </div>
  )
}
