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
