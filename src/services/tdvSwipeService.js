import api from './api'

/**
 * Cliente HTTP de swipe TDV: like / dislike / undo / skip (B14).
 */

export const tdvSwipeService = {
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
}
