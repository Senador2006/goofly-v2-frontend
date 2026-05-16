import { PLACEHOLDER_COVER } from '../constants/placeholders'

function isHttpUrl(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value.trim())
}

/**
 * Lista de URLs para o carrossel do TDV (mín. 1 entrada — placeholder se vazio).
 */
export function getPlaceImageUrls(place) {
  if (!place) return [PLACEHOLDER_COVER]

  const fromApi = place.image_urls ?? place.imageUrls
  if (Array.isArray(fromApi) && fromApi.length > 0) {
    const valid = fromApi.map((u) => (typeof u === 'string' ? u.trim() : '')).filter(isHttpUrl)
    if (valid.length > 0) return valid
  }

  const single = place.image_url ?? place.imageUrl
  if (isHttpUrl(single)) return [single.trim()]

  return [PLACEHOLDER_COVER]
}

export function getPlaceCoverImageUrl(place) {
  return getPlaceImageUrls(place)[0] ?? PLACEHOLDER_COVER
}
