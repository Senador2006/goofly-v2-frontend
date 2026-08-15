import api from './api'

export const paymentService = {
  pay: (formData) =>
    api.post('/payment/pay', formData).then((res) => res.body.data),

  getStatus: (tripId) =>
    api
      .get('/payment/status', { params: { tripId } })
      .then((res) => res.body?.data ?? res.data?.data ?? res.data),
}
