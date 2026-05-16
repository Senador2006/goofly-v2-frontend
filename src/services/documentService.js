import api, { AI_TIMEOUT_MS } from './api'

export const documentService = {
  getChecklist: (tripId) =>
    api
      .post('/documents/checklist', { tripId }, { timeout: AI_TIMEOUT_MS })
      .then((res) => res.body.data || []),
  getLuggageRecommendations: (tripId) =>
    api
      .post('/documents/luggage/recommendations', { tripId }, { timeout: AI_TIMEOUT_MS })
      .then((res) => res.body.data || []),
  validate: (data) =>
    api.post('/documents/validate', data).then((res) => res.body.data),
}
