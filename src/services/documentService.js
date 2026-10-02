import api, { AI_TIMEOUT_MS } from './api'

export const documentService = {
  getChecklist: (tripId, { force = false } = {}) =>
    api
      .post('/documents/checklist', { tripId, force: force === true }, { timeout: AI_TIMEOUT_MS })
      .then((res) => res.body.data || null),
  getLuggageRecommendations: (tripId, { force = false } = {}) =>
    api
      .post(
        '/documents/luggage/recommendations',
        { tripId, force: force === true },
        { timeout: AI_TIMEOUT_MS }
      )
      .then((res) => res.body.data || null),
  validate: (tripId, data = {}) =>
    api.post('/documents/validate', { ...data, tripId }).then((res) => res.body.data),
}
