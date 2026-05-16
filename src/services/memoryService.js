import api from './api'

/**
 * `getMap` retorna `{ points, total_memories, trips_with_memories }` —
 * payload completo é mantido em `body.data` (sem fallback para `[]`, que
 * mascarava o objeto no caller).
 */
export const memoryService = {
  getByTrip: (tripId, filters = {}) =>
    api
      .get(`/memories/trip/${tripId}`, { params: filters })
      .then((res) => res.body.data || []),
  getMap: () => api.get('/memories/map').then((res) => res.body.data || { points: [] }),
  create: (data) => api.post('/memories', data).then((res) => res.body.data),
  update: (id, data) => api.put(`/memories/${id}`, data).then((res) => res.body.data),
  delete: (id) => api.delete(`/memories/${id}`),
}
