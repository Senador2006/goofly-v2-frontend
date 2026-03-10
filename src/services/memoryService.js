import api from './api'

export const memoryService = {
  getByTrip: (tripId, filters = {}) =>
    api
      .get(`/memories/trip/${tripId}`, { params: filters })
      .then((res) => res.data.data || []),
  getMap: () => api.get('/memories/map').then((res) => res.data.data || []),
  create: (data) => api.post('/memories', data).then((res) => res.data.data),
  update: (id, data) => api.put(`/memories/${id}`, data).then((res) => res.data.data),
  delete: (id) => api.delete(`/memories/${id}`),
}
