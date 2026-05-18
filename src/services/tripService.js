import api, { AI_TIMEOUT_MS } from './api'

/**
 * Contrato consumido aqui (ver `services/api.js`):
 *   res.body = { data, meta, error, message }
 * `data` é o payload de domínio (trip / lista / itinerário).
 */
export const tripService = {
  getTrips: (params) => api.get('/trips', { params }).then((res) => res.body.data || []),
  getTrip: (id) => api.get(`/trips/${id}`).then((res) => res.body.data),
  getPlanningPrice: (id) => api.get(`/trips/${id}/planning-price`).then((res) => res.body.data),
  createTrip: (data) => api.post('/trips', data).then((res) => res.body.data),
  updateTrip: (id, data) => api.put(`/trips/${id}`, data).then((res) => res.body.data),
  deleteTrip: (id) => api.delete(`/trips/${id}`).then(() => undefined),
  getItinerary: (tripId, options = {}) =>
    api
      .get(`/trips/${tripId}/itinerary`, {
        params: options.refresh ? { _t: Date.now() } : undefined,
      })
      .then((res) => res.body.data),
  optimizeItinerary: (tripId) =>
    api.post(`/trips/${tripId}/optimize`).then((res) => res.body.data),
  finalizeTdvPlanning: (tripId) =>
    api
      .post(`/trips/${tripId}/finalize-tdv`, {}, { timeout: AI_TIMEOUT_MS })
      .then((res) => res.body?.data ?? res.data?.data ?? res.data),
  getItineraryRoute: (tripId, { day = 1, profile = 'foot-walking' } = {}) =>
    api
      .get(`/trips/${tripId}/itinerary/route`, {
        params: { day, profile, _t: Date.now() },
        headers: { 'Cache-Control': 'no-cache' },
      })
      .then((res) => res.body.data),
}
