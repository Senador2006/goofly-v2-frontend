import api, { AI_TIMEOUT_MS } from './api'

/**
 * Convenção (ver `services/api.js`):
 *   res.body = { data, meta, error, message }
 * Endpoints de descoberta TDV devolvem:
 *   { data: [places], totalLikes, placesSource?, summary? }
 */
function unwrapDiscover(res) {
  const data = res.body.data
  const meta = res.body.meta || {}
  const summary = meta.summary || {}
  const places = Array.isArray(data) ? data : Array.isArray(meta.places) ? meta.places : []
  return {
    places,
    totalLikes: meta.totalLikes ?? summary.likesCount ?? 0,
    placesSource: meta.placesSource ?? null,
    likedPlaces: summary.likedPlaces ?? [],
    dislikedPlaces: summary.dislikedPlaces ?? [],
  }
}

export const placeService = {
  // RF03 — Tinder de Viagens. Um único HTTP: discover + resumo (REV3).
  discoverSession: (tripId, excludePlaceIds, requestConfig = {}) =>
    api
      .get('/places/discover/session', {
        params: {
          tripId,
          ...(Array.isArray(excludePlaceIds) &&
            excludePlaceIds.length > 0 && {
              excludePlaceIds: excludePlaceIds.map((id) => String(id)).join(','),
            }),
        },
        timeout: AI_TIMEOUT_MS,
        ...requestConfig,
      })
      .then(unwrapDiscover),

  // excludePlaceIds: IDs ainda no baralho (prefetch REV2/REV4) — backend repassa ao agente.
  discover: (tripId, excludePlaceIds, requestConfig = {}) =>
    api
      .get('/places/discover', {
        params: {
          tripId,
          ...(Array.isArray(excludePlaceIds) &&
            excludePlaceIds.length > 0 && {
              excludePlaceIds: excludePlaceIds.map((id) => String(id)).join(','),
            }),
        },
        timeout: AI_TIMEOUT_MS,
        ...requestConfig,
      })
      .then(unwrapDiscover),

  like: (tripId, placeId, placeData) =>
    api.post('/places/like', { tripId, placeId, placeData }).then((res) => ({
      ...(res.body.data || {}),
      likesUsedTotal: res.body.meta.likesUsedTotal ?? res.body.data?.likesUsedTotal ?? null,
    })),

  dislike: (tripId, placeId, place) =>
    api.post('/places/dislike', { tripId, placeId, place }),

  undoLike: (tripId, placeId) =>
    api.post('/places/like/undo', { tripId, placeId }).then((res) => ({
      likesUsedTotal: res.body.meta.likesUsedTotal ?? res.body.data?.likesUsedTotal ?? null,
    })),

  undoDislike: (tripId, placeId) => api.post('/places/dislike/undo', { tripId, placeId }),

  skip: (tripId, place) => api.post('/places/skip', { tripId, place }),

  cacheSkippedPlaces: (tripId, places) =>
    api.post('/places/discover/cache-skipped', { tripId, places }),

  getTdvSummary: (tripId) => api.get('/places/tdv-summary', { params: { tripId } }),

  getRecommendationsFree: (payload) =>
    api.post('/places/recommendations/free', payload).then((res) => res.body.data || []),

  addRecommendationFavorite: (payload) =>
    api.post('/places/recommendations/favorites', payload).then((res) => res.body.data),

  getRecommendationFavorites: () =>
    api.get('/places/recommendations/favorites').then((res) => res.body.data || []),

  removeRecommendationFavorite: (id) => api.delete(`/places/recommendations/favorites/${id}`),
}
