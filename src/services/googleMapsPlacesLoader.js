/**
 * Bootstrap único da Maps JavaScript API + biblioteca Places (novo Place Autocomplete).
 * @returns {Promise<import('@googlemaps/js-api-loader').APILibraryMap['places']> | null}
 */
let placesImportPromise

export function hasGoogleMapsApiKey() {
  return Boolean(String(import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '').trim())
}

export async function loadPlacesLibrary() {
  const key = String(import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '').trim()
  if (!key) throw new Error('Google Maps API key não configurada (VITE_GOOGLE_MAPS_API_KEY)')
  const { setOptions, importLibrary } = await import('@googlemaps/js-api-loader')
  if (!placesImportPromise) {
    setOptions({
      key,
      v: 'weekly',
      /** UI e previsões em português; sem `region` fixo para viagens para qualquer país */
      language: 'pt-BR',
    })
    placesImportPromise = importLibrary('places')
  }
  return placesImportPromise
}
