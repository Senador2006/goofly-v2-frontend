/**
 * Chave de conteúdo para dedupe visual no TDV (nome + local).
 * Espelha a ideia de placeContentFingerprint do backend, sem crypto.
 */
function normalizePart(value) {
  if (value == null || value === '') return ''
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}

export function placeContentKey(place) {
  if (!place || typeof place !== 'object') return null
  const name = normalizePart(place.name || place.placeName)
  const city = normalizePart(place.city)
  const country = normalizePart(place.country)
  const location = normalizePart(place.location || place.address)
  const parts = [name, city || location, country].filter(Boolean)
  return parts.length > 0 ? parts.join('|') : null
}
