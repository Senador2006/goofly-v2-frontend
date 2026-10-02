import { Icon } from '../common/Icon'
import { Button } from '../common/Button'

export function ItineraryStatusBanners({
  tdvLockHint,
  setTdvLockHint,
  itineraryError,
  retryItineraryLoad,
  itineraryLoading,
  finalizeError,
  setFinalizeError,
}) {
  return (
    <>
      {tdvLockHint ? (
        <div className="flex-shrink-0 px-4 sm:px-6 py-2.5 bg-amber-500/10 border-b border-amber-500/25 text-amber-900 dark:text-amber-200 text-sm flex items-start gap-2" role="status">
          <Icon name="lock" className="text-base shrink-0 mt-0.5" aria-hidden />
          <p className="min-w-0 flex-1 leading-snug">{tdvLockHint}</p>
          <button type="button" onClick={() => setTdvLockHint(null)} className="shrink-0 p-0.5 rounded-md hover:bg-amber-500/15" aria-label="Fechar aviso">
            <Icon name="close" className="text-base" />
          </button>
        </div>
      ) : null}
      {itineraryError ? (
        <div className="flex-shrink-0 px-4 sm:px-6 py-2.5 bg-amber-500/10 border-b border-amber-500/25 text-amber-900 dark:text-amber-200 text-sm flex items-start gap-2" role="alert">
          <Icon name="wifi_off" className="text-base shrink-0 mt-0.5" aria-hidden />
          <p className="min-w-0 flex-1 leading-snug">{itineraryError}</p>
          <Button type="button" size="sm" variant="secondary" className="shrink-0 rounded-lg font-bold" onClick={retryItineraryLoad} disabled={itineraryLoading}>
            Tentar de novo
          </Button>
        </div>
      ) : null}
      {finalizeError ? (
        <div className="flex-shrink-0 px-4 sm:px-6 py-2.5 bg-red-500/10 border-b border-red-500/25 text-red-700 dark:text-red-400 text-sm flex items-start gap-2" role="alert">
          <Icon name="error" className="text-base shrink-0 mt-0.5" aria-hidden />
          <p className="min-w-0 flex-1 leading-snug">{finalizeError}</p>
          <button type="button" onClick={() => setFinalizeError(null)} className="shrink-0 p-0.5 rounded-md hover:bg-red-500/15 text-red-600 dark:text-red-400" aria-label="Fechar aviso">
            <Icon name="close" className="text-base" />
          </button>
        </div>
      ) : null}
    </>
  )
}
