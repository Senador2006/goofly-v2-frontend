/**
 * Bootstrap da Maps JavaScript API + biblioteca Places (Place Autocomplete novo).
 *
 * {@link https://developers.google.com/maps/documentation/javascript/libraries}
 * {@link https://developers.google.com/maps/documentation/javascript/load-maps-js-api}
 */
import { importLibrary, setOptions } from '@googlemaps/js-api-loader'

let optionsInstalled = false
let placesPromise = null

/** @returns {boolean} */
export function hasGoogleMapsApiKey() {
  return Boolean(import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim?.())
}

/**
 * Configura uma única vez a chave e carrega `places` (Autocomplete Element novo).
 * @returns {Promise<unknown>}
 */
export function ensurePlacesLibrary() {
  if (!hasGoogleMapsApiKey()) {
    return Promise.reject(new Error('VITE_GOOGLE_MAPS_API_KEY não configurada.'))
  }
  if (!optionsInstalled) {
    setOptions({
      key: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
      v: 'weekly',
      language: 'pt-BR',
      region: 'BR',
    })
    optionsInstalled = true
  }
  placesPromise ??= importLibrary('places')
  return placesPromise
}

/**
 * Status inicial antes do probe async (B15).
 * @returns {'checking'|'missing_key'}
 */
export function getGoogleMapsKeyStatus() {
  return hasGoogleMapsApiKey() ? 'checking' : 'missing_key'
}

/**
 * Health check: carrega Places e devolve estado usável no formulário.
 * @returns {Promise<'ready'|'missing_key'|'load_failed'>}
 */
export async function probeGoogleMapsPlaces() {
  if (!hasGoogleMapsApiKey()) return 'missing_key'
  try {
    await ensurePlacesLibrary()
    return 'ready'
  } catch {
    return 'load_failed'
  }
}
