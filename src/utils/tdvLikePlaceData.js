import { readLatLng } from './coordinates.js'
import { getRealPlaceImageUrls } from './placeImages.js'

/**
 * Payload `placeData` enviado em POST /places/like a partir do card TDV.
 * Inclui imagens reais quando existirem (sem placeholder).
 *
 * @param {Record<string, unknown> | null | undefined} place
 * @returns {Record<string, unknown>}
 */
export function buildTdvLikePlaceData(place) {
  if (!place || typeof place !== 'object') return {}

  const latLng = readLatLng(place)
  const imageUrls = getRealPlaceImageUrls(place)

  const placeData = {
    name: place.name,
    description: place.description || place.aiReasoning,
    location:
      place.location ||
      (place.city && place.country ? `${place.city}, ${place.country}` : undefined),
    ...(latLng ? { coordinates: { latitude: latLng[0], longitude: latLng[1] } } : {}),
  }

  if (imageUrls.length > 0) {
    placeData.image_url = imageUrls[0]
    placeData.image_urls = imageUrls
  }

  for (const key of Object.keys(placeData)) {
    if (placeData[key] === undefined) delete placeData[key]
  }

  return placeData
}
