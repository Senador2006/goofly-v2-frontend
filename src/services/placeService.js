import { tdvDiscoverService } from './tdvDiscoverService'
import { tdvSwipeService } from './tdvSwipeService'
import api from './api'

/**
 * Facade estável (B14): discover + swipe + RF09 free-recs.
 * Preferir `tdvDiscoverService` / `tdvSwipeService` em código novo TDV.
 */
export const placeService = {
  ...tdvDiscoverService,
  ...tdvSwipeService,

  getRecommendationsFree: (payload) =>
    api.post('/places/recommendations/free', payload).then((res) => res.body.data || []),

  addRecommendationFavorite: (payload) =>
    api.post('/places/recommendations/favorites', payload).then((res) => res.body.data),

  getRecommendationFavorites: () =>
    api.get('/places/recommendations/favorites').then((res) => res.body.data || []),

  removeRecommendationFavorite: (id) => api.delete(`/places/recommendations/favorites/${id}`),
}
