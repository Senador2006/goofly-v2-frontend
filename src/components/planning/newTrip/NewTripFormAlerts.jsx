export function NewTripFormAlerts({
  bannerMessages,
  apiError,
  stayNotice,
  mapsUnavailable,
  mapsStatus,
  step,
  errorBannerRef,
}) {
  return (
    <>
      {bannerMessages.length > 0 && (
        <div
          ref={errorBannerRef}
          className="mb-6 p-4 bg-red-500/10 text-red-600 dark:text-red-400 rounded-xl text-sm"
          role="alert"
        >
          {bannerMessages.length === 1 ? (
            <p>{bannerMessages[0]}</p>
          ) : (
            <ul className="list-disc pl-4 space-y-1">
              {bannerMessages.map((msg) => <li key={msg}>{msg}</li>)}
            </ul>
          )}
          {apiError &&
            (apiError.includes('temporariamente') || apiError.includes('comunicar')) && (
              <p className="mt-2 text-xs opacity-90">Tente novamente em alguns segundos ou reinicie o servidor.</p>
            )}
        </div>
      )}
      {stayNotice && (
        <div
          className="mb-6 p-4 bg-amber-500/10 text-amber-900 dark:text-amber-100 rounded-xl text-sm leading-relaxed"
          role="status"
        >
          <p>{stayNotice}</p>
        </div>
      )}
      {mapsUnavailable && (
        <div
          className="mb-6 p-4 bg-amber-500/10 text-amber-900 dark:text-amber-100 rounded-xl text-sm leading-relaxed"
          role="alert"
        >
          <p className="font-semibold mb-1">Google Maps indisponível</p>
          <p>
            {mapsStatus === 'missing_key'
              ? 'A variável VITE_GOOGLE_MAPS_API_KEY não está configurada. Sem ela não é possível localizar destinos nem criar a viagem.'
              : 'Não foi possível carregar a biblioteca Places do Google Maps. Verifique a chave, restrições de API e a rede; depois recarregue a página.'}
          </p>
        </div>
      )}
      {mapsStatus === 'checking' && step === 1 && (
        <div className="mb-6 p-3 text-sm text-text-secondary" role="status">
          Verificando Google Maps…
        </div>
      )}
    </>
  )
}
