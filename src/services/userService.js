import api from './api'

export const userService = {
  /** Simulação de conclusão de pagamento (não cobra). Libera planejamento completo + documentos. */
  completeCheckout: () =>
    api.post('/users/me/checkout-complete').then((res) => res.data),

  /** Atualiza nome e e-mail do usuário autenticado (PUT /users/:id no gateway). */
  updateProfile: (userId, { name, email }) =>
    api.put(`/users/${userId}`, { name, email }).then((res) => res.data.data || res.data),
}
