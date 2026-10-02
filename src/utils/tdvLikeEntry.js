import { buildTdvLikePlaceData } from './tdvLikePlaceData.js'
import { getRealPlaceImageUrls } from './placeImages.js'

export function getTdvPlaceId(place) {
  const id = place?.placeId ?? place?.place_id ?? place?.id
  return id != null && String(id).trim() !== '' ? String(id) : null
}

/**
 * Mescla entrada de curtida servidor + local sem perder metadados ricos (imagens, coords).
 * Campos escalares do `local` prevalecem; imagens/coords/descrição vêm do servidor se ausentes no local.
 */
export function mergeTdvLikeEntry(server, local) {
  if (!server) return local || null
  if (!local) return server

  const merged = { ...server, ...local }

  for (const key of ['description', 'location']) {
    if (server[key] && !local[key]) merged[key] = server[key]
  }

  if (server.coordinates && !local.coordinates) merged.coordinates = server.coordinates

  const serverUrls = getRealPlaceImageUrls(server)
  const localUrls = getRealPlaceImageUrls(local)
  if (serverUrls.length && !localUrls.length) {
    merged.image_url = serverUrls[0]
    merged.image_urls = serverUrls
  }

  return merged
}

/** Mescla listas por placeId; `incoming` (servidor) fornece base, `local` sobrescreve com merge inteligente. */
export function mergeTdvLikeListsById(incoming, local) {
  const map = new Map()
  for (const p of incoming || []) {
    const id = getTdvPlaceId(p)
    if (id) map.set(id, p)
  }
  for (const p of local || []) {
    const id = getTdvPlaceId(p)
    if (!id) continue
    map.set(id, mergeTdvLikeEntry(map.get(id), p))
  }
  return [...map.values()]
}

/** Objeto de curtida completo a partir do card TDV (inclui imagens quando existirem). */
export function likeEntryFromTdvPlace(place) {
  if (!place || typeof place !== 'object') return null
  const placeId = getTdvPlaceId(place)
  if (!placeId) return null

  const data = buildTdvLikePlaceData(place)
  const name = data.name || place.name || placeId

  return {
    placeId,
    place_id: placeId,
    name,
    title: name,
    ...data,
  }
}
