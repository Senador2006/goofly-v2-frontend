import api, { AI_TIMEOUT_MS } from './api'

/**
 * Convenção (ver `services/api.js`):
 *   res.body = { data, meta, error, message }
 * Os endpoints de descoberta do TDV devolvem:
 *   { data: [places], currentDay, likesRemaining, likesLimit, totalLikes, tdvRestriction, summary? }
 * Tudo que não é `data` cai em `res.body.meta`.
 */
function unwrapDiscover(res) {
  const data = res.body.data
  const meta = res.body.meta || {}
  const summary = meta.summary || {}
  const places = Array.isArray(data) ? data : Array.isArray(meta.places) ? meta.places : []
  return {
    places,
    likesRemaining: meta.likesRemaining ?? null,
    likesLimit: meta.likesLimit ?? null,
    currentDay: meta.currentDay ?? 1,
    totalLikes: meta.totalLikes ?? summary.likesCount ?? 0,
    tdvRestriction: meta.tdvRestriction ?? null,
    likedPlaces: summary.likedPlaces ?? [],
    dislikedPlaces: summary.dislikedPlaces ?? [],
  }
}

export const placeService = {
  // RF03 — Tinder de Viagens. Um único HTTP: discover + resumo (REV3).
  discoverSession: (tripId, day, excludePlaceIds, requestConfig = {}) =>
    api
      .get('/places/discover/session', {
        params: {
          tripId,
          ...(day != null && { day }),
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
  discover: (tripId, day, excludePlaceIds, requestConfig = {}) =>
    api
      .get('/places/discover', {
        params: {
          tripId,
          ...(day != null && { day }),
          ...(Array.isArray(excludePlaceIds) &&
            excludePlaceIds.length > 0 && {
              excludePlaceIds: excludePlaceIds.map((id) => String(id)).join(','),
            }),
        },
        timeout: AI_TIMEOUT_MS,
        ...requestConfig,
      })
      .then(unwrapDiscover),

  like: (tripId, placeId, itineraryDay, placeData) =>
    api.post('/places/like', { tripId, placeId, itineraryDay, placeData }).then((res) => ({
      ...(res.body.data || {}),
      likesRemaining: res.body.meta.likesRemaining ?? res.body.data?.likesRemaining ?? null,
      currentDay: res.body.meta.currentDay ?? res.body.data?.currentDay ?? null,
      likesUsedTotal: res.body.meta.likesUsedTotal ?? res.body.data?.likesUsedTotal ?? null,
    })),

  dislike: (tripId, placeId, place) =>
    api.post('/places/dislike', { tripId, placeId, place }),

  undoLike: (tripId, placeId) =>
    api.post('/places/like/undo', { tripId, placeId }).then((res) => ({
      likesUsedTotal: res.body.meta.likesUsedTotal ?? res.body.data?.likesUsedTotal ?? null,
      currentDay: res.body.meta.currentDay ?? res.body.data?.currentDay ?? null,
    })),

  undoDislike: (tripId, placeId) => api.post('/places/dislike/undo', { tripId, placeId }),

  skip: (tripId, place) => api.post('/places/skip', { tripId, place }),

  cacheSkippedPlaces: (tripId, places) =>
    api.post('/places/discover/cache-skipped', { tripId, places }),

  getTdvSummary: (tripId) =>
    api.get('/places/discover/summary', { params: { tripId } }).then((res) => res.body.data),

  // RF09 — Recomendador Gratuito (público).
  getRecommendationsFree: (formData) =>
    api
      .post('/places/recommendations-free', formData, { timeout: AI_TIMEOUT_MS })
      .then((res) => ({
        recommendations: Array.isArray(res.body.data) ? res.body.data : [],
        count: res.body.meta.count ?? (Array.isArray(res.body.data) ? res.body.data.length : 0),
      })),

  addFavorite: (recommendation) =>
    api.post('/places/recommendations-free/favorites', recommendation),

  removeFavorite: (id) => api.delete(`/places/recommendations-free/favorites/${id}`),

  getFavorites: () =>
    api.get('/places/recommendations-free/favorites').then((res) => res.body.data || []),
}
