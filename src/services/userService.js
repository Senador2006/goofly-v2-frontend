import api from './api'

export const userService = {
  /** Simulação de conclusão de pagamento (não cobra). Libera planejamento completo + documentos. */
  completeCheckout: () =>
    api.post('/users/me/checkout-complete').then((res) => res.data),
}
