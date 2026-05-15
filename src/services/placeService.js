import api, { AI_TIMEOUT_MS } from './api'

export const placeService = {
  // RF03 - Tinder de Viagens (requer auth + tripId)
  // Um único HTTP: discover + resumo (menus chamadas ao gateway / rate limit).
  discoverSession: (tripId, day, excludePlaceIds) =>
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
      })
      .then((res) => {
        const d = res?.data ?? {}
        const s = d.summary ?? {}
        const places = Array.isArray(d.data) ? d.data : Array.isArray(d.places) ? d.places : []
        return {
          places,
          likesRemaining: d.likesRemaining ?? null,
          likesLimit: d.likesLimit ?? null,
          currentDay: d.currentDay ?? 1,
          totalLikes: d.totalLikes ?? s.likesCount ?? 0,
          tdvRestriction: d.tdvRestriction ?? null,
          likedPlaces: s.likedPlaces ?? [],
          dislikedPlaces: s.dislikedPlaces ?? [],
        }
      }),
  // excludePlaceIds: IDs ainda no baralho (prefetch) — o backend repassa ao agente para não repetir.
  discover: (tripId, day, excludePlaceIds) =>
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
      })
      .then((res) => {
        const d = res?.data ?? {};
        const places = Array.isArray(d.data) ? d.data : Array.isArray(d.places) ? d.places : [];
        return {
          places,
          likesRemaining: d.likesRemaining ?? null,
          likesLimit: d.likesLimit ?? null,
          currentDay: d.currentDay ?? 1,
          totalLikes: d.totalLikes ?? 0,
          tdvRestriction: d.tdvRestriction ?? null,
        };
      }),
  like: (tripId, placeId, itineraryDay, placeData) =>
    api.post('/places/like', { tripId, placeId, itineraryDay, placeData }).then((res) => ({
      ...res.data,
      likesRemaining: res.data.likesRemaining ?? res.data.data?.likesRemaining,
      currentDay: res.data.currentDay,
    })),
  dislike: (tripId, placeId, place) =>
    api.post('/places/dislike', { tripId, placeId, place }),
  undoLike: (tripId, placeId) =>
    api.post('/places/like/undo', { tripId, placeId }).then((res) => ({
      likesUsedTotal: res.data?.likesUsedTotal,
      currentDay: res.data?.currentDay,
    })),
  undoDislike: (tripId, placeId) => api.post('/places/dislike/undo', { tripId, placeId }),
  skip: (tripId, place) =>
    api.post('/places/skip', { tripId, place }),
  cacheSkippedPlaces: (tripId, places) =>
    api.post('/places/discover/cache-skipped', { tripId, places }),
  getTdvSummary: (tripId) =>
    api.get('/places/discover/summary', { params: { tripId } }).then((res) => res.data.data),

  // RF09 - Recomendador Gratuito (público, via API Gateway)
  // POST /api/places/recommendations-free → Gateway → Place Service → Agente IA
  getRecommendationsFree: (formData) =>
    api
      .post('/places/recommendations-free', formData, { timeout: AI_TIMEOUT_MS })
      .then((res) => ({ recommendations: res.data.data || [], count: res.data.count ?? 0 })),
  addFavorite: (recommendation) =>
    api.post('/places/recommendations-free/favorites', recommendation),
  removeFavorite: (id) => api.delete(`/places/recommendations-free/favorites/${id}`),
  getFavorites: () =>
    api.get('/places/recommendations-free/favorites').then((res) => res.data.data || []),
}
