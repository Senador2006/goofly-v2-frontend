import api from './api'

export const documentService = {
  getChecklist: (tripId) =>
    api.post('/documents/checklist', { tripId }).then((res) => res.data.data || []),
  getLuggageRecommendations: (tripId) =>
    api
      .post('/documents/luggage/recommendations', { tripId })
      .then((res) => res.data.data || []),
  validate: (data) =>
    api.post('/documents/validate', data).then((res) => res.data.data),
}
