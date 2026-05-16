import api from './api'

/**
 * Contrato consumido aqui (ver `services/api.js`):
 *   res.body = { data, meta, error, message }
 * `data` é o payload de domínio (trip / lista / itinerário).
 */
export const tripService = {
  getTrips: (params) => api.get('/trips', { params }).then((res) => res.body.data || []),
  getTrip: (id) => api.get(`/trips/${id}`).then((res) => res.body.data),
  createTrip: (data) => api.post('/trips', data).then((res) => res.body.data),
  updateTrip: (id, data) => api.put(`/trips/${id}`, data).then((res) => res.body.data),
  deleteTrip: (id) => api.delete(`/trips/${id}`).then(() => undefined),
  getItinerary: (tripId) => api.get(`/trips/${tripId}/itinerary`).then((res) => res.body.data),
  optimizeItinerary: (tripId) =>
    api.post(`/trips/${tripId}/optimize`).then((res) => res.body.data),
  finalizeTdvPlanning: (tripId) =>
    api.post(`/trips/${tripId}/finalize-tdv`).then((res) => res.body.data),
}
