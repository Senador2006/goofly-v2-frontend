import api from './api'

export const tripService = {
  getTrips: (params) => api.get('/trips', { params }).then((res) => res.data.data),
  getTrip: (id) => api.get(`/trips/${id}`).then((res) => res.data.data),
  createTrip: (data) => api.post('/trips', data).then((res) => res.data.data),
  updateTrip: (id, data) => api.put(`/trips/${id}`, data).then((res) => res.data.data),
  deleteTrip: (id) => api.delete(`/trips/${id}`).then(() => undefined),
  getItinerary: (tripId) => api.get(`/trips/${tripId}/itinerary`).then((res) => res.data.data),
  optimizeItinerary: (tripId) =>
    api.post(`/trips/${tripId}/optimize`).then((res) => res.data.data),
  finalizeTdvPlanning: (tripId) =>
    api.post(`/trips/${tripId}/finalize-tdv`).then((res) => res.data.data),
}
