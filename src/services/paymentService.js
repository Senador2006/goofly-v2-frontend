import api from './api'

export const paymentService = {
  pay: (formData) =>
    api.post('/payment/pay', formData).then((res) => res.body.data),
}
