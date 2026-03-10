import api from './api'

export const dashboardService = {
  getOverview: () => api.get('/dashboard/overview').then((res) => res.data.data),
  getTripSwipeWidget: (tripId) =>
    api
      .get('/dashboard/trip-swipe', { params: tripId ? { tripId } : {} })
      .then((res) => res.data.data),
}
