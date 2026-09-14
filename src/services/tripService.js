import api, {
  AI_TIMEOUT_MS,
  ITINERARY_TIMEOUT_MS,
  isItineraryMissingError,
  isRequestAbort,
} from './api'

/**
 * Contrato consumido aqui (ver `services/api.js`):
 *   res.body = { data, meta, error, message }
 * `data` é o payload de domínio (trip / lista / itinerário).
 */
export const tripService = {
  getTrips: (params) => api.get('/trips', { params }).then((res) => res.body.data || []),
  getTrip: (id, options = {}) =>
    api.get(`/trips/${id}`, { signal: options.signal }).then((res) => res.body.data),
  getPlanningPrice: (id) => api.get(`/trips/${id}/planning-price`).then((res) => res.body.data),
  createTrip: (data, options = {}) =>
    api
      .post('/trips', data, {
        signal: options.signal,
        headers: options.idempotencyKey
          ? { 'Idempotency-Key': options.idempotencyKey }
          : undefined,
      })
      .then((res) => res.body.data),
  updateTrip: (id, data) => api.put(`/trips/${id}`, data).then((res) => res.body.data),
  deleteTrip: (id) => api.delete(`/trips/${id}`).then(() => undefined),
  getItinerary: (tripId, options = {}) =>
    api
      .get(`/trips/${tripId}/itinerary`, {
        params: options.refresh ? { _t: Date.now() } : undefined,
        timeout: ITINERARY_TIMEOUT_MS,
        signal: options.signal,
      })
      .then((res) => res.body.data)
      .catch((err) => {
        if (isRequestAbort(err)) throw err
        if (isItineraryMissingError(err)) return null
        throw err
      }),
  updateItinerary: (tripId, payload) =>
    api.put(`/trips/${tripId}/itinerary`, payload).then((res) => res.body.data),
  optimizeItinerary: (tripId, options = {}) =>
    api
      .post(
        `/trips/${tripId}/optimize`,
        options.mode ? { mode: options.mode } : {},
        { timeout: AI_TIMEOUT_MS },
      )
      .then((res) => res.body.data),
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
  previewItineraryRoute: (tripId, { day = 1, profile = 'foot-walking', activities = [], mealActivities = [] } = {}) =>
    api
      .post(`/trips/${tripId}/itinerary/route/preview`, { day, profile, activities, mealActivities })
      .then((res) => res.body.data),
}
