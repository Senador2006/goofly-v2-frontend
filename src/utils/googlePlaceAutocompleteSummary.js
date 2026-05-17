/**
 * Deriva cidade, país e coordenadas a partir da classe Place (Places API novo, widget Autocomplete).
 * @param {Record<string, any>} place
 * @returns {{ city: string, country: string, coordinates?: { latitude: number, longitude: number } }}
 */
export function summarizePlaceFromGoogleAutocomplete(place) {
  if (!place || typeof place !== 'object')
    return { city: '', country: '', coordinates: undefined }

  let locality = ''
  let postalTown = ''
  let admin3 = ''
  let admin2 = ''
  let admin1 = ''
  let country = ''

  const components = Array.isArray(place.addressComponents) ? place.addressComponents : []
  for (const c of components) {
    const types = Array.isArray(c.types) ? c.types : []
    const lt = typeof c.longText === 'string' ? c.longText.trim() : ''
    if (!lt) continue
    if (types.includes('country')) country = lt
    else if (types.includes('locality')) locality = lt
    else if (types.includes('postal_town')) postalTown = lt
    else if (types.includes('administrative_area_level_3')) admin3 = lt
    else if (types.includes('administrative_area_level_2')) admin2 = lt
    else if (types.includes('administrative_area_level_1')) admin1 = lt
  }

  const city = locality || postalTown || admin3 || admin2 || admin1 || ''

  let coords
  const loc = place.location
  if (loc != null && typeof loc === 'object') {
    const lat = typeof loc.lat === 'function' ? loc.lat() : loc.lat
    const lng = typeof loc.lng === 'function' ? loc.lng() : loc.lng
    if (Number.isFinite(lat) && Number.isFinite(lng)) coords = { latitude: lat, longitude: lng }
  }

  if (!city || !country) {
    const display = typeof place.displayName === 'string' ? place.displayName.trim() : ''
    if (display) {
      const parts = display.split(',').map((p) => p.trim()).filter(Boolean)
      if (!city && parts.length > 0) {
        return {
          city: parts[0],
          country: country || parts[parts.length - 1] || '',
          coordinates: coords,
        }
      }
      if (!country && parts.length > 1 && parts[parts.length - 1]) {
        country = parts[parts.length - 1] || ''
      }
    }
  }

  const formatted =
    typeof place.formattedAddress === 'string' ? place.formattedAddress.trim() : ''
  if (formatted && !country) {
    const tail = formatted.split(',').map((s) => s.trim()).filter(Boolean).pop()
    if (tail) country = tail
  }

  return {
    city: city || (typeof place.displayName === 'string' ? place.displayName.trim() : ''),
    country,
    coordinates: coords,
  }
}
